import { firstValueFrom } from "rxjs";

import { ApiProvider } from "../api-provider";
import { chains, ChainName } from "../configs";
import { Bridge } from "..";
import { PolkadotAdapter, KusamaAdapter } from "./polkadot";
import { InterlayAdapter, KintsugiAdapter } from "./interlay";
import { StatemineAdapter, StatemintAdapter } from "./statemint";
import { AcalaAdapter, KaruraAdapter } from "./acala";
import { HeikoAdapter, ParallelAdapter } from "./parallel";
import { buildTestTxWithConfigData } from "../utils/shared-spec-methods";
import { BifrostKusamaAdapter } from "./bifrost";
import { HydraAdapter } from "./hydradx";
import { AstarAdapter } from "./astar";

// helper method for getting balances, configs, fees, and constructing xcm extrinsics
async function runMyTestSuite(testAccount: string, bridge: Bridge, from: ChainName, to: ChainName, token: string) {
  const {fromBalance, toBalance, inputConfig, destFee, tx} = await buildTestTxWithConfigData(testAccount, bridge, from, to, token);

  // from balance prints/checks
  console.log(
    `balance ${token}: free-${fromBalance.free.toNumber()} locked-${fromBalance.locked.toNumber()} available-${fromBalance.available.toNumber()}`
  );
  expect(fromBalance.available.toNumber()).toBeGreaterThanOrEqual(0);
  expect(fromBalance.free.toNumber()).toBeGreaterThanOrEqual(
    fromBalance.available.toNumber()
  );
  expect(fromBalance.free.toNumber()).toEqual(
    fromBalance.locked.add(fromBalance.available).toNumber()
  );
  
  // toBalance prints/checks
  console.log(
    `balance at destination ${token}: free-${toBalance.free.toNumber()} locked-${toBalance.locked.toNumber()} available-${toBalance.available.toNumber()}`
  );

  // inputConfig prints/checks
  console.log(
    `inputConfig: min-${inputConfig.minInput.toNumber()} max-${inputConfig.maxInput.toNumber()} ss58-${
      inputConfig.ss58Prefix
    } estimateFee-${inputConfig.estimateFee}`
  );
  expect(inputConfig.minInput.toNumber()).toBeGreaterThan(0);
  expect(inputConfig.maxInput.toNumber()).toBeLessThanOrEqual(
    fromBalance.available.toNumber()
  );

  // destFee prints/checks
  console.log(
    `destFee: fee-${destFee.balance.toNumber()} ${destFee.token}`
  );
  if (to === "polkadot") {
    expect(destFee.balance.toNumber()).toEqual(0.1);
  } else {
    expect(destFee.balance.toNumber()).toBeGreaterThan(0);
  }

  // tx method & params checks
  expect(tx.method.section).toEqual("xTokens");
  expect(tx.args.length).toEqual(4);
  expect(tx.method.method).toEqual("transfer");
};

