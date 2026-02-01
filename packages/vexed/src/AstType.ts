import { AstLocation } from "./AstLocation.js";

export interface AstType {
    type: "identifier" | "function" | "array";
    location?: AstLocation;
}

export interface AstFunctionType extends AstType {
    type: "function";
    functionReturnType: AstType;
    functionParameters: AstType[];
}

export interface AstIdentifierType extends AstType {
    type: "identifier";
    typeName: string;
}

export interface AstArrayType extends AstType {
    type: "array";
    arrayItemType: AstType;
}

export function isAstIdentifierType(ref: AstType): ref is AstIdentifierType {
    return ref.type === "identifier";
}

export function isAstFunctionType(ref: AstType): ref is AstFunctionType {
    return ref.type === "function";
}

export function isAstArrayType(ref: AstType): ref is AstArrayType {
    return ref.type === "array";
}

