import { firstValueFrom } from "rxjs";

import { ApiProvider } from "./api-provider";
import { BaseCrossChainAdapter } from "./base-chain-adapter";
import { ChainName } from "./configs";
import { Bridge } from "./index";
import { KintsugiAdapter, InterlayAdapter } from "./adapters/interlay";
import { FN } from "./types";
import { KusamaAdapter, PolkadotAdapter } from "./adapters/polkadot";
import { StatemineAdapter, StatemintAdapter } from "./adapters/statemint";
import { HeikoAdapter, ParallelAdapter } from "./adapters/parallel";
import { AcalaAdapter, KaruraAdapter } from "./adapters/acala";
import { BifrostKusamaAdapter, BifrostPolkadotAdapter } from "./adapters/bifrost";
import { HydraAdapter } from "./adapters/hydradx";
import { AstarAdapter } from "./adapters/astar";
import { PhalaAdapter } from "./adapters/phala";

describe.skip("Bridge sdk usage", () => {
  jest.setTimeout(30000);

  const provider = new ApiProvider();

  const availableAdapters: Record<string, BaseCrossChainAdapter> = {
    polkadot: new PolkadotAdapter(),
    kusama: new KusamaAdapter(),
    interlay: new InterlayAdapter(),
    kintsugi: new KintsugiAdapter(),
    acala: new AcalaAdapter(),
    karura: new KaruraAdapter(),
    statemint: new StatemintAdapter(),
    statemine: new StatemineAdapter(),
    heiko: new HeikoAdapter(),
    bifrost_polkadot: new BifrostPolkadotAdapter(),
    bifrost: new BifrostKusamaAdapter(),
    hydra: new HydraAdapter(),
    parallel: new ParallelAdapter(),
    astar: new AstarAdapter(),
    phala: new PhalaAdapter(),
  };

  const bridge = new Bridge({
    adapters: Object.values(availableAdapters),
  });

  function printTx(fromChain: any, toChain: any, token: any) {
    // Alice test address
    const testAddress = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

    const tx = availableAdapters[fromChain].createTx({
      to: toChain,
      token,
      amount: FN.fromInner("1000000000", 10),
      address: testAddress,
      signer: testAddress,
    });
    console.log(
      "transfer",
      token,
      "from",
      fromChain,
      "to",
      toChain + ": " + tx.method.toHex()
    );
  }

  function printBidirectionalTxs(chainA: any, chainB: any, token: any) {
    printTx(chainA, chainB, token);
    printTx(chainB, chainA, token);
  }

  test("1. bridge init should be ok", async () => {
    expect(bridge.router.getRouters().length).toBeGreaterThanOrEqual(
      Object.keys(availableAdapters).length
    );
    expect(
      bridge.router.getDestinationChains({ from: "interlay" }).length
    ).toBeGreaterThanOrEqual(0);
    expect(
      bridge.router.getAvailableTokens({ from: "interlay", to: "polkadot" }).length
    ).toBeGreaterThanOrEqual(0);
  });

  test("2. connect fromChain should be ok", async () => {
    const chains = Object.keys(availableAdapters) as ChainName[];

    expect(provider.getApi(chains[0])).toEqual(undefined);
    expect(provider.getApi(chains[1])).toEqual(undefined);

    // connect all adapters
    const connected = await firstValueFrom(
      provider.connectFromChain(chains, {
        karura: ["wss://karura-rpc.dwellir.com"],
        acala: ["wss://acala-rpc.dwellir.com"],
      })
    );
    // and set apiProvider for each adapter
    await Promise.all(
      chains.map((chain) =>
        availableAdapters[chain].setApi(provider.getApi(chain))
      )
    );

    expect(connected.length).toEqual(chains.length);

    expect(connected[0]).toEqual(chains[0]);
    expect(connected[1]).toEqual(chains[1]);

    expect(provider.getApi(chains[0])).toBeDefined();
    expect(provider.getApi(chains[1])).toBeDefined();

    expect(
      (
        await firstValueFrom(provider.getApi(chains[0]).rpc.system.chain())
      ).toLowerCase()
    ).toEqual(chains[0]);
    expect(
      (
        await firstValueFrom(provider.getApi(chains[1]).rpc.system.chain())
      ).toLowerCase()
    ).toEqual(chains[1]);

    setTimeout(async () => {
      expect(
        (
          await provider.getApiPromise(chains[0]).rpc.system.chain()
        ).toLowerCase()
      ).toEqual(chains[0]);
      expect(
        (
          await provider.getApiPromise(chains[1]).rpc.system.chain()
        ).toLowerCase()
      ).toEqual(chains[1]);
    }, 1000);
  });

  test("3. token balance query & create tx should be ok", async () => {
    const chain: ChainName = "interlay";
    const toChain: ChainName = "polkadot";
    const token = "DOT";
    const testAddress = "23M5ttkmR6Kco7bReRDve6bQUSAcwqebatp3fWGJYb4hDSDJ";

    const balance = await firstValueFrom(
      availableAdapters[chain].subscribeTokenBalance(token, testAddress)
    );

    expect(balance.free.toNumber()).toBeGreaterThanOrEqual(0);
    expect(balance.available.toNumber()).toBeGreaterThanOrEqual(0);

    const available = availableAdapters[chain].subscribeInputConfigs({
      to: toChain,
      token,
      address: testAddress,
      signer: testAddress,
    });

    const inputConfig = await firstValueFrom(available);

    expect(BigInt(inputConfig.estimateFee)).toBeGreaterThanOrEqual(BigInt(0));
    expect(inputConfig.minInput.toNumber()).toBeGreaterThan(0);
    expect(inputConfig.maxInput.toNumber()).toBeLessThanOrEqual(
      balance.available.toNumber()
    );

    const tx = availableAdapters[chain].createTx({
      to: toChain,
      token,
      amount: FN.fromInner("10000000000", 10),
      address: testAddress,
      signer: testAddress,
    });

    expect(tx.args.length).toBeGreaterThan(1);
  });

  test("4. all transfer tx should be constructable", async () => {
    // kintsugi
    // printBidirectionalTxs("kintsugi", "kusama", "KSM");
    // printBidirectionalTxs("kintsugi", "statemine", "USDT");
    // printBidirectionalTxs("kintsugi", "heiko", "KBTC");
    // printBidirectionalTxs("kintsugi", "karura", "KINT");
    // printBidirectionalTxs("kintsugi", "karura", "KBTC");
    // printBidirectionalTxs("kintsugi", "karura", "LKSM");
    // printBidirectionalTxs("kintsugi", "bifrost", "VKSM");
    // printBidirectionalTxs("kusama", "statemine", "KSM");

    // interlay
    // printBidirectionalTxs("interlay", "polkadot", "DOT");
    printBidirectionalTxs("interlay", "phala", "PHA");
    printBidirectionalTxs("interlay", "phala", "INTR");
    printBidirectionalTxs("interlay", "phala", "IBTC");
    // printBidirectionalTxs("interlay", "statemint", "USDT");
    // printBidirectionalTxs("interlay", "hydra", "IBTC");
    // printBidirectionalTxs("interlay", "hydra", "INTR");
    // printBidirectionalTxs("interlay", "acala", "INTR");
    // printBidirectionalTxs("interlay", "acala", "IBTC");
    // printBidirectionalTxs("interlay", "parallel", "INTR");
    // printBidirectionalTxs("interlay", "parallel", "IBTC");
    // printBidirectionalTxs("interlay", "astar", "INTR");
    // printBidirectionalTxs("interlay", "astar", "IBTC");
    // printBidirectionalTxs("interlay", "bifrost_polkadot", "VDOT");
    // printBidirectionalTxs("polkadot", "statemint", "DOT");
  });

  test.skip("5. getNativeToken should work", () => {
    const testCases: [ChainName, String][] = [
      // kusama network
      ["kusama", "KSM"],
      ["kintsugi", "KINT"],
      ["karura", "KAR"],
      ["bifrost", "BNC"],
      ["heiko", "HKO"],
      ["statemine", "KSM"],
      // polkadot network
      ["polkadot", "DOT"],
      ["interlay", "INTR"],
      ["acala", "ACA"],
      ["hydra", "HDX"],
      ["parallel", "PARA"],
      ["bifrost_polkadot", "BNC"],
      ["statemint", "DOT"],
      ["phala", "PHA"],
    ];

    for (const [chainName, expectedNativeToken] of testCases) {
      const adapter = bridge.router.findAdapterByName(chainName);
      if (adapter == undefined) {
        fail(`Unable to find adapter for test case chain: ${chainName}`);
      }
      const actualToken = adapter.getNativeToken();
      expect(actualToken.symbol).toBe(expectedNativeToken);
    }
  });
});
