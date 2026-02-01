import { promises as fs } from "fs";
import { parseArgs } from "node:util";
import { printObject, TstRuntime } from "vexed";

// "ast" is a debug mode.

export async function astCommand(args: string[]) {

    const { values, positionals } = parseArgs({
        options: {
            force: { type: "boolean", short: "f" },
            verbose: { type: "boolean", short: "v" },
            steps: { type: "string", short: "s" } 
        }, 
        allowPositionals: true,
        args 
    });

    const fileName = positionals[0];
    const script = await fs.readFile(fileName, "utf-8");

    const runtime = new TstRuntime();
    runtime.verbose = values.verbose || false;
    runtime.maxSteps = values.steps ? parseInt(values.steps) : runtime.maxSteps;

    runtime.loadScript(script, fileName);

    const main = runtime.getType("Main");
    if (!main) {
        throw new Error("No Main class found");
    }

    const instance = main.createInstance([]);

    if (values.verbose) console.log("Created main instance: ", printObject(instance));

    await runtime.reduceInstance(instance);

    console.log(printObject(instance));
}
