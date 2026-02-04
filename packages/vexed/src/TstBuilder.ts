import { AstClass, AstMethodDeclaration, AstProgram, formatAstTypeName, isClass } from "./AstProgram.js";
import { TypeDefinition } from "./TstType.js";
import { TstRuntime } from "./TstRuntime.js";
import { AstType, isAstArrayType, isAstFunctionType, isAstIdentifierType } from "./AstType.js";
import { FunctionTypeDefinition, getFunctionTypeName } from "./types/FunctionTypeDefinition.js";
import { GenericUnresolvedTypeDefinition } from "./types/GenericUnresolvedTypeDefinition.js";
import { AstTypeCollectorVisitor } from "./visitors-ast/AstTypeCollectorVisitor.js";
import { AstTypeShaperVisitor } from "./visitors-ast/AstTypeShaperVisitor.js";
import { AstTypeExpressionVisitor } from "./visitors-ast/AstTypeExpressionVisitor.js";
import { ArrayTypeDefinition } from "./types/ArrayBaseTypeDefinition.js";
import { PoisonTypeDefinition } from "./types/PoisonTypeDefinition.js";

export class TstBuilder {
    public runtime: TstRuntime;

    constructor(runtime: TstRuntime) {
        this.runtime = runtime;
    }

    collectType(type: AstType, classDef: AstClass, method: AstMethodDeclaration | null): TypeDefinition | null {
        const typeName = formatAstTypeName(type, classDef, method);

        // Check if the type already exists - handles f.ex "MissingType[]" when "MissingType" is missing.
        const existingType = this.runtime.tryGetType(typeName);
        if (existingType) {
            return existingType;
        }

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

    createPoisonType(name: string): TypeDefinition {
        const type = this.runtime.tryGetType(name);
        if (type) {
            return type;
        }

        const poisonType = new PoisonTypeDefinition(this.runtime, name);
        this.runtime.registerTypes([poisonType]);
        return poisonType;
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
        // NOTE: Implicit types for literals - f.ex "([[1,2],[3,4]])[0]" uses int[][] internally - are collected later.
        const typeCollector = new AstTypeCollectorVisitor(this);
        typeCollector.visitProgram(visited);

        // Pass 2: Resolve property types, constructor parameter types and method signatures
        const typeShaper = new AstTypeShaperVisitor(this.runtime);
        typeShaper.visitProgram(visited);

        // Pass 3: Resolve symbols in initializers, extends-arguments and method bodies, AstExpression -> TstExpression
        const typeExpresser = new AstTypeExpressionVisitor(this);
        typeExpresser.visitProgram(visited);

        return true;
    }
}
