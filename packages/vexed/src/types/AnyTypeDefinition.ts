import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class AnyTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "any", "<native>");
    }
}
