#!/usr/bin/env node
import { Parser, TstBuilder, printObject, TstRuntime } from "vexed";
import { promises as fs } from "fs";
import { parseArgs } from "node:util";

// Commands:
//   - json: evaluate -> output state as JSON
//   - diff: evaluate -> diff -> output diff as JSON
//   - plan: evaluate -> diff -> plan -> output plan as JSON

// "json" is a general-purpose "Vexed Configuration Language" mode.
// Evaluates plain Vexed scripts without any provider types nor remote state.
// The output is the evaluated JSON representation of the Vexed program.
// Reports errors if any unresolved references remain, unless using --force.

// "diff" produces a diff between the source code and the provider-supplied remote state.
// Evaluates Vexed scripts with provider types, fetches remote state from providers.
// The output is a serialized representation of the unresolved TST graph, amended with annotations
// from the remote state where exists.

// "plan" produces a migration plan to reconcile the output from the diff step with the remote state,

export async function jsonCommand(args: string[]) {

    const { values, positionals } = parseArgs({
        options: {
            force: { type: "boolean", short: "f" }
        }, 
        allowPositionals: true,
        args 
    });

    const fileName = positionals[0];
    const script = await fs.readFile(fileName, "utf-8");

    const parser = new Parser();
    const program = parser.parse(script, fileName);
    if (!program) {
        return;
    }

    const runtime = new TstRuntime();
    const resolver = new TstBuilder(runtime);
    resolver.resolveProgram(program);

    const main = runtime.getType("Main");
    if (!main) {
        throw new Error("No Main class found");
    }

    const instance = main.createInstance([]);
    console.log("Created main instance: ", printObject(instance));

    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);

    console.log("Print main instance:", printObject(instance));
}

function helpCommand(args: string[]) {
    console.log("Usage: vexed-cli <command> [options]");
    console.log("Commands:");
    console.log("  json <file>       Evaluate Vexed script and output JSON representation");
}

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true
    });

    if (positionals[0] === "json") {
        await jsonCommand(positionals.slice(1));
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
