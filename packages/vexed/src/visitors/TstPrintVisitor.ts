import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIfStatement, TstInstanceExpression, TstInstanceObject, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstVariableExpression, TypeMeta } from "../TstExpression.js";
import { TstScope } from "./TstReduceExpressionVisitor.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export const printExpression = (expr: TstExpression|TstExpression[]|undefined): string => {
    if (!expr) return "<undefined";
    const printer = new TstPrintVisitor();
    if (Array.isArray(expr)) {
        for (let i = 0; i < expr.length; i++) {
            if (i > 0) {
                printer.output.push(", ");
            }
            printer.visit(expr[i]);
        }
    } else {
        printer.visit(expr);
    }
    return printer.output.join("");
}

export const printObject = (obj: TstInstanceObject) => {
    const printer = new TstPrintVisitor();

    printer.printedInstances.add(obj);
    printer.printObject(obj);

    return printer.output.join("");
}

function isTstArrayInstance(obj: TstInstanceObject): boolean {
    const typeDef = obj[TypeMeta];
    return typeDef.name.endsWith("[]");
}

export class TstPrintVisitor extends TstReplaceVisitor {

    indentDepth: number = 0;
    output: string[] = [];

    indent() {
        this.indentDepth++;
    }

    dedent() {
        this.indentDepth--;
    }

    printIndent() {
        this.output.push("  ".repeat(this.indentDepth));
    }

    printObject(obj: TstInstanceObject) {
        const propertyNames = Object.keys(obj);

        const instanceType = obj[TypeMeta];

        if (isTstArrayInstance(obj)) {
            this.output.push("[");
            const arrayValue = obj[InstanceMeta] as TstExpression[];
            this.printExpressionList(arrayValue);
            this.output.push("]");
        }

        this.output.push("{\n");
        this.indent();

        for (let property of instanceType.properties) {
            const propertyName = property.name;
            this.printIndent();

            const propExpr = instanceType.resolveProperty(obj, propertyName);
            if (!propExpr) {
                throw new Error("Property expression not found: " + instanceType.name + "." + propertyName);
            }

            const propertyMember = instanceType.getProperty(propertyName);
            if (!propertyMember) {
                throw new Error("Property member not found: " + instanceType.name + "." + propertyName);
            }

            this.output.push(propertyName + ": " + propertyMember.type.name + " = ");
            this.visit(propExpr);
            this.output.push("\n");
        }

        // TODO: enumerate methods on class and base classes, print implementations

        this.dedent();

        this.printIndent();
        this.output.push("} ");
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        this.visit(expr.object);
        this.output.push("." + expr.property);
        return expr;
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        this.output.push("this");
        return expr;
    }

    printExpressionList(exprs: TstExpression[]) {
        exprs.forEach((arg, index) => {
            this.visit(arg);
            if (index < exprs.length - 1) {
                this.output.push(", ");
            }
        });
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {
        this.visit(expr.object);
        this.output.push(".");
        this.output.push(expr.method.name + "(");
        this.printExpressionList(expr.args);
        this.output.push(")");
        return expr;
    }

    printedInstances: Set<TstInstanceObject> = new Set();

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        const instanceType = expr.instance[TypeMeta];

        if (instanceType === instanceType.runtime.getType("string")) {
            this.output.push(`"${expr.instance[InstanceMeta]}"`);
            return expr;
        }

        if (instanceType === instanceType.runtime.getType("int")) {
            this.output.push(`${expr.instance[InstanceMeta]}`);
            return expr;
        }

        if (instanceType === instanceType.runtime.getType("bool")) {
            this.output.push(`${expr.instance[InstanceMeta]}`);
            return expr;
        }

        this.output.push("(#" + instanceType.name + ")");
        // TODO: printobject can recurse infinitely
        if (this.printedInstances.has(expr.instance)) {
            this.output.push(" { ... } ");
            return expr;
        }

        this.printedInstances.add(expr.instance);
        this.printObject(expr.instance);
        return expr;
    }

    visitNewExpression(expr: TstNewExpression): TstExpression {
        this.output.push("new " + expr.type.name);
        return expr;
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        this.output.push("$" + expr.name);
        return expr;
    }

    visitVariableExpression(expr: TstVariableExpression): TstExpression {
        this.output.push("%" + expr.name);
        return expr;
    }

    printScope(scope: TstScope) {
        this.output.push("(scope: ");
        scope.variables.forEach((param, index) => {
            this.output.push(param.name + "=");
            this.visit(param.value);
            if (index < scope.variables.length - 1) {
                this.output.push(", ");
            }
        });
        if (scope.parent) {
            this.output.push("; parent=");
            this.printScope(scope.parent);
        }
        this.output.push(")");
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        this.visit(expr.expr);
        this.printScope(expr.scope);
        return expr;
    }

    visitBinaryExpression(expr: TstBinaryExpression): TstExpression {
        this.output.push("(");
        this.visit(expr.left);
        this.output.push(" " + expr.operator + " ");
        this.visit(expr.right);
        this.output.push(")");
        return expr;
    }

    visitStatementExpression(expr: TstStatementExpression): TstExpression {
        this.output.push("{\n");
        this.indent();
        expr.statements.forEach((stmt) => {
            this.printIndent();
            this.visitStatement(stmt);
        });
        this.dedent();
        this.printIndent();
        this.output.push("}");
        return expr;
    }

    visitIfStatement(stmt: TstIfStatement): TstStatement[] {
        this.output.push("if (");
        this.visit(stmt.condition);
        this.output.push(") {\n");
        this.indent();
        stmt.then.forEach((s) => {
            this.printIndent();
            this.visitStatement(s);
        });
        this.dedent();
        this.printIndent();
        this.output.push("}");
        if (stmt.else) {
            this.output.push(" else {\n");
            this.indent();
            stmt.else.forEach((s) => {
                this.printIndent();
                this.visitStatement(s);
            });
            this.dedent();
            this.printIndent();
            this.output.push("}\n");
        }
        return [ stmt ];
    }

    visitReturnStatement(stmt: TstReturnStatement): TstStatement[] {
        this.output.push("return ");
        this.visit(stmt.returnValue);
        this.output.push(";\n");
        return [ stmt ];
    }

    visitLocalVarDeclaration(stmt: TstLocalVarDeclaration): TstStatement[] {
        this.output.push(stmt.varType.name + " " + stmt.name + " = ");
        this.visit(stmt.initializer);
        this.output.push(";\n");
        return [ stmt ];
    }

    // visitStatement(stmt: TstStatement): TstStatement {
    //     this.output.push("{");
    //     this.indent();
    //     this.visit(stmt);
    //     this.dedent();
    //     this.output.push("}");
    //     return stmt;
    // }
}
