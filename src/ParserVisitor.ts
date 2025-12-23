import { ProgramParser } from "./Parser.js"; // your token definitions
import { AstClass, AstClassUnit, AstPropertyStatement, AstParameter, AstProgram, AstPropertyDefinition, AstExpression, AstIdentifierExpression, AstStringLiteralExpression, AstFunctionCallExpression, AstMemberExpression, AstIndexExpression, AstIntegerLiteralExpression, AstDecimalLiteralExpression, AstArrayLiteralExpression, isAstIdentifier } from "./AstProgram.js";

export function createVisitor(parser: ProgramParser) {
    const BaseCstVisitor = parser.getBaseCstVisitorConstructor();
    return new class extends BaseCstVisitor {
        constructor() {
            super();
            // This helper will detect any missing or redundant methods on this visitor
            this.validateVisitor();
        }

        program(ctx: any): AstProgram {
            const programUnits = ctx.programUnit.map((p: any) => this.visit(p))
            return { programUnits };
        }

        programUnit(ctx: any) {
            const keys = Object.keys(ctx);
            if (keys.length !== 1) {
                throw new Error("Program unit should only have one entry");
            }

            return this.visit(ctx[keys[0]]);
        }

        type(ctx: any): string {
            let base = ctx.Identifier[0].image;
            const suffixes = ctx.arrayTypeSuffix ?? [];
            for (const _ of suffixes) {
                base += "[]";
            }
            return base;
        }

        parameterList(ctx: any): AstParameter[] {
            if (!ctx.parameter) {
                return [];
            }

            return ctx.parameter.map((argNode: any) => this.visit(argNode));
        }

        parameter(ctx: any): AstParameter {
            
            // const type = ctx.Identifier[0].image;
            const type = this.visit(ctx.type);
            const name = ctx.Identifier[0].image;

            return { name, type };
        }

        class(ctx: any): AstClass {
            // This represent a type which can be instantiated with parameters
            // console.log("CLASS WITH EXTENDS ARGS", ctx.expressionList, ctx.expressionList ? this.visit(ctx.expressionList) : []);
            return {
                type: "class",
                name: ctx.Identifier[0].image,
                parameters: this.visit(ctx.parameterList),
                extends: ctx.Identifier[1] ? ctx.Identifier[1].image : null,
                extendsArguments: ctx.expressionList ? this.visit(ctx.expressionList) : null,
                units: ctx.classUnit ? ctx.classUnit.map((u: any) => this.visit(u)) : [],
            };
        }

        classUnit(ctx: any): AstClassUnit {
            const keys = Object.keys(ctx);
            if (keys.length !== 1) {
                throw new Error("Data block unit should only have one entry");
            }

            return this.visit(ctx[keys[0]]);
        }

        propertyStatement(ctx: any): AstPropertyStatement {
            return {
                type: "propertyStatement",
                name: ctx.Identifier[0].image,
                argument: this.visit(ctx.expression),
            };
        }

        propertyDefinition(ctx: any): AstPropertyDefinition {
            // console.log("propertyDefinition", ctx);
            return {
                type: "propertyDefinition",
                modifier: ctx.Public ? ctx.Public[0].image : ctx.Private[0].image,
                propertyType: this.visit(ctx.type),
                name: ctx.Identifier[0].image,
                argument: ctx.expression ? this.visit(ctx.expression) : null,
            };
        }

        expressionList(ctx: any) {
            if (!ctx.expression) {
                return [];
            }

            return ctx.expression.map((e: any) => this.visit(e));
        }

        expression(ctx: any): AstExpression {
            // Start with the primary expression
            let node = this.visit(ctx.primaryExpression);

            // console.log("Expression with suffixes:", ctx);
            if (ctx.suffix) {
                for (const s of ctx.suffix) {
                    node = this.visit(s, node);
                }
            }
            return node;
        }

        suffix(ctx: any, base: AstExpression): AstExpression {
            if (ctx.Dot) {
                return { exprType: "member", object: base, property: ctx.Identifier[0].image } as AstMemberExpression;
            }
            if (ctx.arguments) {
                return { exprType: "functionCall", callee: base, args: this.visit(ctx.arguments) } as AstFunctionCallExpression;
            }
            if (ctx.indexSuffix) {
                return { exprType: "index", object: base, index: this.visit(ctx.indexSuffix) } as AstIndexExpression;
            }

            if (ctx.arrayTypeSuffix) {
                if (isAstIdentifier(base)) {
                    return {
                        exprType: "identifier",
                        value: base.value + "[]"
                    } as AstIdentifierExpression ;
                } else {
                    throw new Error("Array type suffix can only be applied to identifiers");
                }
            }

            throw new Error("Unknown suffix type");
        }

        arrayTypeSuffix(ctx: any) {
            // visitor required but not actually used
            return "[]";
        }

        primaryExpression(ctx: any): AstExpression {
            if (ctx.Identifier) {
                return { exprType: "identifier", value: ctx.Identifier[0].image } as AstIdentifierExpression;
            }
            if (ctx.StringLiteral) {
                return { exprType: "stringLiteral", value: ctx.StringLiteral[0].image } as AstStringLiteralExpression;
            }
            if (ctx.IntegerLiteral) {
                return { exprType: "integerLiteral", value: ctx.IntegerLiteral[0].image } as AstIntegerLiteralExpression;
            }
            if (ctx.DecimalLiteral) {
                return { exprType: "decimalLiteral", value: ctx.DecimalLiteral[0].image } as AstDecimalLiteralExpression;
            }
            if (ctx.arrayLiteral) {
                return this.visit(ctx.arrayLiteral);
            }

            throw new Error("Unexpected primary expression");
        }

        arguments(ctx: any): AstExpression[] {
            return this.visit(ctx.expressionList);
        }

        indexSuffix(ctx: any): AstExpression {
            // console.log("INDEX SUFFIX", ctx);
            return this.visit(ctx.expression);
        }

        arrayLiteral(ctx: any): AstExpression {
            const elements = ctx.expression ? ctx.expression.map((exprCtx: any) => this.visit(exprCtx)) : [];
            return { exprType: "arrayLiteral", elements } as AstArrayLiteralExpression;
        }
    }
}
