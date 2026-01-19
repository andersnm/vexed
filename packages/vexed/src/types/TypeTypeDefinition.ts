import path from "path";
import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { AstPropertyDefinition } from "../AstProgram.js";

export class TypeTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Type", "<native>");

        this.astNode = {
            type: "class",
            name: "Type",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [
                {
                    type: "propertyDefinition",
                    modifier: "public",
                    name: "name",
                    propertyType: { type: "identifier", typeName: "string" },
                    argument: null,
                } as AstPropertyDefinition,
                {
                    type: "propertyDefinition",
                    modifier: "public",
                    name: "scriptPath",
                    propertyType: { type: "identifier", typeName: "string" },
                    argument: null,
                } as AstPropertyDefinition,
            ],
        };
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
