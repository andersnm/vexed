import { TypeDefinition, TypeMethod } from "./TstType.js";

export const TypeMeta: unique symbol = Symbol("TypeMeta");
export const InstanceMeta: unique symbol = Symbol("InstanceMeta");

export function isDecimalLiteral(expr: TstExpression): expr is TstDecimalLiteralExpression {
    return expr.exprType === "decimalLiteral";
}

export function isIdentifier(expr: TstExpression): expr is TstIdentifierExpression {
    return expr.exprType === "identifier";
}

export function isParameter(expr: TstExpression): expr is TstParameterExpression {
    return expr.exprType === "parameter";
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

export interface TstVariable {
    name: string;
    value: TstExpression;
};

export interface TstInitializer {
    name: string;
    argument: TstExpression;
}

export type TstInstanceObject = {
    [TypeMeta]: TypeDefinition;
    [InstanceMeta]: any;
    [key: string]: TstExpression; // TODO: it's really just an expression here when it reduces.
};

export interface TstExpression {
    exprType: string;
}

export interface TstDecimalLiteralExpression extends TstExpression {
    exprType: "decimalLiteral";
    value: number;
}

export interface TstIdentifierExpression extends TstExpression {
    exprType: "identifier";
    value: string;
}

export interface TstParameterExpression extends TstExpression {
    exprType: "parameter";
    name: string;
    type: TypeDefinition
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

// TODO: This can simplify initialization:
// export interface TstInstancePropertyExpression extends TstExpression {
//     expr: TstExpression[];
//     defaultInitializer: TstExpression[] | null;
// }

export interface TstScopedExpression extends TstExpression {
    exprType: "scoped";
    parameters: TstVariable[];
    expr: TstExpression;
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
