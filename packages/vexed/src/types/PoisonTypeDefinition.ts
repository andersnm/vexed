import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class PoisonTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name);

        this.astNode = {
            type: "class",
            name: name,
            parameters: [],
            units: [],
            extends: undefined,
            extendsArguments: undefined,
        };
    }
}
