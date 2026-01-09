import { TypeDefinition, TypeMethod } from "./TstType.js";
import { TstScope } from "./visitors/TstReduceExpressionVisitor.js";

export const TypeMeta: unique symbol = Symbol("TypeMeta");
export const InstanceMeta: unique symbol = Symbol("InstanceMeta");
export const ScopeMeta: unique symbol = Symbol("ScopeMeta");
export const RuntimeMeta: unique symbol = Symbol("RuntimeMeta");

export function isDecimalLiteral(expr: TstExpression): expr is TstDecimalLiteralExpression {
    return expr.exprType === "decimalLiteral";
}

export function isParameter(expr: TstExpression): expr is TstParameterExpression {
    return expr.exprType === "parameter";
}

export function isVariableExpression(expr: TstExpression): expr is TstVariableExpression {
    return expr.exprType === "variable";
}

export function isNewExpression(expr: TstExpression): expr is TstNewExpression {
    return expr.exprType === "new";
}

export function isFunctionCall(expr: TstExpression): expr is TstFunctionCallExpression {
    return expr.exprType === "functionCall";
}

export function isScopedExpression(expr: TstExpression): expr is TstScopedExpression {
    return expr.exprType === "scoped";
}

export function isInstanceExpression(expr: TstExpression): expr is TstInstanceExpression {
    return expr.exprType === "instance";
}

export function isNullExpression(expr: TstExpression): expr is TstNullExpression {
    return expr.exprType === "null";
}

export function isMemberExpression(expr: TstExpression): expr is TstMemberExpression {
    return expr.exprType === "member";
}

export function isThisExpression(expr: TstExpression): expr is TstThisExpression {
    return expr.exprType === "this";
}

export function isIndexExpression(expr: TstExpression): expr is TstIndexExpression {
    return expr.exprType === "index";
}

export function isBinaryExpression(expr: TstExpression): expr is TstBinaryExpression {
    return expr.exprType === "binary";
}

export function isUnaryExpression(expr: TstExpression): expr is TstUnaryExpression {
    return expr.exprType === "unary";
}

export function isPromiseExpression(expr: TstExpression): expr is TstPromiseExpression {
    return expr.exprType === "promise";
}

export function isNativeMemberExpression(expr: TstExpression): expr is TstNativeMemberExpression {
    return expr.exprType === "nativeMember";
}

export function isMissingInstanceExpression(expr: TstExpression): expr is TstMissingInstanceExpression {
    return expr.exprType === "missingInstance";
}

export function isIfStatement(stmt: TstStatement): stmt is TstIfStatement {
    return stmt.stmtType === "if";
}

export function isReturnStatement(stmt: TstStatement): stmt is TstReturnStatement {
    return stmt.stmtType === "return";
}

export function isStatementExpression(expr: TstExpression): expr is TstStatementExpression {
    return expr.exprType === "statement";
}

export function isLocalVarDeclaration(stmt: TstStatement): stmt is TstLocalVarDeclaration {
    return stmt.stmtType === "localVarDeclaration";
}

export function isLocalVarAssignment(stmt: TstStatement): stmt is TstLocalVarAssignment {
    return stmt.stmtType === "localVarAssignment";
}

export interface TstVariable {
    name: string;
    value: TstExpression;
    type: TypeDefinition;
};

export interface TstInitializer {
    name: string;
    argument: TstExpression;
}

export interface TstRuntimeInstanceInfo {
    sealed: boolean;
}

export type TstInstanceObject = {
    [TypeMeta]: TypeDefinition;
    [InstanceMeta]: any;
    [ScopeMeta]: Map<TypeDefinition, TstScope>;
    [RuntimeMeta]: TstRuntimeInstanceInfo;
    [key: string]: TstExpression; // TODO: it's really just an expression here when it reduces.
};

export interface TstExpression {
    exprType: string;
}

export interface TstDecimalLiteralExpression extends TstExpression {
    exprType: "decimalLiteral";
    value: number;
}

export interface TstParameterExpression extends TstExpression {
    exprType: "parameter";
    name: string;
    type: TypeDefinition
}

export interface TstVariableExpression extends TstExpression {
    exprType: "variable";
    name: string;
    type: TypeDefinition;
}

export interface TstNewExpression extends TstExpression {
    exprType: "new";
    type: TypeDefinition;
    args: TstExpression[];
}

export interface TstFunctionCallExpression extends TstExpression {
    exprType: "functionCall";
    method: TypeMethod;
    object: TstExpression;
    args: TstExpression[];
}

export interface TstStatementExpression extends TstExpression {
    exprType: "statement";
    statements: TstStatement[];
    returnType: TypeDefinition;
}

// TODO: This can simplify initialization:
// export interface TstInstancePropertyExpression extends TstExpression {
//     expr: TstExpression[];
//     defaultInitializer: TstExpression[] | null;
// }

export interface TstScopedExpression extends TstExpression {
    exprType: "scoped";
    expr: TstExpression;
    scope: TstScope;
}

export interface TstInstanceExpression extends TstExpression {
    exprType: "instance";
    instance: TstInstanceObject;
}

export interface TstIndexExpression extends TstExpression {
    exprType: "index";
    object: TstExpression;
    index: TstExpression;
}

export interface TstNullExpression extends TstExpression {
    exprType: "null";
}

export interface TstMemberExpression extends TstExpression {
    exprType: "member";
    object: TstExpression;
    property: string;
}

export interface TstThisExpression extends TstExpression {
    exprType: "this";
}

export interface TstBinaryExpression extends TstExpression {
    exprType: "binary";
    operator: string;
    left: TstExpression;
    right: TstExpression;
}

export interface TstUnaryExpression extends TstExpression {
    exprType: "unary";
    operator: string;
    operand: TstExpression;
}

export interface TstPromiseExpression extends TstExpression {
    exprType: "promise";
    promiseType: TypeDefinition;
    promise: Promise<TstExpression>;
    promiseError?: Error;
    promiseValue?: TstExpression;
}

export interface TstNativeMemberExpression extends TstExpression {
    exprType: "nativeMember";
    object: TstExpression;
    memberType: TypeDefinition;
    callback: (value: TstInstanceObject) => TstExpression;
}

export interface TstMissingInstanceExpression extends TstExpression {
    exprType: "missingInstance";
    error: Error;
    meta: {
        resourceType: string;
    };
    instance: TstInstanceObject;
    propertyName: string;
    propertyType: TypeDefinition;
}

export interface TstStatement {
    stmtType: "if" | "return" | "localVarDeclaration" | "localVarAssignment";
}

export interface TstIfStatement extends TstStatement {
    stmtType: "if";
    condition: TstExpression;
    then: TstStatement[];
    else: TstStatement[];
}

export interface TstReturnStatement extends TstStatement {
    stmtType: "return";
    returnValue: TstExpression;
}

export interface TstLocalVarDeclaration extends TstStatement {
    stmtType: "localVarDeclaration";
    varType: TypeDefinition;
    name: string;
    initializer: TstExpression;
}

export interface TstLocalVarAssignment extends TstStatement {
    stmtType: "localVarAssignment";
    name: string;
    expr: TstExpression;
}