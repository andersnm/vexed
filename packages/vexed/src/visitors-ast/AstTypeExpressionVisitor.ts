import { AstClass, AstMethodDeclaration, AstPropertyDefinition, AstPropertyStatement } from "../AstProgram.js";
import { AstTstExpressionVisitor } from "../AstTstExpressionVisitor.js";
import { TstBuilder } from "../TstBuilder.js";
import { TstRuntime } from "../TstRuntime.js";
import { AstReplaceVisitor } from "./AstReplaceVisitor.js";

// Resolves symbols in initializers, extends-arguments and method bodies, AstExpression -> TstExpression

export class AstTypeExpressionVisitor extends AstReplaceVisitor {
    runtime: TstRuntime;
    classDef: AstClass | null = null;

    constructor(private builder: TstBuilder) {
        super();
        this.runtime = builder.runtime;
    }

    visitClassDefinition(classDef: AstClass): AstClass {
        this.classDef = classDef;

        const type = this.runtime.getType(classDef.name);

        const visitor = new AstTstExpressionVisitor(this.builder, classDef, null);
        if (classDef.extends && classDef.extendsArguments) {
            type.extendsArguments = classDef.extendsArguments.map(arg => visitor.visitExpression(arg));
        }

        return super.visitClassDefinition(classDef);
    }

    visitPropertyStatement(propStmt: AstPropertyStatement): AstPropertyStatement {
        const type = this.runtime.getType(this.classDef!.name);

        const visitor = new AstTstExpressionVisitor(this.builder, this.classDef!, null);
        type.initializers.push({ name: propStmt.name, argument: visitor.visitExpression(propStmt.argument) });

        return super.visitPropertyStatement(propStmt);
    }

    visitPropertyDefinition(propDef: AstPropertyDefinition): AstPropertyDefinition {
        const type = this.runtime.getType(this.classDef!.name);
        const typeProperty = type.properties.find(p => p.name === propDef.name);
        if (!typeProperty) throw new Error("Internal error: Property not found: " + propDef.name);

        const visitor = new AstTstExpressionVisitor(this.builder, this.classDef!, null);
        typeProperty.initializer = propDef.argument ? visitor.visitExpression(propDef.argument) : undefined;
        return super.visitPropertyDefinition(propDef);
    }

    visitMethodDeclaration(methodDef: AstMethodDeclaration): AstMethodDeclaration {
        const type = this.runtime.getType(this.classDef!.name);
        const typeMethod = type.methods.find(m => m.name === methodDef.name);
        if (!typeMethod) throw new Error("Internal error: Method not found: " + methodDef.name);

        const methodVisitor = new AstTstExpressionVisitor(this.builder, this.classDef!, methodDef);

        for (let astStmt of methodDef.statementList) {
            const stmt = methodVisitor.visitStatement(astStmt);
            typeMethod.body.push(stmt);
        }

        return super.visitMethodDeclaration(methodDef);
    }
}
