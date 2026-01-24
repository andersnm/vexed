import { AstClass, AstExpression, AstMethodDeclaration, AstProgram, AstStatement, formatAstTypeName, isAstArrayLiteral, isAstBinaryExpression, isAstBooleanLiteral, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIfStatement, isAstIndexExpression, isAstIntegerLiteral, isAstLocalVarAssignment, isAstLocalVarDeclaration, isAstMember, isAstReturnStatement, isAstStringLiteral, isAstUnaryExpression, isClass, isMethodDeclaration, isPropertyDefinition, isPropertyStatement } from "./AstProgram.js";
import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstStatement, TstThisExpression, TstUnaryExpression, TstUnboundFunctionReferenceExpression, TstVariable, TstVariableExpression } from "./TstExpression.js";
import { TypeDefinition, TypeMethod, TypeParameter } from "./TstType.js";
import { TstRuntime } from "./TstRuntime.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";
import { AstIdentifierType, AstType, isAstArrayType, isAstFunctionType, isAstIdentifierType } from "./AstType.js";
import { FunctionTypeDefinition, getFunctionTypeName } from "./types/FunctionTypeDefinition.js";
import { ArrayTypeDefinition } from "./types/ArrayBaseTypeDefinition.js";
import { GenericUnresolvedTypeDefinition } from "./types/GenericUnresolvedTypeDefinition.js";
import { AstVisitor } from "./AstVisitor.js";

export class TstBuilder {
    private runtime: TstRuntime;

    constructor(runtime: TstRuntime) {
        this.runtime = runtime;
    }

    collectType(type: AstType, classDef: AstClass, method: AstMethodDeclaration | null) {
        const typeName = formatAstTypeName(type, classDef, method);

        if (isAstArrayType(type)) {
            this.collectType(type.arrayItemType, classDef, method);
            const elementTypeName = formatAstTypeName(type.arrayItemType, classDef, method);
            const elementType = this.runtime.getType(elementTypeName);

            this.createArrayType(typeName, elementType);
        }

        if (isAstFunctionType(type)) {
            this.collectType(type.functionReturnType, classDef, method);

            for (let paramType of type.functionParameters) {
                this.collectType(paramType, classDef, method);
            }

            const returnType = this.runtime.getType(formatAstTypeName(type.functionReturnType, classDef, method));
            const parameterTypes: TypeDefinition[] = type.functionParameters.map(paramType => this.runtime.getType(formatAstTypeName(paramType, classDef, method)));
            this.createFunctionType(parameterTypes, returnType);
        }

        if (isAstIdentifierType(type)) {
            const methodGenericParameter = method?.genericParameters?.find(p => p === type.typeName);
            if (methodGenericParameter) {
                this.createGenericUnresolvedType(typeName);
            }
        }
    }

    createArrayType(arrayTypeName: string, elementType: TypeDefinition) {
        if (this.runtime.tryGetType(arrayTypeName)) {
            return;
        }

        const specializedArrayType = new ArrayTypeDefinition(this.runtime, arrayTypeName, elementType);
        this.runtime.registerTypes([specializedArrayType]);
    }

    createFunctionType(parameterTypes: TypeDefinition[], returnType: TypeDefinition) {
        const functionTypeName = getFunctionTypeName(returnType, parameterTypes);
        if (this.runtime.tryGetType(functionTypeName)) {
            return;
        }

        // console.log("Creating function type: ", functionTypeName);
        const functionType = new FunctionTypeDefinition(this.runtime, returnType, parameterTypes);
        this.runtime.registerTypes([functionType]);
    }

    createGenericUnresolvedType(name: string): TypeDefinition {
        const type = this.runtime.tryGetType(name);
        if (type) {
            return type;
        }

        const genericType = new GenericUnresolvedTypeDefinition(this.runtime, name);
        this.runtime.registerTypes([genericType]);
        return genericType;
    }

