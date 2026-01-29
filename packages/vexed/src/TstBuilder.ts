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

    private getOrCreatePoisonType(typeName: string): TypeDefinition {
        let type = this.runtime.tryGetType(typeName);
        if (!type) {
            type = new PoisonTypeDefinition(this.runtime, typeName);
            this.runtime.types.push(type);
        }
        return type;
    }

    collectType(type: AstType, classDef: AstClass, method: AstMethodDeclaration | null) {
        const typeName = formatAstTypeName(type, classDef, method);

        if (isAstArrayType(type)) {
            this.collectType(type.arrayItemType, classDef, method);
            const elementTypeName = formatAstTypeName(type.arrayItemType, classDef, method);
            let elementType = this.runtime.tryGetType(elementTypeName);
            if (!elementType) {
                // Element type doesn't exist, create poison type
                elementType = this.getOrCreatePoisonType(elementTypeName);
            }

            this.createArrayType(typeName, elementType);
        }

        if (isAstFunctionType(type)) {
            this.collectType(type.functionReturnType, classDef, method);

            for (let paramType of type.functionParameters) {
                this.collectType(paramType, classDef, method);
            }

            let returnType = this.runtime.tryGetType(formatAstTypeName(type.functionReturnType, classDef, method));
            if (!returnType) {
                returnType = this.getOrCreatePoisonType(formatAstTypeName(type.functionReturnType, classDef, method));
            }
            
            const parameterTypes: TypeDefinition[] = type.functionParameters.map(paramType => {
                const paramTypeName = formatAstTypeName(paramType, classDef, method);
                let paramTypeDefinition = this.runtime.tryGetType(paramTypeName);
                if (!paramTypeDefinition) {
                    paramTypeDefinition = this.getOrCreatePoisonType(paramTypeName);
                }
                return paramTypeDefinition;
            });
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

                // Check extends type
                if (programUnit.extends) {
                    const baseType = this.runtime.tryGetType(programUnit.extends);
                    if (!baseType) {
                        this.runtime.error(`Could not find base type ${programUnit.extends} for class ${programUnit.name}`, programUnit.location);
                        // Create poison type for the missing base type
                        this.getOrCreatePoisonType(programUnit.extends);
                    }
                }

                for (let unit of programUnit.units) {
                    if (isPropertyDefinition(unit)) {
                        this.collectType(unit.propertyType, programUnit, null);
                        
                        // Check property type and report error if not found
                        const propertyTypeName = formatAstTypeName(unit.propertyType, programUnit, null);
                        let propertyType = this.runtime.tryGetType(propertyTypeName);
                        if (!propertyType) {
                            this.runtime.error(`Could not find type ${propertyTypeName} for property ${programUnit.name}.${unit.name}`, unit.location);
                            // Create poison type
                            this.getOrCreatePoisonType(propertyTypeName);
                        }
                    }

                    if (isMethodDeclaration(unit)) {

                        if (unit.genericParameters) {
                            for (let genericParameter of unit.genericParameters) {
                                // TODO: location in generic parameters, using method location for now
                                this.collectType({ type: "identifier", typeName: genericParameter, location: unit.location } as AstIdentifierType, programUnit, unit);
                            }
                        }

                        this.collectType(unit.returnType, programUnit, unit);
                        const returnTypeName = formatAstTypeName(unit.returnType, programUnit, unit);

                        let returnType = this.runtime.tryGetType(returnTypeName);
                        if (!returnType) {
                            this.runtime.error(`Could not find return type ${returnTypeName} for method ${programUnit.name}.${unit.name}`, unit.location);
                            // Create poison type
                            returnType = this.getOrCreatePoisonType(returnTypeName);
                        }
                        const parameterTypes: TypeDefinition[] = [];
                        for (let param of unit.parameters) {
                            this.collectType(param.type, programUnit, unit);

                            const parameterTypeName = formatAstTypeName(param.type, programUnit, unit);
                            let parameterType = this.runtime.tryGetType(parameterTypeName);
                            if (!parameterType) {
                                this.runtime.error(`Could not find type ${parameterTypeName} for parameter ${param.name} in method ${programUnit.name}.${unit.name}`, param.location);
                                // Create poison type
                                parameterType = this.getOrCreatePoisonType(parameterTypeName);
                            }
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
                    const baseType = this.runtime.tryGetType(programUnit.extends);
                    if (!baseType) {
                        throw new Error(`Internal error: Base type ${programUnit.extends} not found after collection for class ${programUnit.name}`);
                    }

                    type.extends = baseType;
                    // type.extendsArguments -> evaluate expressions after instance is constructed
                }

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
                        let propertyType = this.runtime.tryGetType(propertyTypeName);
                        if (!propertyType) {
                            throw new Error(`Internal error: Property type ${propertyTypeName} not found after collection for property ${programUnit.name}.${unit.name}`);
                        }

                        type.properties.push({
                            modifier: unit.modifier,
                            name: unit.name,
                            type: propertyType,
                            location: unit.location,
                        });
                    } else if (isMethodDeclaration(unit)) {
                        const returnTypeName = formatAstTypeName(unit.returnType, programUnit, unit);
                        let returnType = this.runtime.tryGetType(returnTypeName);
                        if (!returnType) {
                            throw new Error(`Internal error: Return type ${returnTypeName} not found after collection for method ${programUnit.name}.${unit.name}`);
                        }

                        const genericParameters: TypeParameter[] = [];
                        if (unit.genericParameters) {
                            for (let genericParameter of unit.genericParameters) {
                                const genericTypeName = formatAstTypeName({ type: "identifier", typeName: genericParameter } as AstIdentifierType, programUnit, unit);
                                const genericType = this.runtime.tryGetType(genericTypeName);
                                if (!genericType) {
                                    throw new Error("Internal error: Generic type not found after collection: " + genericTypeName);
                                }
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
                            let parameterType = this.runtime.tryGetType(parameterTypeName);
                            if (!parameterType) {
                                throw new Error(`Internal error: Parameter type ${parameterTypeName} not found after collection for parameter ${param.name} in method ${programUnit.name}.${unit.name}`);
                            }
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

        // Stop here if type resolution errors
        if (this.runtime.scriptErrors.length > 0) {
            return false;
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
