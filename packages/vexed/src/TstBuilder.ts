import { AstClass, AstExpression, AstMethodDeclaration, AstProgram, AstStatement, formatAstTypeName, isAstArrayLiteral, isAstBinaryExpression, isAstBooleanLiteral, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIfStatement, isAstIndexExpression, isAstIntegerLiteral, isAstLocalVarAssignment, isAstLocalVarDeclaration, isAstMember, isAstReturnStatement, isAstStringLiteral, isAstUnaryExpression, isClass, isMethodDeclaration, isPropertyDefinition, isPropertyStatement } from "./AstProgram.js";
import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstStatement, TstThisExpression, TstUnaryExpression, TstUnboundFunctionReferenceExpression, TstVariable, TstVariableExpression } from "./TstExpression.js";
import { TypeDefinition, TypeMethod, TypeParameter } from "./TstType.js";
import { TstRuntime } from "./TstRuntime.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";
import { AstIdentifierType, AstType, isAstArrayType, isAstFunctionType, isAstIdentifierType } from "./AstType.js";
import { FunctionTypeDefinition, getFunctionTypeName } from "./types/FunctionTypeDefinition.js";
import { ArrayTypeDefinition } from "./types/ArrayBaseTypeDefinition.js";
import { GenericUnresolvedTypeDefinition } from "./types/GenericUnresolvedTypeDefinition.js";
import { PoisonTypeDefinition } from "./types/PoisonTypeDefinition.js";
import { AstVisitor } from "./AstVisitor.js";

export class TstBuilder {
    private runtime: TstRuntime;

    constructor(runtime: TstRuntime) {
        this.runtime = runtime;
    }

    collectType(type: AstType, classDef: AstClass, method: AstMethodDeclaration | null): TypeDefinition | null {
        const typeName = formatAstTypeName(type, classDef, method);

        if (isAstArrayType(type)) {
            let elementType = this.collectType(type.arrayItemType, classDef, method);
            if (!elementType) {
                return null;
            }

            return this.createArrayType(typeName, elementType);
        }

        if (isAstFunctionType(type)) {
            let returnType = this.collectType(type.functionReturnType, classDef, method);
            if (!returnType) {
                return null;
            }

            const parameterTypes: TypeDefinition[] = [];
            for (let paramType of type.functionParameters) {
                const paramTypeDef = this.collectType(paramType, classDef, method);
                if (!paramTypeDef) {
                    return null;
                }
                parameterTypes.push(paramTypeDef);
            }

            return this.createFunctionType(parameterTypes, returnType);
        }

        if (isAstIdentifierType(type)) {
            const methodGenericParameter = method?.genericParameters?.find(p => p === type.typeName);
            if (methodGenericParameter) {
                return this.createGenericUnresolvedType(typeName);
            }

            return this.runtime.tryGetType(typeName);
        }

        throw new Error("Unsupported type kind in collectType: " + JSON.stringify(type));
    }

    createArrayType(arrayTypeName: string, elementType: TypeDefinition) {
        const type = this.runtime.tryGetType(arrayTypeName);
        if (type) {
            return type;
        }

        const specializedArrayType = new ArrayTypeDefinition(this.runtime, arrayTypeName, elementType);
        this.runtime.registerTypes([specializedArrayType]);
        return specializedArrayType;
    }

