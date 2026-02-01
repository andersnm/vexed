import { TstRuntime, TstInstanceExpression } from "vexed";
import { IoTypeDefinition } from "./IoTypeDefinition.js";

export { IoTypeDefinition } from "./IoTypeDefinition.js";

export function registerNodeTypes(runtime: TstRuntime) {
    const ioType = new IoTypeDefinition(runtime);
    runtime.registerTypes([ioType]);

    // Register global "io" variable
    runtime.globalScope.variables.push({
        name: "io",
        value: {
            exprType: "instance",
            instance: ioType.createInstance([]),
        } as TstInstanceExpression,
        type: ioType,
    });
}
