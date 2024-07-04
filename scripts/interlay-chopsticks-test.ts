/* eslint @typescript-eslint/no-var-requires: "off" */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* tslint:disable:no-unused-variable */
import { PolkadotAdapter } from "../src/adapters/polkadot";
import { InterlayAdapter } from "../src/adapters/interlay";
import { HydraAdapter } from "../src/adapters/hydradx";
import { AcalaAdapter } from "../src/adapters/acala";
import { AstarAdapter } from "../src/adapters/astar";
import { BifrostPolkadotAdapter } from "../src/adapters/bifrost";
import { PhalaAdapter } from "../src/adapters/phala";
import { BaseCrossChainAdapter } from "../src/base-chain-adapter";
import { RouterTestCase, runTestCasesAndExit } from "./chopsticks-test";

main().catch((err) => {
    console.log("Error thrown by script:");
    console.log(err);
    process.exit(-1);
});

async function main(): Promise<void> {
    const adaptersEndpoints : Record<string, { adapter: BaseCrossChainAdapter, endpoints: Array<string> }> = {
        // make sure endpoints are aligned with the ports spun up by chopsticks config in
        // .github/workflows/xcm-tests.yml
        // reminder: parachains get ports in oder of arguments, starting with 8000 and incremented for each following one; 
        //           relaychain gets its port last after all parachains.
        interlay: { adapter: new InterlayAdapter(), endpoints: ['ws://127.0.0.1:8000'] },
        hydra: { adapter: new HydraAdapter(), endpoints: ['ws://127.0.0.1:8001'] },
        acala: { adapter: new AcalaAdapter(), endpoints: ['ws://127.0.0.1:8002'] },
        astar: { adapter: new AstarAdapter(), endpoints: ['ws://127.0.0.1:8003'] },
        bifrost_polkadot: { adapter: new BifrostPolkadotAdapter(), endpoints: ['ws://127.0.0.1:8004']},
        phala: { adapter: new PhalaAdapter(), endpoints: ['ws://127.0.0.1:8005']},
        polkadot: { adapter: new PolkadotAdapter(), endpoints: ['ws://127.0.0.1:8006'] },
    };

    const skipCases: Partial<RouterTestCase>[] = [
        // tests to acala currently broken
        {
            from: "interlay",
            to: "acala",
        },
    ];

    await runTestCasesAndExit(adaptersEndpoints, false, skipCases);
}