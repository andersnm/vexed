#!/usr/bin/env node
import { jsonCommand } from "./jsonCommand.js";
import { astCommand } from "./astCommand.js";
import { ScriptError } from "vexed";

// Commands:
//   - json: evaluate -> output state as JSON
//   - diff: evaluate -> diff -> output diff as JSON
//   - plan: evaluate -> diff -> plan -> output plan as JSON

// "diff" produces a diff between the source code and the provider-supplied remote state.
// Evaluates Vexed scripts with provider types, fetches remote state from providers.
// The output is a serialized representation of the unresolved TST graph, amended with annotations
// from the remote state where exists.

// "plan" produces a migration plan to reconcile the output from the diff step with the remote state,

function helpCommand(args: string[]) {
    console.log("Usage: vexed-cli <command> [options]");
    console.log("Commands:");
    console.log("  json <file>        Evaluate Vexed script and output JSON representation");
    console.log("  ast  <file>        Evaluate Vexed script and output AST representation");
}

async function main() {

    const positionals = process.argv.slice(2);

    if (positionals[0] === "json") {
        await jsonCommand(positionals.slice(1));
        return;
    }

    if (positionals[0] === "ast") {
        await astCommand(positionals.slice(1));
        return;
    }

    if (positionals[0] === "help") {
        helpCommand(positionals.slice(1));
        return;
    }

    helpCommand([]);
}

Error.stackTraceLimit = Infinity;

main().catch(err => {
    if (err instanceof ScriptError) {
        console.error(err.formatForVSCode());
        process.exit(1);
    }
    console.error("Fatal error:", err);
    process.exit(1);
});
