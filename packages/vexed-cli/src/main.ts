#!/usr/bin/env node
import { jsonCommand } from "./jsonCommand.js";
import { astCommand } from "./astCommand.js";
import { diffCommand } from "./diffCommand.js";
import { execCommand } from "./execCommand.js";

// Commands:
//   - json: evaluate -> output state as JSON
//   - diff: evaluate -> diff -> output diff as JSON
//   - exec: execute a diff JSON file to apply changes

// "diff" produces a diff between the source code and the provider-supplied remote state.
// Evaluates Vexed scripts with provider types, fetches remote state from providers.
// The output is a serialized representation of the unresolved TST graph, amended with annotations
// from the remote state where exists.

// "exec" runs a diff JSON and applies it to the remote provider.
// It implements the VM that diffs rely on to replay computations etc.

function helpCommand(args: string[]) {
    console.log("Usage: vexed-cli <command> [options]");
    console.log("Commands:");
    console.log("  json <file>        Evaluate Vexed script and output JSON representation");
    console.log("  ast  <file>        Evaluate Vexed script and output AST representation");
    console.log("  diff <file>        Evaluate Vexed script and output infrastructure diff");
    console.log("  exec <file>        Execute diff JSON to apply infrastructure changes");
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

    if (positionals[0] === "diff") {
        await diffCommand(positionals.slice(1));
        return;
    }

    if (positionals[0] === "exec") {
        await execCommand(positionals.slice(1));
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
    console.error("Fatal error:", err);
    process.exit(1);
});
