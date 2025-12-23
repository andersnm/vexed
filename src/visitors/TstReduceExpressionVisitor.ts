import { InstanceMeta, isInstanceExpression, TstExpression, TstIdentifierExpression, TstIndexExpression, TstInstanceExpression, TstInstanceObject, TstMemberExpression, TstNewExpression, TstParameterExpression, TstScopedExpression, TstThisExpression, TstVariable, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export class TstReduceExpressionVisitor extends TstReplaceVisitor {

    constructor(private runtime: TstRuntime, private thisObject: TstInstanceObject, private currentParameters: TstVariable[] = [], private visitedInstances: Set<TstInstanceObject> = new Set()) {
        super();
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        const objectExpression = this.visit(expr.object);

        if (isInstanceExpression(objectExpression)) {
            const instanceType = objectExpression.instance[TypeMeta];
            const propertyExpression = instanceType.resolveProperty(objectExpression.instance, expr.property);

            // If the property is legit, but the property doesnt exist, it's not resolved yet, so dont reduce
            // TODO: Beware, if the property is an overriden default, this could resolve to the original default
            if (propertyExpression) {
                const reduced = this.visit(propertyExpression);
                if (isInstanceExpression(reduced) || reduced.exprType === "decimalLiteral") {
                    return reduced;
                }

                return reduced;
            }
        }

        return {
            exprType: "member",
            object: objectExpression,
            property: expr.property,
        } as TstMemberExpression;
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        // console.log("Visiting parameter expression", expr.name);
        const parameter = this.currentParameters.find(p => p.name === expr.name);
        if (parameter) {
            return this.visit(parameter.value);
        }

        throw new Error("Parameter not found: " + expr.name);
    }

    visitIdentifierExpression(expr: TstIdentifierExpression): TstExpression {
        throw new Error("Identifier not found: " + expr.value);
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        return {
            exprType: "instance",
            instance: this.thisObject,
        } as TstInstanceExpression;
    }

    visitNewExpression(expr: TstNewExpression): TstExpression {
        const instance = expr.type.createInstance(expr.args);

        return {
            exprType: "instance",
            instance: instance,
        } as TstInstanceExpression;
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        // TODO: can only reduce this if all parameters are reduced!
        const scopeVisitor = new TstReduceExpressionVisitor(this.runtime, this.thisObject, expr.parameters, this.visitedInstances);
        const visited = scopeVisitor.visit(expr.expr);
        return visited;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        // Should be no-op if instance was already resolved during this visitation
        if (this.visitedInstances.has(expr.instance)) {
            return expr;
        }

        this.visitedInstances.add(expr.instance);

        const instanceType = expr.instance[TypeMeta];

        for (let propertyName in expr.instance) {
            // TODO: does not have to write reduce native properties back to object, but presumed harmless at the moment
            const propertyExpr = instanceType.resolveProperty(expr.instance, propertyName);
            if (!propertyExpr) {
                throw new Error("Property " + propertyName + " not found on instance of type " + instanceType.name);
            }

            const reduced = this.visit(propertyExpr);
            expr.instance[propertyName] = reduced;
        }
        return expr;
    }

    visitIndexExpression(expr: TstIndexExpression): TstExpression {
        const objectExpr = this.visit(expr.object);
        const indexExpr = this.visit(expr.index);

        if (isInstanceExpression(objectExpr) && isInstanceExpression(indexExpr)) {
            const instanceType = objectExpr.instance[TypeMeta];
            const indexType = indexExpr.instance[TypeMeta];
            if (indexType != this.runtime.getType("int")) {
                throw new Error("Index expression must be of type int");
            }

            const indexValue = indexExpr.instance[InstanceMeta] as number;

            // If both the object and index are instances, we can try to resolve the index
            const resolved = instanceType.resolveIndex(objectExpr.instance, indexValue);
            if (resolved) {
                return resolved;
            }
        }

        return {
            exprType: "index",
            object: objectExpr,
            index: indexExpr
        } as TstIndexExpression;
    }
}
