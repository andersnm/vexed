import { AstClass, AstMethodDeclaration, AstPropertyDefinition, formatAstTypeName } from "../AstProgram.js";
import { AstIdentifierType } from "../AstType.js";
import { AstReplaceVisitor } from "./AstReplaceVisitor.js";
import { TstUnboundFunctionReferenceExpression } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeMethod, TypeParameter } from "../TstType.js";
import { getFunctionTypeName } from "../types/FunctionTypeDefinition.js";

// Resolves property types, constructor parameter types and method signatures

export class AstTypeShaperVisitor extends AstReplaceVisitor {
    classDef: AstClass | null = null;
    methodDef: AstMethodDeclaration | null = null;

    constructor(private runtime: TstRuntime) {
        super();
    }

    visitClassDefinition(classDef: AstClass): AstClass {
        this.classDef = classDef;

        const type = this.runtime.getType(classDef.name);

        for (let parameter of classDef.parameters) {
            const parameterTypeName = formatAstTypeName(parameter.type, classDef, null);
            const parameterType = this.runtime.getType(parameterTypeName);

            type.parameters.push({
                name: parameter.name,
                type: parameterType,
                location: parameter.location,
            });
        }

        return super.visitClassDefinition(classDef);
    }

    visitPropertyDefinition(unit: AstPropertyDefinition): AstPropertyDefinition {
        const type = this.runtime.getType(this.classDef!.name);
        const propertyTypeName = formatAstTypeName(unit.propertyType, this.classDef!, null);
        const propertyType = this.runtime.getType(propertyTypeName);

        type.properties.push({
            modifier: unit.modifier,
            name: unit.name,
            type: propertyType,
            location: unit.location,
        });

        return super.visitPropertyDefinition(unit);
    }

    visitMethodDeclaration(unit: AstMethodDeclaration): AstMethodDeclaration {
        const type = this.runtime.getType(this.classDef!.name);
        const returnTypeName = formatAstTypeName(unit.returnType, this.classDef!, unit);
        const returnType = this.runtime.getType(returnTypeName);

        const genericParameters: TypeParameter[] = [];
        if (unit.genericParameters) {
            for (let genericParameter of unit.genericParameters) {
                const genericTypeName = formatAstTypeName({ type: "identifier", typeName: genericParameter } as AstIdentifierType, this.classDef!, unit);
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
            const parameterTypeName = formatAstTypeName(param.type, this.classDef!, unit);
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

        return super.visitMethodDeclaration(unit);
    }
}