    createFunctionType(parameterTypes: TypeDefinition[], returnType: TypeDefinition) {
        const functionTypeName = getFunctionTypeName(returnType, parameterTypes);
        const type = this.runtime.tryGetType(functionTypeName);
        if (type) {
            return type;
        }

        // console.log("Creating function type: ", functionTypeName);
        const functionType = new FunctionTypeDefinition(this.runtime, returnType, parameterTypes);
        this.runtime.registerTypes([functionType]);
        return functionType;
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

    collectTypesFromStatement(stmt: AstStatement, classDef: AstClass, method: AstMethodDeclaration): void {
        if (isAstLocalVarDeclaration(stmt)) {
            this.collectType(stmt.varType, classDef, method);
            if (stmt.initializer) {
                this.collectTypesFromExpression(stmt.initializer, classDef, method);
            }
        } else if (isAstReturnStatement(stmt)) {
            this.collectTypesFromExpression(stmt.returnValue, classDef, method);
        } else if (isAstIfStatement(stmt)) {
            this.collectTypesFromExpression(stmt.condition, classDef, method);
            for (let thenStmt of stmt.thenBlock) {
                this.collectTypesFromStatement(thenStmt, classDef, method);
            }
            if (stmt.elseBlock) {
                for (let elseStmt of stmt.elseBlock) {
                    this.collectTypesFromStatement(elseStmt, classDef, method);
                }
            }
        } else if (isAstLocalVarAssignment(stmt)) {
            this.collectTypesFromExpression(stmt.expr, classDef, method);
        }
    }

    collectTypesFromExpression(expr: AstExpression, classDef: AstClass, method: AstMethodDeclaration): void {
        if (isAstArrayLiteral(expr)) {
            for (let element of expr.elements) {
                this.collectTypesFromExpression(element, classDef, method);
            }
        } else if (isAstIndexExpression(expr)) {
            this.collectTypesFromExpression(expr.object, classDef, method);
            this.collectTypesFromExpression(expr.index, classDef, method);
        } else if (isAstMember(expr)) {
            this.collectTypesFromExpression(expr.object, classDef, method);
        } else if (isAstFunctionCall(expr)) {
            this.collectTypesFromExpression(expr.callee, classDef, method);
            for (let arg of expr.args) {
                this.collectTypesFromExpression(arg, classDef, method);
            }
        } else if (isAstBinaryExpression(expr)) {
            this.collectTypesFromExpression(expr.lhs, classDef, method);
            this.collectTypesFromExpression(expr.rhs, classDef, method);
        } else if (isAstUnaryExpression(expr)) {
            this.collectTypesFromExpression(expr.operand, classDef, method);
        }
        // Literals and identifiers don't need type collection
    }

    resolveProgram(visited: AstProgram): boolean {

        // Pass 1: Create new half-constructed types
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                let type = this.runtime.tryGetType(programUnit.name);
                if (!type) {
                    type = new TypeDefinition(this.runtime, programUnit.name, programUnit.location);
                    this.runtime.types.push(type);
                }
            }
        }

