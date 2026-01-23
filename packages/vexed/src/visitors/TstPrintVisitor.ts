import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstInstanceExpression, TstInstanceObject, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNativeMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstReturnStatement, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstVariableExpression, TypeMeta } from "../TstExpression.js";
import { TypeDefinition } from "../TstType.js";
import { TstScope } from "./TstReduceExpressionVisitor.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export const printScope = (scope: TstScope, verbose: boolean = false): string => {
    const printer = new TstPrintVisitor();
    printer.printScope(scope, verbose);
    return printer.output.join("");
}

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

function getPropertyNames(scopeType: TypeDefinition, propertyNames: string[]) {
    if (scopeType.extends) {
        getPropertyNames(scopeType.extends, propertyNames);
    }
    propertyNames.push(...scopeType.properties.map(p => p.name));
};

export class TstPrintVisitor extends TstReplaceVisitor {

    indentDepth: number = 0;
    output: string[] = [];
    printedInstances: Set<TstInstanceObject> = new Set();

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

        this.printProperties(obj, instanceType);

        // TODO: print method implementations

        this.dedent();

        this.printIndent();
        this.output.push("} ");
    }

    printProperties(obj: TstInstanceObject, instanceType: TypeDefinition) {
        if (instanceType.extends) {
            this.printProperties(obj, instanceType.extends);
        }

        for (let property of instanceType.properties) {
            const propertyName = property.name;
            this.printIndent();

            const propertyMember = instanceType.getProperty(propertyName);
            if (!propertyMember) {
                throw new Error("Property member not found: " + instanceType.name + "." + propertyName);
            }

            this.output.push(propertyName + ": " + propertyMember.type.name + " = ");

            const propExpr = instanceType.resolvePropertyExpression(obj, propertyName);
            if (propExpr) {
                this.visit(propExpr);
            } else {
                this.output.push("<unresolved>");
            }
            this.output.push("\n");
        }
    }

    printExpressionList(exprs: TstExpression[]) {
        exprs.forEach((arg, index) => {
            this.visit(arg);
            if (index < exprs.length - 1) {
                this.output.push(", ");
            }
        });
    }

    printScope(scope: TstScope, verbose: boolean = false) {
        const thisType = scope.thisObject ? scope.thisObject[TypeMeta] : null;
        this.output.push("(scope " + scope.comment + ": this=" + thisType?.name + "; vars=");
        scope.variables.forEach((param, index) => {
            this.output.push(param.name + "=");
            if (verbose) {
                this.visit(param.value);
            } else {
                this.output.push("<expr:" + param.value.exprType + ">");
            }
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

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        this.visit(expr.object);
        this.output.push("." + expr.property);
        return expr;
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        this.output.push("this");
        return expr;
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {
        this.visit(expr.callee);
        this.output.push("(");
        this.printExpressionList(expr.args);
        this.output.push(")");
        return expr;
    }

    visitFunctionReferenceExpression(expr: TstFunctionReferenceExpression): TstExpression {
        this.visit(expr.target);
        this.output.push(".#" + expr.method.name);
        return expr;
    }

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

        if (this.printedInstances.has(expr.instance)) {
            const propertyNames: string[] = [];
            getPropertyNames(instanceType, propertyNames);
            this.output.push("(#" + instanceType.name + ": " + propertyNames.join(", ") + " ...)");
            return expr;
        }

        this.output.push("(#" + instanceType.name + ": ");

        // Full printObject is too verbose for most cases, but should be part of standard printouts
        this.printedInstances.add(expr.instance);
        this.printObject(expr.instance);
        this.output.push(")");

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

    visitPromiseExpression(expr: TstPromiseExpression): TstExpression {
        this.output.push("Promise<" + expr.promiseType.name + ">");
        return expr;
    }

    visitNativeMemberExpression(expr: TstNativeMemberExpression): TstExpression {
        this.visit(expr.object);
        this.output.push(".#callback(" + expr.memberType.name + ")");
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

    visitLocalVarAssignment(stmt: TstLocalVarAssignment): TstStatement[] {
        this.output.push(stmt.name + " = ");
        this.visit(stmt.expr);
        this.output.push(";\n");
        return [ stmt ];
    }
}
