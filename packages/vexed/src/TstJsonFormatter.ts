import { InstanceMeta, isInstanceExpression, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIfStatement, TstInstanceExpression, TstInstanceObject, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstReturnStatement, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstVariableExpression, TypeMeta } from "./TstExpression.js";
import { TypeDefinition } from "./TstType.js";

export const printJsonObject = (obj: TstInstanceObject, force: boolean = false) => {
    const printer = new TstJsonFormatter(force);
    return printer.printObject(obj);
}

function isTstArrayInstance(obj: TstInstanceObject): boolean {
    const typeDef = obj[TypeMeta];
    return typeDef.name.endsWith("[]");
}

class TstJsonFormatter {

    force: boolean;
    printedInstances: Set<TstInstanceObject> = new Set();

    constructor(force: boolean = false) {
        this.force = force;
    }

    printObject(obj: TstInstanceObject): any {
        const instanceType = obj[TypeMeta];

        if (isTstArrayInstance(obj)) {
            const arrayValue = obj[InstanceMeta] as TstExpression[];
            return this.printExpressionList(arrayValue);
        }
        
        if (instanceType === instanceType.runtime.getType("string")) {
            return obj[InstanceMeta];
        }

        if (instanceType === instanceType.runtime.getType("int")) {
            return obj[InstanceMeta];
        }

        if (instanceType === instanceType.runtime.getType("bool")) {
            return obj[InstanceMeta];
        }

        const outObj: any = {};
        this.printProperties(obj, instanceType, outObj);
        return outObj;
    }

    printProperties(obj: TstInstanceObject, instanceType: TypeDefinition, outObj: any) {
        if (instanceType.extends) {
            this.printProperties(obj, instanceType.extends, outObj);
        }

        for (let property of instanceType.properties) {
            const propertyName = property.name;
            const propExpr = instanceType.resolveProperty(obj, propertyName);
            if (propExpr) {
                outObj[propertyName] = this.printInstanceExpression(propExpr);
            } else {
                if (this.force) {
                    outObj[propertyName] = "<undefined>";
                } else {
                    throw new Error(`Property ${propertyName} not found on instance of type ${instanceType.name}`);
                }
            }
        }
    }

    printExpressionList(exprs: TstExpression[]) {
        return exprs.map(arg => this.printInstanceExpression(arg));
    }

    printInstanceExpression(expr: TstExpression) {
        if (isInstanceExpression(expr)) {
            return this.printObject(expr.instance);
        }

        if (this.force) {
            return "<non-instance expression>";
        }

        throw new Error("Cannot print non-instance expression: " + expr.exprType);
    }
}
