import { combineLatest, map, Observable, race } from "rxjs";

import { ApiPromise, ApiRx, WsProvider } from "@polkadot/api";
import {
  prodParasKusama,
  prodParasKusamaCommon,
  prodParasPolkadot,
  prodParasPolkadotCommon,
  prodRelayKusama,
  prodRelayPolkadot,
} from "@polkadot/apps-config/endpoints";

import { isChainEqual } from "./utils/is-chain-equal";
import { ChainName } from "./configs";

export class ApiProvider {
  protected apis: Record<string, ApiRx> = {};
  protected promiseApis: Record<string, ApiPromise> = {};

  public getApi(chainName: string) {
    return this.apis[chainName];
  }

  public getApiPromise(chainName: string) {
    return this.promiseApis[chainName];
  }

  public connectFromChain(
    chainName: ChainName[],
    nodeList: Partial<Record<ChainName, string[]>> | undefined
  ) {
    return combineLatest(
      chainName.map((chain) => {
        let nodes = (nodeList || {})[chain];

        if (!nodes) {
          if (isChainEqual(chain, "kusama")) {
            nodes = Object.values(prodRelayKusama.providers).filter((e) =>
              e.startsWith("wss://")
            );
          } else if (chain === "polkadot") {
            nodes = Object.values(prodRelayPolkadot.providers).filter((e) =>
              e.startsWith("wss://")
            );
          } else if (chain === "statemine") {
            nodes = Object.values(
              prodParasKusamaCommon.find((e) => e.info === "KusamaAssetHub")
                ?.providers || {}
            ).filter((e) => e.startsWith("wss://"));
          } else if (chain === "statemint") {
            nodes = Object.values(
              prodParasPolkadotCommon.find((e) => e.info === "PolkadotAssetHub")
                ?.providers || {}
            ).filter((e) => e.startsWith("wss://"));
          } else if (chain === "bifrost_polkadot" || chain === "bifrost") {
            const chainInfoName = "bifrost";
            const haystack =
              chain === "bifrost_polkadot"
                ? prodParasPolkadot
                : prodParasKusama;

            nodes = Object.values(
              haystack.find((e) => e.info === chainInfoName)?.providers || {}
            ).filter((e) => e.startsWith("wss://"));
          } else {
            const chainInfo = chain === "hydra" ? "hydradx" : chain;
            nodes = Object.values(
              [...prodParasKusama, ...prodParasPolkadot].find(
                (e) => e.info === chainInfo
              )?.providers || {}
            ).filter((e) => e.startsWith("wss://"));
          }
        }

        if (nodes.length > 1) {
          return race(nodes.map((node) => this.connect([node], chain)));
        }

        return this.connect(nodes, chain);
      })
    );
  }

  public connect(
    nodes: string[],
    chainName: ChainName
  ): Observable<ChainName | null> {
    if (this.apis[chainName]) {
      this.apis[chainName].disconnect();
      delete this.apis[chainName];
    }

    if (this.promiseApis[chainName]) {
      this.promiseApis[chainName].disconnect();
      delete this.promiseApis[chainName];
    }

    const wsProvider = new WsProvider(nodes);

    const apiOptions = {
      provider: wsProvider,
      noInitWarn: true,
    };

    const promiseApi = ApiPromise.create(apiOptions);
    return ApiRx.create(apiOptions).pipe(
      map((api) => {
        // connect success
        if (api) {
          if (!this.apis[chainName]) {
            this.apis[chainName] = api;
          } else {
            api.disconnect();
          }

          promiseApi.then((res) => {
            if (!this.promiseApis[chainName]) {
              this.promiseApis[chainName] = res;
            } else {
              res.disconnect();
            }
          });

          return chainName;
        }

        return null;
      })
    );
  }

  public disconnect(chainName: ChainName) {
    if (this.apis[chainName]) {
      this.apis[chainName].disconnect();
      delete this.apis[chainName];
    }
  }
}
