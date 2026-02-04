import { AstClass, AstMethodDeclaration, AstProgram, AstPropertyDefinition, AstStatement, formatAstTypeName, isAstIfStatement, isAstLocalVarDeclaration } from "../AstProgram.js";
import { AstIdentifierType } from "../AstType.js";
import { AstReplaceVisitor } from "./AstReplaceVisitor.js";
import { TstBuilder } from "../TstBuilder.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";

// Collects static type references from AST nodes into the runtime type system

export class AstTypeCollectorVisitor extends AstReplaceVisitor {

    runtime: TstRuntime;
    program: AstProgram | null = null;
    classDef: AstClass | null = null;
    methodDef: AstMethodDeclaration | null = null;

    constructor(private builder: TstBuilder) {
        super();
        this.runtime = builder.runtime;
    }

    visitProgram(program: AstProgram): AstProgram {
        this.program = program;
        return super.visitProgram(program);
    }

    visitClassDefinition(classDef: AstClass): AstClass {
        this.classDef = classDef;

        const type = this.runtime.getType(classDef.name);

        if (classDef.extends) {
            let baseType = this.runtime.tryGetType(classDef.extends);
            if (!baseType) {
                this.runtime.error(`Could not find base type ${classDef.extends} for class ${classDef.name}`, classDef.location);
                baseType = this.builder.createPoisonType(classDef.extends);
            }

            type.extends = baseType;
        }

        return super.visitClassDefinition(classDef);
    }

    visitPropertyDefinition(unit: AstPropertyDefinition): AstPropertyDefinition {
        if (!this.classDef) {
            throw new Error("Internal error: classDef not set when visiting property definition");
        }

        if (!this.builder.collectType(unit.propertyType, this.classDef, null)) {
            const typeName = formatAstTypeName(unit.propertyType, this.classDef, null);
            this.runtime.error(`Could not find type ${typeName} for property ${this.classDef.name}.${unit.name}`, unit.location);
            this.builder.createPoisonType(typeName);
        }

        return super.visitPropertyDefinition(unit);
    }

    visitMethodDeclaration(unit: AstMethodDeclaration): AstMethodDeclaration {
        if (!this.classDef) {
            throw new Error("Internal error: classDef not set when visiting method declaration");
        }

        if (unit.genericParameters) {
            for (let genericParameter of unit.genericParameters) {
                // TODO: location in generic parameters, using method location for now
                const genericType = { type: "identifier", typeName: genericParameter, location: unit.location } as AstIdentifierType;
                if (!this.builder.collectType(genericType, this.classDef, unit)) {
                    this.runtime.error(`Could not resolve generic type parameter ${genericParameter} for method ${this.classDef.name}.${unit.name}`, unit.location);
                    this.builder.createPoisonType(formatAstTypeName(genericType, this.classDef, unit));
                }
            }
        }

        let returnType = this.builder.collectType(unit.returnType, this.classDef, unit);
        if (!returnType) {
            const typeName = formatAstTypeName(unit.returnType, this.classDef, unit);
            this.runtime.error(`Could not find return type ${typeName} for method ${this.classDef.name}.${unit.name}`, unit.location);
            returnType = this.builder.createPoisonType(typeName);
        }

        const parameterTypes: TypeDefinition[] = [];
        for (let param of unit.parameters) {
            let parameterType = this.builder.collectType(param.type, this.classDef, unit);
            if (!parameterType) {
                const typeName = formatAstTypeName(param.type, this.classDef, unit);
                this.runtime.error(`Could not find type ${typeName} for parameter ${param.name} in method ${this.classDef.name}.${unit.name}`, param.location);
                parameterType = this.builder.createPoisonType(typeName);
            }

            parameterTypes.push(parameterType);
        }

        // TODO?: if any component of the function is poisoned, create poison instead of function type!

        this.builder.createFunctionType(parameterTypes, returnType);

        // Catch type errors and collect explicitly referenced array/function types from statements
        for (let stmt of unit.statementList) {
            this.collectStatementTypes(stmt, this.classDef, this.methodDef);
        }

        return super.visitMethodDeclaration(unit);
    }

    collectStatementTypes(stmt: AstStatement, classDef: AstClass, method: AstMethodDeclaration | null): void {
        if (isAstIfStatement(stmt)) {
            for (let s of stmt.thenBlock) {
                this.collectStatementTypes(s, classDef, method);
            }
            if (stmt.elseBlock) {
                for (let s of stmt.elseBlock) {
                    this.collectStatementTypes(s, classDef, method);
                }
            }
            return;
        }

        if (isAstLocalVarDeclaration(stmt)) {
            if (!this.builder.collectType(stmt.varType, classDef, method)) {
                const varTypeName = formatAstTypeName(stmt.varType, classDef, method);
                this.runtime.error(`Could not find local variable ${stmt.name} type ${varTypeName} in ${classDef.name}.${method?.name}`, stmt.location);
                this.builder.createPoisonType(varTypeName);
            }
            return;
        }
    }
}
