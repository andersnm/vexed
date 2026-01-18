import { TstExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class BoolTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "bool", "<native>");
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        return this.runtime.createInstance(this, args, false, true);
    }
}
