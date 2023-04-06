import { Storage } from "@acala-network/sdk/utils/storage";
import { AnyApi, FixedPointNumber as FN } from "@acala-network/sdk-core";
import { combineLatest, map, Observable } from "rxjs";

import { SubmittableExtrinsic } from "@polkadot/api/types";
import { DeriveBalancesAll } from "@polkadot/api-derive/balances/types";
import { ISubmittableResult } from "@polkadot/types/types";

import { BalanceAdapter, BalanceAdapterConfigs } from "../balance-adapter";
import { BaseCrossChainAdapter } from "../base-chain-adapter";
import { ChainName, chains } from "../configs";
import { ApiNotFound, CurrencyNotFound } from "../errors";
import {
  BalanceData,
  ExpandToken,
  CrossChainRouterConfigs,
  CrossChainTransferParams,
} from "../types";

const DEST_WEIGHT = "5000000000";

export const hydraRoutersConfig: Omit<CrossChainRouterConfigs, "from">[] = [
  {
    to: "interlay",
    token: "IBTC",
    xcm: {
      // recent transfer cost: 62 - add 10x margin to fee estimate
      fee: { token: "IBTC", amount: "620" },
      weightLimit: DEST_WEIGHT,
    },
  },
];

export const hydraTokensConfig: Record<string, ExpandToken> = {
  HDX: {
    name: "HDX",
    symbol: "HDX",
    decimals: 12,
    ed: "1000000000000",
    toChainData: () => 0,
  },
  IBTC: {
    name: "IBTC",
    symbol: "IBTC",
    decimals: 8,
    ed: "36",
    toChainData: () => 11,
  },
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const createBalanceStorages = (api: AnyApi) => {
  return {
    balances: (address: string) =>
      Storage.create<DeriveBalancesAll>({
        api,
        path: "derive.balances.all",
        params: [address],
      }),
    assets: (tokenId: number, address: string) =>
      Storage.create<any>({
        api,
        path: "query.tokens.accounts",
        params: [address, tokenId],
      }),
  };
};

class HydradxBalanceAdapter extends BalanceAdapter {
  private storages: ReturnType<typeof createBalanceStorages>;

  constructor({ api, chain, tokens }: BalanceAdapterConfigs) {
    super({ api, chain, tokens });
    this.storages = createBalanceStorages(api);
  }

  public subscribeBalance(
    tokenName: string,
    address: string
  ): Observable<BalanceData> {
    const storage = this.storages.balances(address);

    if (tokenName === this.nativeToken) {
      return storage.observable.pipe(
        map((data) => ({
          free: FN.fromInner(data.freeBalance.toString(), this.decimals),
          locked: FN.fromInner(data.lockedBalance.toString(), this.decimals),
          reserved: FN.fromInner(
            data.reservedBalance.toString(),
            this.decimals
          ),
          available: FN.fromInner(
            data.availableBalance.toString(),
            this.decimals
          ),
        }))
      );
    }

    const token = this.getToken<ExpandToken>(tokenName);

    return this.storages.assets(token.toChainData(), address).observable.pipe(
      map((balance) => {
        const amount = FN.fromInner(
          balance.free?.toString() || "0",
          token.decimals
        );

        return {
          free: amount,
          locked: new FN(0),
          reserved: new FN(0),
          available: amount,
        };
      })
    );
  }
}

class BaseHydradxAdapter extends BaseCrossChainAdapter {
  private balanceAdapter?: HydradxBalanceAdapter;

  public async setApi(api: AnyApi) {
    this.api = api;

    await api.isReady;

    this.balanceAdapter = new HydradxBalanceAdapter({
      chain: this.chain.id as ChainName,
      api,
      tokens: this.tokens,
    });
  }

  public subscribeTokenBalance(
    token: string,
    address: string
  ): Observable<BalanceData> {
    if (!this.balanceAdapter) {
      throw new ApiNotFound(this.chain.id);
    }

    return this.balanceAdapter.subscribeBalance(token, address);
  }

  public subscribeMaxInput(
    token: string,
    address: string,
    to: ChainName
  ): Observable<FN> {
    if (!this.balanceAdapter) {
      throw new ApiNotFound(this.chain.id);
    }

    return combineLatest({
      txFee:
        token === this.balanceAdapter?.nativeToken
          ? this.estimateTxFee({
              amount: FN.ZERO,
              to,
              token,
              address,
              signer: address,
            })
          : "0",
      balance: this.balanceAdapter
        .subscribeBalance(token, address)
        .pipe(map((i) => i.available)),
    }).pipe(
      map(({ balance, txFee }) => {
        const tokenMeta = this.balanceAdapter?.getToken(token);
        const feeFactor = 1.2;
        const fee = FN.fromInner(txFee, tokenMeta?.decimals).mul(
          new FN(feeFactor)
        );

        // always minus ed
        return balance
          .minus(fee)
          .minus(FN.fromInner(tokenMeta?.ed || "0", tokenMeta?.decimals));
      })
    );
  }

  public createTx(
    params: CrossChainTransferParams
  ):
    | SubmittableExtrinsic<"promise", ISubmittableResult>
    | SubmittableExtrinsic<"rxjs", ISubmittableResult> {
    if (this.api === undefined) {
      throw new ApiNotFound(this.chain.id);
    }

    const { address, amount, to, token: tokenName } = params;

    const token = this.getToken<ExpandToken>(tokenName);

    if (!token) {
      throw new CurrencyNotFound(token);
    }

    const toChain = chains[to];
    const accountId = this.api?.createType("AccountId32", address).toHex();
    const dst = {
      parents: 1,
      interior:
        to === "kusama" || to === "polkadot"
          ? { X1: { AccountId32: { id: accountId, network: "Any" } } }
          : {
              X2: [
                { Parachain: toChain.paraChainId },
                { AccountId32: { id: accountId, network: "Any" } },
              ],
            },
    };

    // use "Unlimited" if supported
    const destWeight =
      this.api?.tx.xTokens.transfer.meta.args[3].type.toString() ===
      "XcmV2WeightLimit"
        ? "Unlimited"
        : this.getDestWeight(tokenName, to);

    return this.api?.tx.xTokens.transfer(
      token.toChainData(),
      amount.toChainData(),
      { V1: dst },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      destWeight!
    );
  }
}

export class HydraAdapter extends BaseHydradxAdapter {
  constructor() {
    super(chains.hydra, hydraRoutersConfig, hydraTokensConfig);
  }
}
