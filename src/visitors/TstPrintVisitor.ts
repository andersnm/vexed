import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIdentifierExpression, TstInstanceExpression, TstInstanceObject, TstMemberExpression, TstNewExpression, TstParameterExpression, TstScopedExpression, TstThisExpression, TypeMeta } from "../TstExpression.js";
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

        for (let propertyName of propertyNames) {
            this.printIndent();

            const propExpr = instanceType.resolveProperty(obj, propertyName);
            if (!propExpr) {
                throw new Error("Property expression not found: " + instanceType.name + "." + propertyName);
            }

            const propertyMember = instanceType.getProperty(propertyName)!;

            this.output.push(propertyName + ": " + propertyMember.type.name + " = ");
            this.visit(propExpr);
            this.output.push("\n");
        }

        this.dedent();

        this.printIndent();
        this.output.push("} ");
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        this.visit(expr.object);
        this.output.push("." + expr.property);
        return expr;
    }

    visitIdentifierExpression(expr: TstIdentifierExpression): TstExpression {
        this.output.push(expr.value);
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
        this.output.push(expr.functionName + "(");
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

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        this.visit(expr.expr);
        this.output.push("(scope: ");
            expr.parameters.forEach((param, index) => {
                this.output.push(param.name + "=");
                this.visit(param.value);
                if (index < expr.parameters.length - 1) {
                    this.output.push(", ");
                }
            });
        this.output.push(")");
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
}
