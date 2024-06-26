import { AnyApi, FixedPointNumber as FN } from "@acala-network/sdk-core";
import { Storage } from "@acala-network/sdk/utils/storage";
import { Observable, combineLatest, map } from "rxjs";

import { DeriveBalancesAll } from "@polkadot/api-derive/balances/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ISubmittableResult } from "@polkadot/types/types";

import { BalanceAdapter, BalanceAdapterConfigs } from "../balance-adapter";
import { BaseCrossChainAdapter } from "../base-chain-adapter";
import { ChainName, chains } from "../configs";
import { ApiNotFound, CurrencyNotFound } from "../errors";
import {
  BalanceData,
  BasicToken,
  CrossChainRouterConfigs,
  CrossChainTransferParams,
} from "../types";

export const polkadotRoutersConfig: Omit<CrossChainRouterConfigs, "from">[] = [
  {
    to: "interlay",
    token: "DOT",
    xcm: {
      fee: { token: "DOT", amount: "1000000000" },
      weightLimit: "Unlimited",
    },
  },
  {
    to: "statemint",
    token: "DOT",
    xcm: {
      // recent transfer: 35_930_000 - use 10x as buffer
      fee: { token: "DOT", amount: "359300000" },
      weightLimit: "Unlimited",
    },
  },
];
export const kusamaRoutersConfig: Omit<CrossChainRouterConfigs, "from">[] = [
  {
    to: "kintsugi",
    token: "KSM",
    xcm: {
      // fees in chopsticks test: 161_648_000 - add 10x buffer
      fee: { token: "KSM", amount: "1616480000" },
      weightLimit: "Unlimited",
    },
  },
  {
    to: "statemine",
    token: "KSM",
    xcm: {
      // recent transfer: 119_766_667 - add 10x buffer
      fee: { token: "KSM", amount: "1197666670" },
      weightLimit: "Unlimited",
    },
  },
];

const polkadotTokensConfig: Record<string, Record<string, BasicToken>> = {
  polkadot: {
    DOT: { name: "DOT", symbol: "DOT", decimals: 10, ed: "10000000000" },
  },
  kusama: {
    KSM: { name: "KSM", symbol: "KSM", decimals: 12, ed: "333333333" },
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
  };
};

class PolkadotBalanceAdapter extends BalanceAdapter {
  private storages: ReturnType<typeof createBalanceStorages>;

  constructor({ api, chain, tokens }: BalanceAdapterConfigs) {
    super({ chain, api, tokens });

    this.storages = createBalanceStorages(api);
  }

  public subscribeBalance(
    token: string,
    address: string
  ): Observable<BalanceData> {
    const storage = this.storages.balances(address);

    if (token !== this.nativeToken) {
      throw new CurrencyNotFound(token);
    }

    return storage.observable.pipe(
      map((data) => ({
        free: FN.fromInner(data.freeBalance.toString(), this.decimals),
        locked: FN.fromInner(data.lockedBalance.toString(), this.decimals),
        reserved: FN.fromInner(data.reservedBalance.toString(), this.decimals),
        available: FN.fromInner(
          data.availableBalance.toString(),
          this.decimals
        ),
      }))
    );
  }
}

class BasePolkadotAdapter extends BaseCrossChainAdapter {
  private balanceAdapter?: PolkadotBalanceAdapter;

  public override async setApi(api: AnyApi) {
    this.api = api;

    await api.isReady;

    const chain = this.chain.id as ChainName;

    this.balanceAdapter = new PolkadotBalanceAdapter({
      chain,
      api,
      tokens: polkadotTokensConfig[chain],
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
    _to: ChainName
  ): Observable<FN> {
    if (!this.balanceAdapter) {
      throw new ApiNotFound(this.chain.id);
    }

    return combineLatest({
      balance: this.balanceAdapter
        .subscribeBalance(token, address)
        .pipe(map((i) => i.available)),
    }).pipe(
      map(({ balance }) => {
        const tokenMeta = this.balanceAdapter?.getToken(token);
        // fixed fee of 0.1 of KSM or DOT until we get paymentinfo to work again
        // 0.06 was observed needed for DOT (tested in chopsticks), KSM needs less than that
        const fee = FN.fromInner(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          0.1 * Math.pow(10, tokenMeta!.decimals),
          tokenMeta?.decimals
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

    const { address, amount, to, token } = params;
    const toChain = chains[to];

    if (token !== this.balanceAdapter?.nativeToken) {
      throw new CurrencyNotFound(token);
    }

    const accountId = this.api?.createType("AccountId32", address).toHex();

    // to statemine
    if (to === "statemine" || to === "statemint") {
      const dst = {
        interior: { X1: { ParaChain: toChain.paraChainId } },
        parents: 0,
      };
      const acc = {
        interior: {
          X1: {
            AccountId32: {
              id: accountId,
            },
          },
        },
        parents: 0,
      };
      const ass = [
        {
          fun: { Fungible: amount.toChainData() },
          id: { Concrete: { interior: "Here", parents: 0 } },
        },
      ];

      return this.api?.tx.xcmPallet.limitedTeleportAssets(
        { V3: dst },
        { V3: acc },
        { V3: ass },
        0,
        "Unlimited"
      );
    }

    const [dst, acc, ass] = [
      {
        V3: {
          parents: 0,
          interior: { X1: { Parachain: toChain.paraChainId } },
        },
      },
      {
        V3: {
          parents: 0,
          interior: { X1: { AccountId32: { id: accountId } } },
        },
      },
      {
        V3: [
          {
            fun: { Fungible: amount.toChainData() },
            id: { Concrete: { parents: 0, interior: "Here" } },
          },
        ],
      },
    ];

    if (to === "kintsugi") {
      return this.api?.tx.xcmPallet.reserveTransferAssets(dst, acc, ass, 0);
    }

    // to other parachain
    return this.api?.tx.xcmPallet.limitedReserveTransferAssets(
      dst,
      acc,
      ass,
      0,
      this.getDestWeight(token, to)?.toString()
    );
  }
}

export class PolkadotAdapter extends BasePolkadotAdapter {
  constructor() {
    super(
      chains.polkadot,
      polkadotRoutersConfig,
      polkadotTokensConfig.polkadot
    );
  }
}

export class KusamaAdapter extends BasePolkadotAdapter {
  constructor() {
    super(chains.kusama, kusamaRoutersConfig, polkadotTokensConfig.kusama);
  }
}
