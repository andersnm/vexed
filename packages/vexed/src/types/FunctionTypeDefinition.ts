import { TstExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export function getFunctionTypeName(returnType: TypeDefinition, parameterTypes: TypeDefinition[]): string {
    return returnType.name + "(" + parameterTypes.map(p => p.name).join(",") + ")";
}

export class FunctionTypeDefinition extends TypeDefinition {
    returnType: TypeDefinition;
    parameterTypes: TypeDefinition[];

    constructor(runtime: TstRuntime, returnType: TypeDefinition, parameterTypes: TypeDefinition[]) {
        super(runtime, getFunctionTypeName(returnType, parameterTypes));
        this.returnType = returnType;
        this.parameterTypes = parameterTypes;
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        const functionObject = {}; // scope? type?
        return this.runtime.createInstance(this, args, {}, true);
    }
}
