import { InstanceMeta, isInstanceExpression, ScopeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMemberExpression, TstNativeMemberExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta, AstNativeMemberExpression } from "vexed";
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

// Helper for creating AST native member expression for accessing this.remote.memberName
export function makeAstThisRemoteNativeMemberExpression(memberTypeName: string, memberName: string): AstNativeMemberExpression {
    // The object will be set to this.remote during TST conversion
    // We use a placeholder identifier here
    return {
        exprType: "nativeMember",
        object: {
            exprType: "identifier",
            value: "__this_remote__", // Placeholder - will be converted to this.remote in visitor
            location: { fileName: "<native>", line: 0, column: 0 },
        } as any,
        memberTypeName,
        memberName,
        location: { fileName: "<native>", line: 0, column: 0 },
    } as AstNativeMemberExpression;
}

// Legacy helper for creating TST native member expression (used by runtime code)
export function makeThisRemoteNativeMemberExpression(memberType: TypeDefinition, memberName: string, callback: (remoteInstance: TstInstanceObject) => TstInstanceObject): TstNativeMemberExpression {
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
        memberName,
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
