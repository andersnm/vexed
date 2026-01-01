import { InstanceMeta, TstExpression, TstInitializer, TstInstanceExpression, TstInstanceObject, TstScopedExpression, TstStatement, TstStatementExpression } from "./TstExpression.js";
import { TstRuntime } from "./TstRuntime.js";
import { TstScope } from "./visitors/TstReduceExpressionVisitor.js";

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

export interface TypeMethod {
    name: string;
    parameters: TypeParameter[];
    returnType: TypeDefinition;
    body: TstStatement[];
}

export class TypeDefinition {
    runtime: TstRuntime;
    name: string;
    extends?: TypeDefinition;
    extendsArguments?: TstExpression[];
    parameters: TypeParameter[];
    properties: TypeMember[];
    methods: TypeMethod[];
    initializers: TstInitializer[];  // TstVariable?? name+expr

    constructor(runtime: TstRuntime, name: string) {
        this.runtime = runtime;
        this.name = name;
        this.parameters = [];
        this.properties = [];
        this.methods = [];
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

    createValueInstance(value: any) {
        if (typeof value === "number") {
            return this.runtime.createInt(value);
        }

        if (typeof value === "string") {
            return this.runtime.createString(value);
        }

        if (typeof value === "boolean") {
            return this.runtime.createBool(value);
        }

        throw new Error("Dont know how to convert " + value + " to expression");
    }

    createValueExpression(value: any): TstExpression {
        const instance: TstInstanceObject = this.createValueInstance(value);
        return { exprType: "instance", instance } as TstInstanceExpression;
    }

    resolveOperator(lhs: TstInstanceObject, rhs: TstInstanceObject, operator: string): TstExpression {
        // Native objects can override, just use javascript conventions for now:
        const leftValue = lhs[InstanceMeta];
        const rightValue = rhs[InstanceMeta];

        switch (operator) {
            case "+":
                return this.createValueExpression(leftValue + rightValue);
            case "-":
                return this.createValueExpression(leftValue - rightValue);
            case "*":
                return this.createValueExpression(leftValue * rightValue);
            case "/":
                return this.createValueExpression(leftValue / rightValue);
            case "<":
                return this.createValueExpression(leftValue < rightValue);
            case "<=":
                return this.createValueExpression(leftValue <= rightValue);
            case ">":
                return this.createValueExpression(leftValue > rightValue);
            case ">=":
                return this.createValueExpression(leftValue >= rightValue);
        }

        throw new Error("Operator " + operator + " not supported for type " + this.name);
    }

    callFunction(method: TypeMethod, scope: TstScope): TstExpression | null {
        // Native objects can override
        return {
            exprType: "scoped",
            scope: scope,
            expr: {
                exprType: "statement",
                statements: method.body,
                returnType: method.returnType,
            } as TstStatementExpression
        } as TstScopedExpression;
    }

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

    getMethod(methodName: string): TypeMethod | null {
        const typeMethod = this.methods.find(p => p.name == methodName);
        if (typeMethod) {
            return typeMethod;
        }

        if (this.extends) {
            return this.extends.getMethod(methodName);
        }

        return null;
    }
}