        // Pass 1.5: Collect array and function types
        // TODO: Also collect from array literals f.ex "([[1,2],[3,4]])[0]" requires int[][] internally
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);

                if (programUnit.extends) {
                    let baseType = this.runtime.tryGetType(programUnit.extends);
                    if (!baseType) {
                        this.runtime.error(`Could not find base type ${programUnit.extends} for class ${programUnit.name}`, programUnit.location);
                        baseType = this.runtime.createPoisonType(programUnit.extends);
                    }

                    type.extends = baseType;
                    // type.extendsArguments -> evaluate expressions after instance is constructed
                }

                for (let unit of programUnit.units) {
                    if (isPropertyDefinition(unit)) {
                        if (!this.collectType(unit.propertyType, programUnit, null)) {
                            const typeName = formatAstTypeName(unit.propertyType, programUnit, null);
                            this.runtime.error(`Could not find type ${typeName} for property ${programUnit.name}.${unit.name}`, unit.location);
                            this.runtime.createPoisonType(typeName);
                        }
                    }

                    if (isMethodDeclaration(unit)) {

                        if (unit.genericParameters) {
                            for (let genericParameter of unit.genericParameters) {
                                // TODO: location in generic parameters, using method location for now
                                const genericType = { type: "identifier", typeName: genericParameter, location: unit.location } as AstIdentifierType;
                                if (!this.collectType(genericType, programUnit, unit)) {
                                    this.runtime.error(`Could not resolve generic type parameter ${genericParameter} for method ${programUnit.name}.${unit.name}`, unit.location);
                                    this.runtime.createPoisonType(formatAstTypeName(genericType, programUnit, unit));
                                }
                            }
                        }

                        let returnType = this.collectType(unit.returnType, programUnit, unit);
                        if (!returnType) {
                            const typeName = formatAstTypeName(unit.returnType, programUnit, unit);
                            this.runtime.error(`Could not find return type ${typeName} for method ${programUnit.name}.${unit.name}`, unit.location);
                            returnType = this.runtime.createPoisonType(typeName);
                        }

                        const parameterTypes: TypeDefinition[] = [];
                        for (let param of unit.parameters) {
                            let parameterType = this.collectType(param.type, programUnit, unit);
                            if (!parameterType) {
                                const typeName = formatAstTypeName(param.type, programUnit, unit);
                                this.runtime.error(`Could not find type ${typeName} for parameter ${param.name} in method ${programUnit.name}.${unit.name}`, param.location);
                                parameterType = this.runtime.createPoisonType(typeName);
                            }

                            parameterTypes.push(parameterType);
                        }

                        // TODO?: if any component of the function is poisoned, create poison instead of function type!

                        this.createFunctionType(parameterTypes, returnType);

                        // Collect types from method body statements and expressions
                        for (let stmt of unit.statementList) {
                            this.collectTypesFromStatement(stmt, programUnit, unit);
                        }
                    }
                }
            }
        }

        // Pass 2: Resolve extends, parameters, property types and method signatures
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);

                for (let parameter of programUnit.parameters) {
                    const parameterTypeName = formatAstTypeName(parameter.type, programUnit, null);
                    const parameterType = this.runtime.getType(parameterTypeName);

                    type.parameters.push({
                        name: parameter.name,
                        type: parameterType,
                        location: parameter.location,
                    });
                }

                for (let unit of programUnit.units) {
                    if (isPropertyDefinition(unit)) {
                        const propertyTypeName = formatAstTypeName(unit.propertyType, programUnit, null);
                        const propertyType = this.runtime.getType(propertyTypeName);

                        type.properties.push({
                            modifier: unit.modifier,
                            name: unit.name,
                            type: propertyType,
                            location: unit.location,
                        });
                    } else if (isMethodDeclaration(unit)) {
                        const returnTypeName = formatAstTypeName(unit.returnType, programUnit, unit);
                        const returnType = this.runtime.getType(returnTypeName);

                        const genericParameters: TypeParameter[] = [];
                        if (unit.genericParameters) {
                            for (let genericParameter of unit.genericParameters) {
                                const genericTypeName = formatAstTypeName({ type: "identifier", typeName: genericParameter } as AstIdentifierType, programUnit, unit);
                                const genericType = this.runtime.getType(genericTypeName);

                                genericParameters.push({
                                    name: genericParameter,
                                    type: genericType,
                                    location: unit.location, // TODO: generic parameter location
                                });
                            }
                        }

                        const parameters: TypeParameter[] = [];
                        for (let param of unit.parameters) {
                            const parameterTypeName = formatAstTypeName(param.type, programUnit, unit);
                            const parameterType = this.runtime.getType(parameterTypeName);
                            parameters.push({
                                name: param.name,
                                type: parameterType,
                                location: param.location,
                            });
                        }

                        const typeMethod: TypeMethod = {
                            name: unit.name,
                            declaringType: type,
                            returnType: returnType,
                            genericParameters: genericParameters,
                            parameters: parameters,
                            body: [], // assigned later
                            location: unit.location,
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
                            location: unit.location,
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
                        const typeProperty = type.properties.find(p => p.name === unit.name);
                        if (!typeProperty) throw new Error("Internal error: Property not found: " + unit.name);

                        typeProperty.initializer = unit.argument ? visitor.resolveExpression(unit.argument) : undefined;
                    } else if (isMethodDeclaration(unit)) {
                        const typeMethod = type.methods.find(m => m.name === unit.name);
                        if (!typeMethod) throw new Error("Internal error: Method not found: " + unit.name);

                        const methodVisitor = new AstVisitor(visitor, this.runtime, type, typeMethod.parameters);

                        for (let astStmt of unit.statementList) {
                            const stmt = methodVisitor.resolveStatement(programUnit, unit, astStmt);
                            typeMethod.body.push(stmt);
                        }
                    }
                }
            }
        }

        return true;
    }
}
