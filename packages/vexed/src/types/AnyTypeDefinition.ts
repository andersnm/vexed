import { AstClass } from "../AstProgram.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class AnyTypeDefinition extends TypeDefinition {

    constructor(runtime: TstRuntime) {
        super(runtime, "any");

        this.astNode = {
            type: "class",
            name: "any",
            parameters: [],
            units: [],
            extends: undefined,
            extendsArguments: undefined,
        };
    }
}
