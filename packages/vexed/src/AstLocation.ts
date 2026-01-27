// The "location" property can be undefined in AST types appearing frequently in native bindings.

export interface AstLocation {
    fileName: string;
    line: number;
    column: number;
    startOffset: number;
    endOffset: number;
    image: string;
}
