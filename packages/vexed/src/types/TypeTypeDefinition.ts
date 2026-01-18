import path from "path";
import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class TypeTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Type", "<native>");
    }

    initializeType(): void {
        this.properties.push({
            modifier: "public",
            name: "name",
            type: this.runtime.getType("string"),
        });

        this.properties.push({
            modifier: "public",
            name: "scriptPath",
            type: this.runtime.getType("string"),
        });
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        if (propertyName === "name") {
            const type = instance[InstanceMeta] as TypeDefinition;
            return { exprType: "instance", instance: this.runtime.createString(type.name) } as TstInstanceExpression;
        }

        if (propertyName === "scriptPath") {
            const type = instance[InstanceMeta] as TypeDefinition;

            const scriptPath = path.dirname(type.fileName);
            return { exprType: "instance", instance: this.runtime.createString(scriptPath) } as TstInstanceExpression;
        }

        throw new Error("Property not implemented: " + propertyName);
    }
}
