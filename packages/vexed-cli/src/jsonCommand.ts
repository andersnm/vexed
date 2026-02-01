import { promises as fs } from "fs";
import { parseArgs } from "node:util";
import { printJsonObject, printObject, TstInstanceObject, TstRuntime } from "vexed";
import { ScriptError } from "vexed/dist/ScriptError.js";
import { registerNodeTypes } from "vexed-nodejs";

// "json" is a general-purpose "Vexed Configuration Language" mode.
// Evaluates plain Vexed scripts without any provider types nor remote state.
// The output is the evaluated JSON representation of the Vexed program.
// Reports errors if any unresolved references remain, unless using --force.

export async function jsonCommand(args: string[]) {

    const { values, positionals } = parseArgs({
        options: {
            force: { type: "boolean", short: "f" },
            verbose: { type: "boolean", short: "v" }
        }, 
        allowPositionals: true,
        args 
    });

    const fileName = positionals[0];
    const script = await fs.readFile(fileName, "utf-8");

    const runtime = new TstRuntime();
    registerNodeTypes(runtime);
    runtime.verbose = values.verbose || false;

    let instance: TstInstanceObject | null = null;
    try {
        runtime.loadScript(script, fileName);

        const main = runtime.tryGetType("Main");
        if (!main) {
            throw new ScriptError("Type error", [ { message: "Main class entrypoint not found", location: { fileName, line: 1, column: 1, startOffset: 0, endOffset: 0, image: "" }}]);
        }

        instance = main.createInstance([]);

        if (values.verbose) console.log("Created main instance: ", printObject(instance));

        await runtime.reduceInstance(instance);
    } catch (err) {
        if (err instanceof ScriptError) {
            for (const error of err.errors) {
                console.error(`${error.location.fileName}:${error.location.line}:${error.location.column} - error: ${error.message}`);
            }

            if (!instance || !values.force) {
                return 1;
            }

        } else {
            throw err;
        }
    }

    const jsonOutput = printJsonObject(instance, values.force || false);
    console.log(JSON.stringify(jsonOutput, null, 2));

    return 0;
}
