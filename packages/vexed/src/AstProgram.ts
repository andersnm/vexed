import { AstLocation } from "./AstLocation.js";
import { AstType, isAstArrayType, isAstFunctionType, isAstIdentifierType } from "./AstType.js";

export function isClass(programUnit: AstProgramUnit): programUnit is AstClass {
    return programUnit.type === "class";
}

export function isMethodDeclaration(resource: AstClassUnit): resource is AstMethodDeclaration {
    return resource.type === "methodDeclaration";
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

export function isAstBooleanLiteral(expr: AstExpression): expr is AstBooleanLiteralExpression {
    return expr.exprType === "booleanLiteral";
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

export function isAstBinaryExpression(expr: AstExpression): expr is AstBinaryExpression {
    return expr.exprType === "binary";
}

export function isAstUnaryExpression(expr: AstExpression): expr is AstUnaryExpression {
    return expr.exprType === "unary";
}

export function isAstNativeMember(expr: AstExpression): expr is AstNativeMemberExpression {
    return expr.exprType === "nativeMember";
}

export function isAstIfStatement(expr: AstStatement): expr is AstIfStatement {
    return expr.stmtType === "if";
}

export function isAstReturnStatement(expr: AstStatement): expr is AstReturnStatement {
    return expr.stmtType === "return";
}

export function isAstLocalVarDeclaration(expr: AstStatement): expr is AstLocalVarDeclaration {
    return expr.stmtType === "localVarDeclaration";
}

export function isAstLocalVarAssignment(expr: AstStatement): expr is AstLocalVarAssignment {
    return expr.stmtType === "localVarAssignment";
}

export interface AstExpression {
    exprType: string;
    location: AstLocation;
}

export interface AstIdentifierExpression extends AstExpression {
    exprType: "identifier";
    value: string;
}

export interface AstStringLiteralExpression extends AstExpression {
    exprType: "stringLiteral";
    value: string;
}

export interface AstIntegerLiteralExpression extends AstExpression {
    exprType: "integerLiteral";
    value: string;
}

export interface AstDecimalLiteralExpression extends AstExpression {
    exprType: "decimalLiteral";
    value: string;
}

export interface AstBooleanLiteralExpression extends AstExpression {
    exprType: "booleanLiteral";
    value: boolean;
}

export interface AstArrayLiteralExpression extends AstExpression {
    exprType: "arrayLiteral";
    elements: AstExpression[];
}

export interface AstFunctionCallExpression extends AstExpression {
    exprType: "functionCall";
    callee: AstExpression;
    args: AstExpression[];
    properties?: AstPropertyStatement[];
}

export interface AstMemberExpression extends AstExpression {
    exprType: "member";
    object: AstExpression;
    property: string;
}

export interface AstIndexExpression extends AstExpression{
    exprType: "index";
    object: AstExpression;
    index: AstExpression;
}

export interface AstBinaryExpression extends AstExpression {
    exprType: "binary";
    operator: string;
    lhs: AstExpression;
    rhs: AstExpression;
}

export interface AstUnaryExpression extends AstExpression {
    exprType: "unary";
    operator: string;
    operand: AstExpression;
}

export interface AstNativeMemberExpression extends AstExpression {
    exprType: "nativeMember";
    object: AstExpression;
    memberName: string;
    memberTypeName: string;
}

export interface AstParameter {
    name: string;
    type: AstType;
    location?: AstLocation;
}

export interface AstClassUnit {
    type: "methodDeclaration" | "propertyStatement" | "propertyDefinition";
    location?: AstLocation;
}

export interface AstProgramUnit {
    type: "class";
    location?: AstLocation;
}

export interface AstMethodDeclaration extends AstClassUnit {
    type: "methodDeclaration";
    name: string;
    genericParameters?: string[];
    returnType: AstType;
    parameters: AstParameter[];
    statementList: AstStatement[];
}

export interface AstStatement {
    stmtType: "if" | "return" | "localVarDeclaration" | "localVarAssignment";
    location: AstLocation;
}

export interface AstLocalVarDeclaration extends AstStatement {
    stmtType: "localVarDeclaration";
    varType: AstType;
    name: string;
    initializer: AstExpression | null;
}

export interface AstLocalVarAssignment extends AstStatement {
    stmtType: "localVarAssignment";
    name: string;
    // operator: "=" | "+=" | "-=" | "*=" | "/=";
    expr: AstExpression;
}

export interface AstIfStatement extends AstStatement {
    stmtType: "if";
    condition: AstExpression;
    thenBlock: AstStatement[];
    elseBlock: AstStatement[];
}

export interface AstReturnStatement extends AstStatement {
    stmtType: "return";
    returnValue: AstExpression;
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
    propertyType: AstType;
    argument: AstExpression | null;
}

export interface AstClass extends AstProgramUnit {
    type: "class";
    name: string;
    parameters: AstParameter[];
    extends?: string;
    extendsArguments?: AstExpression[];
    units: AstClassUnit[];
}

export interface AstProgram {
    fileName: string;
    programUnits: AstProgramUnit[];
}

export function formatAstTypeName(ref: AstType, classDef: AstClass, method: AstMethodDeclaration | null): string {
    if (isAstIdentifierType(ref)) {
        const methodGenericParameter = method?.genericParameters?.find(p => p === ref.typeName);
        if (methodGenericParameter) {
            return classDef.name + "~" + method!.name + "~" + methodGenericParameter;
        }

        return ref.typeName;
    }

    if (isAstArrayType(ref)) {
        return formatAstTypeName(ref.arrayItemType, classDef, method) + "[]";
    }

    if (isAstFunctionType(ref)) {
        const returnType = formatAstTypeName(ref.functionReturnType, classDef, method);
        const parameterTypes = ref.functionParameters.map(p => formatAstTypeName(p, classDef, method)).join(",");
        return returnType + "(" + parameterTypes + ")";
    }

    throw new Error("Unknown NativeTypeRef type: " + ref.type);
}