    resolveProgram(visited: AstProgram) {

        // Pass 1: Create new half-constructed types
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                let type = this.runtime.tryGetType(programUnit.name);
                if (!type) {
                    type = new TypeDefinition(this.runtime, programUnit.name, visited.fileName);
                    this.runtime.types.push(type);
                }
            }
        }

        // Pass 1.5: Collect array and function types
        // TODO: Also collect from array literals f.ex "([[1,2],[3,4]])[0]" requires int[][] internally
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);

                for (let unit of programUnit.units) {
                    if (isPropertyDefinition(unit)) {
                        this.collectType(unit.propertyType, programUnit, null);
                    }

                    if (isMethodDeclaration(unit)) {

                        if (unit.genericParameters) {
                            for (let genericParameter of unit.genericParameters) {
                                this.collectType({ type: "identifier", typeName: genericParameter } as AstIdentifierType, programUnit, unit);
                            }
                        }

                        this.collectType(unit.returnType, programUnit, unit);
                        const returnTypeName = formatAstTypeName(unit.returnType, programUnit, unit);

                        const returnType = this.runtime.getType(returnTypeName);
                        const parameterTypes: TypeDefinition[] = [];
                        for (let param of unit.parameters) {
                            this.collectType(param.type, programUnit, unit);

                            const parameterTypeName = formatAstTypeName(param.type, programUnit, unit);
                            const parameterType = this.runtime.getType(parameterTypeName);
                            parameterTypes.push(parameterType);
                        }

                        this.createFunctionType(parameterTypes, returnType);
                    }
                }
            }
        }

        // Pass 2: Resolve extends, parameters, property types and method signatures
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);

                if (programUnit.extends) {
                    const baseType = this.runtime.getType(programUnit.extends);

                    type.extends = baseType;
                    // type.extendsArguments -> evaluate expressions after instance is constructed
                }

                for (let parameter of programUnit.parameters) {
                    const parameterTypeName = formatAstTypeName(parameter.type, programUnit, null);
                    const parameterType = this.runtime.getType(parameterTypeName);

                    type.parameters.push({
                        name: parameter.name,
                        type: parameterType
                    });
                }

                for (let unit of programUnit.units) {
                    if (isPropertyDefinition(unit)) {
                        const propertyTypeName = formatAstTypeName(unit.propertyType, programUnit, null);
                        const propertyType = this.runtime.getType(propertyTypeName);
                        if (!propertyType) {
                            throw new Error(`Could not find type ${unit.propertyType} for property ${unit.name} of type ${programUnit.name}`);
                        }

                        type.properties.push({
                            modifier: unit.modifier,
                            name: unit.name,
                            type: propertyType,
                        });
                    } else if (isMethodDeclaration(unit)) {
                        const returnTypeName = formatAstTypeName(unit.returnType, programUnit, unit);
                        const returnType = this.runtime.getType(returnTypeName);
                        if (!returnType) {
                            throw new Error(`Could not find type ${unit.returnType} for method ${unit.name} of type ${programUnit.name}`);
                        }

                        const genericParameters: TypeParameter[] = [];
                        if (unit.genericParameters) {
                            for (let genericParameter of unit.genericParameters) {
                                const genericTypeName = formatAstTypeName({ type: "identifier", typeName: genericParameter } as AstIdentifierType, programUnit, unit);
                                const genericType = this.runtime.getType(genericTypeName);
                                genericParameters.push({
                                    name: genericParameter,
                                    type: genericType,
                                });
                            }
                        }

                        const typeMethod: TypeMethod = {
                            name: unit.name,
                            declaringType: type,
                            returnType: returnType,
                            genericParameters: genericParameters,
                            parameters: unit.parameters.map(param => {
                                const parameterTypeName = formatAstTypeName(param.type, programUnit, unit);
                                const parameterType = this.runtime.getType(parameterTypeName);
                                return {
                                    name: param.name,
                                    type: parameterType
                                };
                            }),
                            body: [], // assigned later
                        }

                        type.methods.push(typeMethod);

                        const functionTypeName = getFunctionTypeName(returnType, typeMethod.parameters.map(p => p.type));
                        const functionType = this.runtime.getType(functionTypeName);

                        type.properties.push({
                            modifier: "public",
                            name: unit.name,
                            type: functionType,
                            initializer: {
                                exprType: "unboundFunctionReference",
                                method: typeMethod,
                            } as TstUnboundFunctionReferenceExpression,
                        });

                    }
                }

            }
        }

        // Pass 3: Resolve symbols in initializers, extends-arguments and method bodies, AstExpression -> TstExpression
        for (let programUnit of visited.programUnits) {
                // the properties in the class - derives from extends - only add explicit public/private, and we have their types now. but its not parsed yet
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);
                if (!type) {
                    throw new Error("Type should have been created in previous pass");
                }

                const visitor = new AstVisitor(null, this.runtime, type, type.parameters);
                if (programUnit.extends && programUnit.extendsArguments) {
                    type.extendsArguments = programUnit.extendsArguments.map(arg => visitor.resolveExpression(arg));
                }

                for (let unit of programUnit.units) {
                    if (isPropertyStatement(unit)) {
                        // TODO: resolve with a target type? then we can deduce type for empty array literal "[]"
                        type.initializers.push({ name: unit.name, argument: visitor.resolveExpression(unit.argument) })
                    } else
                    if (isPropertyDefinition(unit)) {
                        const propertyTypeName = formatAstTypeName(unit.propertyType, programUnit, null);
                        const propertyType = this.runtime.getType(propertyTypeName);
                        if (!propertyType) {
                            throw new Error(`Could not find type ${unit.propertyType} for property ${unit.name} of type ${programUnit.name}`);
                        }

                        const typeProperty = type.properties.find(p => p.name === unit.name)!;
                        typeProperty.initializer = unit.argument ? visitor.resolveExpression(unit.argument) : undefined;
                    } else if (isMethodDeclaration(unit)) {
                        const typeMethod = type.methods.find(m => m.name === unit.name);
                        if (!typeMethod) {
                            throw new Error(`Method ${unit.name} not found on type ${type.name}`);
                        }

                        const methodVisitor = new AstVisitor(visitor, this.runtime, type, typeMethod.parameters);

                        for (let astStmt of unit.statementList) {
                            const stmt = methodVisitor.resolveStatement(programUnit, unit, astStmt);
                            typeMethod.body.push(stmt);
                        }
                    }
                }
            }
        }
    }
}
