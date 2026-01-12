import { promises as fs } from "fs";
import { parseArgs } from "node:util";
import { printJsonObject, printObject, TstRuntime } from "vexed";
import { registerDigitalOcean } from "./digitalocean.js";

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
    runtime.verbose = values.verbose || false;

    registerDigitalOcean(runtime);

    runtime.loadScript(script, fileName);

    const main = runtime.getType("Main");
    if (!main) {
        throw new Error("No Main class found");
    }

    const instance = main.createInstance([])!;

    if (values.verbose) console.log("Created main instance: ", printObject(instance));

    await runtime.reduceInstance(instance);

    const jsonOutput = printJsonObject(instance, values.force || false);
    console.log(JSON.stringify(jsonOutput, null, 2));
}
