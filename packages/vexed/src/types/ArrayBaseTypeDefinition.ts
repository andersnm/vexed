import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

/**
 * NOTE: ArrayBaseTypeDefinition serves two purposes:
 * - When instantiated directly, corresponds to the Tst "any[]" type. This is the Tst base class of all array types.
 * - As the base class for ArrayTypeDefinition, which is used for types like string[].
 */
export class ArrayBaseTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name, "<native>");
    }

    initializeType() {
        this.properties.push({
            modifier: "public",
            name: "length",
            type: this.runtime.getType("int"),
        });
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        // console.log("[ArrayBaseTypeDefinition] Creating instance of type", this.name);
        return this.runtime.createInstance(this, args, []);
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        // console.log("[ArrayBaseTypeDefinition] Resolving", propertyName);
        if (propertyName === "length") {
            const arrayValue = instance[InstanceMeta] as any[];
            return { exprType: "instance", instance: this.runtime.createInt(arrayValue.length) } as TstInstanceExpression;
        }

        return null;
    }

    resolveIndex(instance: TstInstanceObject, index: number): TstExpression | null {
        const arrayValue = instance[InstanceMeta] as any[];
        return arrayValue[index] || null;
    }
}

export class ArrayTypeDefinition extends ArrayBaseTypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name);
    }

    initializeType() {
        // Do not call super.initializeType(). It adds
        this.extends = this.runtime.getType("any[]");
    }
}
