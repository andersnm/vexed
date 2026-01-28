import { TstExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class IntTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "int");

        this.astNode = {
            type: "class",
            name: "int",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [],
        };
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        // console.log("[IntTypeDefinition] Creating instance of type", this.name);
        return this.runtime.createInstance(this, args, 0, true);
    }
}
