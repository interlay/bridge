/* eslint @typescript-eslint/no-var-requires: "off" */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* tslint:disable:no-unused-variable */
import { PolkadotAdapter } from "../src/adapters/polkadot";
import { InterlayAdapter } from "../src/adapters/interlay";
import { StatemintAdapter } from "../src/adapters/statemint";
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
        statemint: { adapter: new StatemintAdapter(), endpoints: ['ws://127.0.0.1:8001'] },
        polkadot: { adapter: new PolkadotAdapter(), endpoints: ['ws://127.0.0.1:8002'] },
    };

    // already tested in interlay-chopsticks-test
    const skipCases: Partial<RouterTestCase>[] = [
        {
            from: "interlay",
            to: "polkadot",
        },
        {
            from: "polkadot",
            to: "interlay",
        },
        // USDC and USDC test cases broken since latest changes
        // on statemint where those are converted to DOT before sending fees.
        {
            from: "interlay",
            to: "statemint",
            token: "USDC"
        },
        {
            from: "interlay",
            to: "statemint",
            token: "USDT"
        },
    ];

    await runTestCasesAndExit(adaptersEndpoints, true, skipCases);
}
