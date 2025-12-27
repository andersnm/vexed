

import { allTokens, ProgramParser } from "./Parser.js";
import { Lexer } from "chevrotain";
import { createVisitor } from "./ParserVisitor.js";
import { AstProgram } from "./AstProgram.js";
import { promises as fs } from "fs";
import { TstBuilder } from "./TstBuilder.js";
import { printObject } from "./visitors/TstPrintVisitor.js";
import { TstRuntime } from "./TstRuntime.js";

async function main() {

    console.log("Program started.")

    const lexer = new Lexer(allTokens);

    // const script = await fs.readFile("./examples/iam-1-class.awdsl", "utf-8");
    const fileName = process.argv[2] || "./examples/basic-array.awdsl";
    const script = await fs.readFile(fileName, "utf-8");
    const tokens = lexer.tokenize(script);

    if (tokens.errors.length > 0) {
        console.error("Lexing errors detected:");
        tokens.errors.forEach(err => {
            console.error(`${fileName}:${err.line}:${err.column}: ${err.message}`);
        });
        return;
    }

    const parser = new ProgramParser();
    parser.input = tokens.tokens;

    const cstProgram = parser.program();

    if (parser.errors.length > 0) {
        console.error("Parsing errors detected:");
        parser.errors.forEach(err => {
            console.error(`${fileName}:${err.token.startLine}:${err.token.startColumn}: ${err.message} (Rule: ${err.context.ruleStack[err.context.ruleStack.length - 1]})`);
        });
        return;
    }

    const visitor = createVisitor(parser);
    const visited: AstProgram = visitor.visit(cstProgram);

    const runtime = new TstRuntime();

    const resolver = new TstBuilder(runtime);
    resolver.resolveProgram(visited);

    const main = runtime.getType("Main");
    if (!main) {
        throw new Error("No Main class found");
    }

    const instance = main.createInstance([]);
    console.log("Created main instance: ", printObject(instance));

    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);
    // runtime.reduceInstance(instance);

    console.log("Print main instance:", printObject(instance));

    return;
}

main();
