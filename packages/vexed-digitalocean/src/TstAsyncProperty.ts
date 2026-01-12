import { InstanceMeta, isInstanceExpression, ScopeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMemberExpression, TstNativeMemberExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta } from "vexed";
import { getScopeParameter } from "vexed/dist/visitors/TstReduceExpressionVisitor.js";

export function getInstanceMetaFromScopeParameter<T>(instance: TstInstanceObject, parameterName: string): T {
    const instanceType = instance[TypeMeta];
    const scope = instance[ScopeMeta].get(instanceType)!;
    const parameter = getScopeParameter(scope, parameterName);
    if (!parameter) {
        throw new Error("'" + parameterName + "' constructor argument not found")
    }

    const parameterExpression = parameter.value;
    if (!isInstanceExpression(parameterExpression)) {
        throw new Error("Internal error: '" + parameterName + "' should be fully reduced at this point")
    }

    return parameterExpression.instance[InstanceMeta] as T;
}

export function makeThisRemoteNativeMemberExpression(memberType: TypeDefinition, callback: (remoteInstance: TstInstanceObject) => TstInstanceObject): TstNativeMemberExpression {
    return {
        exprType: "nativeMember", // invokes callback and reduces when object is an instance
        object: {
            exprType: "member",
            object: {
                exprType: "this"
            },
            property: "remote", // a promise to an opaque object, awaited by the runtime, translated to TstExpression by the callback
        },
        memberType,
        callback: (value: TstInstanceObject) => {
            return { 
                exprType: "instance",
                instance: callback(value),
            } as TstInstanceExpression;
        }
    } as TstNativeMemberExpression;
}

export function hasNameInstance(instance: TstInstanceObject): boolean {
    const nameExpr = instance["name"];
    if (!isInstanceExpression(nameExpr)) {
        return false;
    }

    return true;
}

