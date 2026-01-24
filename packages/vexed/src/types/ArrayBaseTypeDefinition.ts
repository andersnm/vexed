import { AstMethodDeclaration, AstParameter, AstPropertyDefinition } from "../AstProgram.js";
import { AstArrayType, AstFunctionType, AstIdentifierType } from "../AstType.js";
import { InstanceMeta, isFunctionReferenceExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstInstanceExpression, TstInstanceObject, TstScopedExpression, TstThisExpression, TstUnboundFunctionReferenceExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition, TypeMethod } from "../TstType.js";
import { getScopeParameter, TstScope } from "../visitors/TstReduceExpressionVisitor.js";

/**
 * NOTE: ArrayBaseTypeDefinition serves two purposes:
 * - When instantiated directly, corresponds to the Tst "any[]" type. This is the Tst base class of all array types.
 * - As the base class for ArrayTypeDefinition, which is used for types like string[].
 */
export class ArrayBaseTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name, "<native>");

        this.astNode = {
            type: "class",
            name: name,
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [
                {
                    type: "methodDeclaration",
                    name: "map",
                    genericParameters: ["T"],
                    parameters: [
                        {
                            name: "callback",
                            type: { 
                                type: "function",
                                functionParameters: [
                                    {
                                        type: "identifier",
                                        typeName: "any"
                                    } as AstIdentifierType
                                ],
                                functionReturnType: { 
                                    type: "identifier",
                                    typeName: "T"
                                } as AstIdentifierType,
                            } as AstFunctionType
                        } as AstParameter
                    ],
                    returnType: {
                        type: "array",
                        arrayItemType: {
                            type: "identifier",
                            typeName: "T"
                        } as AstIdentifierType
                    } as AstArrayType,
                    statementList: [],
                } as AstMethodDeclaration,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "length",
                    propertyType: { type: "identifier", typeName: "int" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
            ],
        };
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

    callFunction(method: TypeMethod, scope: TstScope): TstExpression | null {
        if (method.name === "map") {
            const callbackVariable = getScopeParameter(scope, "callback")
            if (!callbackVariable) {
                throw new Error("Array.map: callback parameter not found");
            }

            const callbackExpression = callbackVariable.value;
            if (!isFunctionReferenceExpression(callbackExpression)) {
                return null; // Signals to caller that we cannot proceed yet
            }

            // NOTE: callbackReturnType is the T in `map<T>(): T[]`
            const callbackReturnType = callbackExpression.method.returnType
            const actualType = this.runtime.getType(callbackReturnType.name + "[]");

            const array = scope.thisObject[InstanceMeta] as TstExpression[];

            // TODO: filter needs to work differently and require fully resolved, it generates more a statement list of ifs and push

            const items = array.map(item => ({
                exprType: "scoped",
                scope,
                expr: {
                    exprType: "functionCall",
                    callee: callbackExpression, 
                    args: [item],
                    returnType: callbackReturnType,
                    genericBindings: new Map<string, TypeDefinition>(), // should be resolved by now, altho should have it!
                } as TstFunctionCallExpression,
            } as TstScopedExpression));

            return {
                exprType: "instance",
                instance: this.runtime.createInstance(actualType, [], items)
            } as TstInstanceExpression;
        }

        return super.callFunction(method, scope);
    }

}

export class ArrayTypeDefinition extends ArrayBaseTypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name);

        this.astNode = {
            type: "class",
            name: name,
            parameters: [],
            extends: "any[]",
            extendsArguments: [],
            units: [],
        };
    }
}
