import { Lexer } from "chevrotain";
import { allTokens, ProgramParser } from "./ProgramParser.js";
import { createVisitor } from "./ParserVisitor.js";
import { AstProgram } from "./AstProgram.js";

export interface ParserErrorInfo {
    fileName: string;
    line: number;
    column: number;
    message: string;
}

export class ParserError extends Error {
    constructor(message: string, public errors: ParserErrorInfo[]) {
        super(message);
    }
}

export class Parser {

    parse(script: string, fileName: string): AstProgram {
        const lexer = new Lexer(allTokens);
        const tokens = lexer.tokenize(script);

        if (tokens.errors.length > 0) {
            const errors = tokens.errors.map(err => {
                return { fileName, line: err.line!, column: err.column!, message: err.message };
            });

            throw new ParserError("Lexing errors detected", errors);
        }

        const parser = new ProgramParser();
        parser.input = tokens.tokens;

        const cstProgram = parser.program();

        if (parser.errors.length > 0) {
            const errors = parser.errors.map(err => {
                return { fileName, line: err.token.startLine!, column: err.token.startColumn!, message: err.message };
            });

            throw new ParserError("Parsing errors detected", errors);
        }

        const visitor = createVisitor(parser);
        return visitor.visit(cstProgram);
    }
}
