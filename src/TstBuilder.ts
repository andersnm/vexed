import { AstExpression, AstIdentifierExpression, AstMemberExpression, AstProgram, isAstArrayLiteral, isAstBinaryExpression, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIndexExpression, isAstIntegerLiteral, isAstMember, isAstStringLiteral, isClass, isMethodDeclaration, isPropertyDefinition, isPropertyStatement } from "./AstProgram.js";
import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIdentifierExpression, TstIndexExpression, TstInstanceExpression, TstMemberExpression, TstNewExpression, TstParameterExpression, TstThisExpression } from "./TstExpression.js";
import { TypeDefinition } from "./TstType.js";
import { TstRuntime } from "./TstRuntime.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";

// There is no visitor for Ast types, it is only traversed once during conversion to Tst types.

// export function getProperty(type: TypeDefinition, propertyName: string): TypeMember | null {
//     const typeProperty = type.properties.find(p => p.name == propertyName);
//     if (typeProperty) {
//         return typeProperty;
//     }

//     if (type.extends) {
//         return getProperty(type.extends, propertyName);
//     }

//     return null;
// }

export class TstBuilder {
    private runtime: TstRuntime;

    constructor(runtime: TstRuntime) {
        this.runtime = runtime;
    }

    resolveExpression(expr: AstExpression, thisType: TypeDefinition): TstExpression {
        if (isAstStringLiteral(expr)) {
            const stringType = this.runtime.getType("string");
            const stringObject = stringType.createInstance([]);
            stringObject[InstanceMeta] = expr.value;

            return {
                exprType: "instance",
                instance: stringObject
            } as TstInstanceExpression;
        }

        if (isAstIntegerLiteral(expr)) {
            return {
                exprType: "instance",
                instance: this.runtime.createInt(parseInt(expr.value))
            } as TstInstanceExpression;
        }

        if (isAstDecimalLiteral(expr)) {
            const decimalType = this.runtime.getType("decimal");
            const decimalObject = decimalType.createInstance([]);
            decimalObject[InstanceMeta] = parseFloat(expr.value);
            return {
                exprType: "instance",
                instance: decimalObject
            } as TstInstanceExpression;
        }

        if (isAstFunctionCall(expr)) {
            if (isAstIdentifier(expr.callee)) {
                const functionName = expr.callee.value;
                const typeIfNewExpression = this.runtime.getType(functionName);
                if (!typeIfNewExpression) {
                    throw new Error("Unknown type: " + functionName);
                }

                return { exprType: "new", type: typeIfNewExpression, args: expr.args.map(arg => this.resolveExpression(arg, thisType)) } as TstNewExpression;
            }

            if (isAstMember(expr.callee)) {
                const functionName = expr.callee.property;
                const object = this.resolveExpression(expr.callee.object, thisType) as TstMemberExpression;
                const calleeType = this.runtime.getExpressionType(object, thisType);
                if (!calleeType) {
                    throw new Error(`Could not find type for member ${functionName}`);
                }

                const method = calleeType.methods.find(m => m.name === functionName);
                if (!method) {
                    throw new Error(`Method ${functionName} not found on type ${calleeType.name}`);
                }

                return { exprType: "functionCall", object, method, args: expr.args.map(arg => this.resolveExpression(arg, thisType)) } as TstFunctionCallExpression;
            }

            throw new Error("Function calls not implemented yet: " + expr.callee + " " + expr.callee.exprType);
        }

        if (isAstIdentifier(expr)) {
            // TODO: classify all identifiers as parameter, type, function, variable

            if (expr.value === "this") {
                return { exprType: "this" } as TstThisExpression;
            } else {
                // const pi = parameters.find(p => p.name == expr.value);
                const pi = thisType.parameters.find(p => p.name == expr.value);
                if (pi) {
                    return { exprType: "parameter", name: expr.value, type: pi.type } as TstParameterExpression;
                }

                return { exprType: "identifier", value: expr.value } as TstIdentifierExpression;
            }
        }

        if (isAstMember(expr)) {
            return { exprType: "member", object: this.resolveExpression(expr.object, thisType), property: expr.property } as TstMemberExpression;
        }

        if (isAstArrayLiteral(expr)) {
            const elements = expr.elements.map(e => this.resolveExpression(e, thisType));
            const visitor = new TstExpressionTypeVisitor(this.runtime, thisType)
            const arrayType = this.runtime.findArrayType(visitor, elements);
            if (!arrayType) {
                throw new Error("Could not determine array type for elements");
            }

            // console.log("Literal array constructed at resolve time with type", arrayType?.name || "unknown");
            const arrayInstance = arrayType.createInstance([]);
            arrayInstance![InstanceMeta].push(...elements);

            return {
                exprType: "instance",
                instance: arrayInstance
            } as TstInstanceExpression;
        }

        if (isAstIndexExpression(expr)) {
            const objectExpr = this.resolveExpression(expr.object, thisType);
            const indexExpr = this.resolveExpression(expr.index, thisType);
            return {
                exprType: "index",
                object: objectExpr,
                index: indexExpr
            } as TstIndexExpression;
        }

        if (isAstBinaryExpression(expr)) {
            return {
                exprType: "binary",
                left: this.resolveExpression(expr.lhs, thisType),
                right: this.resolveExpression(expr.rhs, thisType),
                operator: expr.operator
            } as TstBinaryExpression;
        }

        throw new Error(`Unsupported expression type ${expr.exprType} in AstTypeResolver`);
    }

