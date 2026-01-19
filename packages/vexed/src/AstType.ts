export interface AstType {
    type: "identifier" | "function" | "array";
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

export function formatAstTypeName(ref: AstType): string {
    if (isAstIdentifierType(ref)) {
        // const scopeType = scope[ref.typeName];
        // if (scopeType) {
        //     return scopeType.name;
        // }
        return ref.typeName;
    }

    if (isAstArrayType(ref)) {
        return formatAstTypeName(ref.arrayItemType) + "[]";
    }

    if (isAstFunctionType(ref)) {
        const returnType = formatAstTypeName(ref.functionReturnType);
        const parameterTypes = ref.functionParameters.map(p => formatAstTypeName(p)).join(",");
        return returnType + "(" + parameterTypes + ")";
    }

    throw new Error("Unknown NativeTypeRef type: " + ref.type);
}
