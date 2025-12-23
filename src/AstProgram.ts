
export function isClass(programUnit: AstProgramUnit): programUnit is AstClass {
    return programUnit.type === "class";
}

export function isPropertyStatement(resource: AstClassUnit): resource is AstPropertyStatement {
    return resource.type === "propertyStatement";
}

export function isPropertyDefinition(resource: AstClassUnit): resource is AstPropertyDefinition {
    return resource.type === "propertyDefinition";
}

export function isAstStringLiteral(expr: AstExpression): expr is AstStringLiteralExpression {
    return expr.exprType === "stringLiteral";
}

export function isAstIntegerLiteral(expr: AstExpression): expr is AstIntegerLiteralExpression {
    return expr.exprType === "integerLiteral";
}

export function isAstDecimalLiteral(expr: AstExpression): expr is AstDecimalLiteralExpression {
    return expr.exprType === "decimalLiteral";
}

export function isAstFunctionCall(expr: AstExpression): expr is AstFunctionCallExpression {
    return expr.exprType === "functionCall";
}

export function isAstIdentifier(expr: AstExpression): expr is AstIdentifierExpression {
    return expr.exprType === "identifier";
}

export function isAstMember(expr: AstExpression): expr is AstMemberExpression {
    return expr.exprType === "member";
}

export function isAstArrayLiteral(expr: AstExpression): expr is AstArrayLiteralExpression {
    return expr.exprType === "arrayLiteral";
}

export function isAstIndexExpression(expr: AstExpression): expr is AstIndexExpression {
    return expr.exprType === "index";
}

export interface AstExpression {
    exprType: string;
    // type: string;
}

export interface AstIdentifierExpression {
    exprType: "identifier";
    value: string;
}

export interface AstStringLiteralExpression {
    exprType: "stringLiteral";
    value: string;
}

export interface AstIntegerLiteralExpression {
    exprType: "integerLiteral";
    value: string;
}

export interface AstDecimalLiteralExpression {
    exprType: "decimalLiteral";
    value: string;
}

export interface AstArrayLiteralExpression {
    exprType: "arrayLiteral";
    elements: AstExpression[];
}

export interface AstFunctionCallExpression {
    exprType: "functionCall";
    callee: AstExpression;
    args: AstExpression[];
}

export interface AstMemberExpression {
    exprType: "member";
    object: AstExpression;
    property: string;
}

export interface AstIndexExpression {
    exprType: "index";
    object: AstExpression;
    index: AstExpression;
}

export interface AstBinaryExpression extends AstExpression {
    exprType: "Plus" | "Minus" | "Multiply" | "Divide" | "Modulus";
    lhs: AstExpression;
    rhs: AstExpression;
}

export interface AstParameter {
    name: string;
    type: string;
}

export interface AstClassUnit {
    type: "propertyStatement" | "propertyDefinition";
}

export interface AstProgramUnit {
    type: "class";
}

export interface AstPropertyStatement extends AstClassUnit {
    type: "propertyStatement";
    name: string;
    argument: AstExpression;
}

export interface AstPropertyDefinition extends AstClassUnit {
    type: "propertyDefinition";
    modifier: string;
    name: string;
    propertyType: string;
    argument: AstExpression;
}

export interface AstClass extends AstProgramUnit {
    type: "class";
    name: string;
    parameters: { name: string, type: string }[];
    extends?: string;
    extendsArguments?: AstExpression[];
    units: AstClassUnit[];
}

export interface AstProgram {
    programUnits: AstProgramUnit[];
}
