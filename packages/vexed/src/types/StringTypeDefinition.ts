import { AstPropertyDefinition } from "../AstProgram.js";
import { AstIdentifierType } from "../AstType.js";
import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

export class StringTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "string");

        this.astNode = {
            type: "class",
            name: "string",
            parameters: [ ],
            extends: "any",
            extendsArguments: [],
            units: [
                {
                    type: "propertyDefinition",
                    modifier: "public",
                    name: "length",
                    propertyType: { type: "identifier", typeName: "int" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
            ],
        };
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        // console.log("[StringTypeDefinition] Creating instance of type", this.name);
        return this.runtime.createInstance(this, args, "", false); // NOTE: if sealed, the "length" property doesn't reduce
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
