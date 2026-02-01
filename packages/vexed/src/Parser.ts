import { Lexer } from "chevrotain";
import { allTokens, ProgramParser } from "./ProgramParser.js";
import { createVisitor } from "./ParserVisitor.js";
import { AstProgram } from "./AstProgram.js";
import { ScriptError, ScriptErrorInfo } from "./ScriptError.js";
import { AstLocation } from "./AstLocation.js";

export class Parser {

    parse(script: string, fileName: string): AstProgram {
        const lexer = new Lexer(allTokens);
        const tokens = lexer.tokenize(script);

        if (tokens.errors.length > 0) {
            const errors: ScriptErrorInfo[] = tokens.errors.map(err => {
                return {
                    message: err.message,
                    location: { fileName, line: err.line!, column: err.column!, startOffset: err.column!, endOffset: err.column! } as AstLocation
                };
            });

            throw new ScriptError("Lexing errors detected", errors);
        }

        const parser = new ProgramParser();
        parser.input = tokens.tokens;

        const cstProgram = parser.program();

        if (parser.errors.length > 0) {
            const errors: ScriptErrorInfo[] = parser.errors.map(err => {
                return {
                    message: err.message,
                    location: { fileName, line: err.token.startLine!, column: err.token.startColumn!, startOffset: err.token.startColumn!, endOffset: err.token.endColumn! } as AstLocation
                };
            });

            throw new ScriptError("Parsing errors detected", errors);
        }

        const visitor = createVisitor(parser, fileName);
        return visitor.visit(cstProgram);
    }
}
