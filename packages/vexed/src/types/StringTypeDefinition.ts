import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class StringTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "string", "<native>");
    }

    initializeType() {
        this.properties.push({
            modifier: "public",
            name: "length",
            type: this.runtime.getType("int"),
        });
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        // console.log("[StringTypeDefinition] Creating instance of type", this.name);
        return this.runtime.createInstance(this, args, "", true);
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        // console.log("[StringTypeDefinition] Resolving", propertyName);
        if (propertyName === "length") {
            const stringValue = instance[InstanceMeta] as string;
            return { exprType: "instance", instance: this.runtime.createInt(stringValue.length) } as TstInstanceExpression;
        }

        return null;
    }
}