describe.skip("interlay-adapter should work", () => {
  jest.setTimeout(30000);

  const testAccount = "wd8h1Mu8rsZhiKN5zZUWuz2gtr51JajTDCtbdkzoXbMZiQAut";
  const provider = new ApiProvider();

  async function connect(chains: ChainName[]) {
    return firstValueFrom(provider.connectFromChain(chains, undefined));
  }

  test("connect kintsugi to do xcm", async () => {
    const fromChains = ["kintsugi", "karura", "heiko", "bifrost", "statemine", "kusama"] as ChainName[];

    await connect(fromChains);

    const kintsugi = new KintsugiAdapter();
    const karura = new KaruraAdapter();
    const heiko = new HeikoAdapter();
    const bifrost = new BifrostKusamaAdapter();
    const statemine = new StatemineAdapter();
    const kusama = new KusamaAdapter();

    await kintsugi.setApi(provider.getApi(fromChains[0]));
    await karura.setApi(provider.getApi(fromChains[1]));
    await heiko.setApi(provider.getApi(fromChains[2]));
    await bifrost.setApi(provider.getApi(fromChains[3]));
    await statemine.setApi(provider.getApi(fromChains[4]));
    await kusama.setApi(provider.getApi(fromChains[5]));

    const bridge = new Bridge({
      adapters: [kintsugi, karura, heiko, bifrost, statemine, kusama],
    });

    // expected destinations: 1 (heiko, karura)
    expect(
      bridge.router.getDestinationChains({
        from: chains.kintsugi,
        token: "KINT",
      }).length
    ).toEqual(2);

    // expected destinations: 2 (heiko and karura)
    expect(
      bridge.router.getDestinationChains({
        from: chains.kintsugi,
        token: "KBTC",
      }).length
    ).toEqual(2);

    expect(
      bridge.router.getDestinationChains({
        from: chains.kintsugi,
        token: "LKSM",
      }).length
    ).toEqual(1);

    expect(
      bridge.router.getDestinationChains({
        from: chains.kintsugi,
        token: "VKSM",
      }).length
    ).toEqual(1);

    
    await runMyTestSuite(testAccount, bridge, "kintsugi", "heiko", "KBTC");
    await runMyTestSuite(testAccount, bridge, "kintsugi", "karura", "KINT");
    await runMyTestSuite(testAccount, bridge, "kintsugi", "karura", "KBTC");
    await runMyTestSuite(testAccount, bridge, "kintsugi", "karura", "LKSM");
    await runMyTestSuite(testAccount, bridge, "kintsugi", "bifrost", "VKSM");
    await runMyTestSuite(testAccount, bridge, "kintsugi", "statemine", "USDT");
    await runMyTestSuite(testAccount, bridge, "kintsugi", "kusama", "KSM");

  });

  test("connect interlay to do xcm", async () => {
    const fromChains = ["interlay", "polkadot", "statemint", "hydra", "acala", "parallel", "astar"] as ChainName[];

    await connect(fromChains);

    const interlay = new InterlayAdapter();
    const polkadot = new PolkadotAdapter();
    const statemint = new StatemintAdapter();
    const hydra = new HydraAdapter();

    const acala = new AcalaAdapter();
    const parallel = new ParallelAdapter();
    const astar = new AstarAdapter();

    await Promise.all([
      interlay.setApi(provider.getApi(fromChains[0])),
      polkadot.setApi(provider.getApi(fromChains[1])),
      statemint.setApi(provider.getApi(fromChains[2])),
      hydra.setApi(provider.getApi(fromChains[3])),
      acala.setApi(provider.getApi(fromChains[4])),
      parallel.setApi(provider.getApi(fromChains[5])),
      astar.setApi(provider.getApi(fromChains[6]))

    ]);

    const bridge = new Bridge({
      adapters: [interlay, polkadot, statemint, hydra, acala, parallel, astar],
    });

    expect(
      bridge.router.getDestinationChains({
        from: chains.interlay,
        token: "DOT",
      }).length
    ).toEqual(1);

    expect(
      bridge.router.getDestinationChains({
        from: chains.interlay,
        token: "USDT",
      }).length
    ).toEqual(1);

    expect(
      bridge.router.getDestinationChains({
        from: chains.interlay,
        token: "IBTC",
      }).length
    ).toEqual(4);

    expect(
      bridge.router.getDestinationChains({
        from: chains.interlay,
        token: "INTR",
      }).length
    ).toEqual(3);

    await runMyTestSuite(testAccount, bridge, "interlay", "polkadot", "DOT");
    await runMyTestSuite(testAccount, bridge, "interlay", "statemint", "USDT");
    await runMyTestSuite(testAccount, bridge, "interlay", "hydra", "IBTC");
    await runMyTestSuite(testAccount, bridge, "interlay", "acala", "IBTC");
    await runMyTestSuite(testAccount, bridge, "interlay", "acala", "INTR");
    await runMyTestSuite(testAccount, bridge, "interlay", "parallel", "IBTC");
    await runMyTestSuite(testAccount, bridge, "interlay", "parallel", "INTR");
    await runMyTestSuite(testAccount, bridge, "interlay", "astar", "IBTC");
    await runMyTestSuite(testAccount, bridge, "interlay", "astar", "INTR");
  });
});
