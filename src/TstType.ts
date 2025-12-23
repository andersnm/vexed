import { TstExpression, TstInitializer, TstInstanceObject } from "./TstExpression.js";
import { TstRuntime } from "./TstRuntime.js";

export interface TypeMember {
    modifier: string;
    name: string;
    type: TypeDefinition;
    arrayType?: TypeDefinition;
    initializer?: TstExpression;
}

export interface TypeParameter {
    name: string;
    type: TypeDefinition;
}

export class TypeDefinition {
    runtime: TstRuntime;
    name: string;
    extends?: TypeDefinition;
    extendsArguments?: TstExpression[];
    parameters: TypeParameter[];
    properties: TypeMember[];
    initializers: TstInitializer[];  // TstVariable?? name+expr

    constructor(runtime: TstRuntime, name: string) {
        this.runtime = runtime;
        this.name = name;
        this.parameters = [];
        this.properties = [];
        this.initializers = [];
    }

    initializeType() {
        // override to setup properties, initializers, etc
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        // Native object can override and call createInstance with userData
        return this.runtime.createInstance(this, args)
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        // Native objects can override
        const property = instance[propertyName];
        return property || null;
    }

    resolveIndex(instance: TstInstanceObject, index: number): TstExpression | null {
        // Native objects can override
        throw new Error("Index resolution not implemented for type: " + this.name);
    }

    // callFunction(instance: TstInstanceObject, functionName: string, args: TstExpression[]): TstExpression | null {
    //     return null;
    // }

    getProperty(propertyName: string): TypeMember | null {
        const typeProperty = this.properties.find(p => p.name == propertyName);
        if (typeProperty) {
            return typeProperty;
        }

        if (this.extends) {
            return this.extends.getProperty(propertyName);
        }

        return null;
    }
}