    resolveProgram(visited: AstProgram) {

        // Pass 1: Create new half-constructed types
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                let type = this.runtime.tryGetType(programUnit.name);
                if (!type) {
                    type = new TypeDefinition(this.runtime, programUnit.name);
                    this.runtime.types.push(type);
                }
            }
        }

        // Pass 1.5: Collect array types
        // TODO: Also collect from array literals f.ex "([[1,2],[3,4]])[0]" requires int[][] internally
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                for (let unit of programUnit.units) {
                    if (isPropertyDefinition(unit)) {
                        if (unit.propertyType.endsWith("[]")) {
                            this.runtime.createArrayType(unit.propertyType);
                        }
                    }
                }
            }
        }

        // Pass 2: Resolve extends, parameters and property types
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);

                if (programUnit.extends) {
                    const baseType = this.runtime.getType(programUnit.extends);

                    type.extends = baseType;
                    // type.extendsArguments -> evaluate expressions after instance is constructed
                }

                for (let parameter of programUnit.parameters) {
                    const parameterType = this.runtime.getType(parameter.type);

                    type.parameters.push({
                        name: parameter.name,
                        type: parameterType
                    });
                }

            }
        }

        // Pass 3: Resolve symbols in initializers and extends-arguments, AstExpression -> TstExpression
        for (let programUnit of visited.programUnits) {
                // the properties in the class - derives from extends - only add explicit public/private, and we have their types now. but its not parsed yet
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);
                if (!type) {
                    throw new Error("Type should have been created in previous pass");
                }

                if (programUnit.extends && programUnit.extendsArguments) {
                    type.extendsArguments = programUnit.extendsArguments.map(arg => this.resolveExpression(arg, type));
                }

                for (let unit of programUnit.units) {
                    if (isPropertyStatement(unit)) {
                        // TODO: resolve with a target type? then we can deduce type for empty array literal "[]"
                        type.initializers.push({ name: unit.name, argument: this.resolveExpression(unit.argument, type) })
                    } else
                    if (isPropertyDefinition(unit)) {
                        const propertyType = this.runtime.getType(unit.propertyType);
                        if (!propertyType) {
                            throw new Error(`Could not find type ${unit.propertyType} for property ${unit.name} of type ${programUnit.name}`);
                        }

                        type.properties.push({
                            modifier: unit.modifier,
                            name: unit.name,
                            type: propertyType,
                            initializer: unit.argument ? this.resolveExpression(unit.argument, type) : undefined,
                        });
                    } else if (isMethodDeclaration(unit)) {
                        const methodType = this.runtime.getType(unit.returnType);
                        if (!methodType) {
                            throw new Error(`Could not find type ${unit.returnType} for method ${unit.name} of type ${programUnit.name}`);
                        }

                        type.methods.push({
                            name: unit.name,
                            returnType: methodType,
                            parameters: unit.parameters.map(param => ({
                                name: param.name,
                                type: this.runtime.getType(param.type)
                            }))
                        });
                    }
                }
            }
        }
    }
}
