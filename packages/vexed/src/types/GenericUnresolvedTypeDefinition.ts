import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class GenericUnresolvedTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name);
    }
}
