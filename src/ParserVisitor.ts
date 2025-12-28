import { ProgramParser } from "./Parser.js"; // your token definitions
import { AstClass, AstClassUnit, AstPropertyStatement, AstParameter, AstProgram, AstPropertyDefinition, AstExpression, AstIdentifierExpression, AstStringLiteralExpression, AstFunctionCallExpression, AstMemberExpression, AstIndexExpression, AstIntegerLiteralExpression, AstDecimalLiteralExpression, AstArrayLiteralExpression, isAstIdentifier, AstBinaryExpression, AstLocation, AstMethodDeclaration, AstIfStatement, AstStatement, AstReturnStatement, AstUnaryExpression, AstLocalVarDeclaration, AstBooleanLiteralExpression } from "./AstProgram.js";
import { IToken } from "chevrotain";

function createTokenLocation(tok: IToken): AstLocation {
    return {
        line: tok.startLine!,
        column: tok.startColumn!,
        startOffset: tok.startOffset,
        endOffset: tok.endOffset!,
        image: tok.image
    };
}

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

        methodDeclaration(ctx: any): AstMethodDeclaration {
            const returnType = this.visit(ctx.type[0]);
            const nameToken = ctx.Identifier[0];

            const parameters = ctx.parameterList
                ? this.visit(ctx.parameterList[0])
                : [];


            const statementList = ctx.statementList ? this.visit(ctx.statementList[0]) : null;

            return {
                type: "methodDeclaration",
                name: nameToken.image,
                returnType,
                parameters,
                statementList,
            };
        }

        statementList(ctx: any): AstStatement[] {
            const statements = ctx.statement ? ctx.statement.map((s: any) => this.visit(s)) : [];
            return statements;
        }

        statement(ctx: any): AstStatement {
            if (ctx.ifStatement) return this.visit(ctx.ifStatement);
            if (ctx.returnStatement) return this.visit(ctx.returnStatement);
            if (ctx.localVarDeclaration) return this.visit(ctx.localVarDeclaration);
            throw new Error("Unsupported statement kind");
        }

        localVarDeclaration(ctx: any): AstLocalVarDeclaration {
            return {
                stmtType: "localVarDeclaration",
                varType: this.visit(ctx.type),
                name: ctx.Identifier[0].image,
                initializer: ctx.expression ? this.visit(ctx.expression) : null,
            };
        }

        ifStatement(ctx: any): AstIfStatement {
            const condition = this.visit(ctx.expression);

            const thenBlock = this.visit(ctx.statementList[0]);

            let elseBlock: AstStatement[];
            if (ctx.Else) {
                if (ctx.ifStatement && ctx.ifStatement[0]) {
                    elseBlock = [ this.visit(ctx.ifStatement[0]) ];
                } else if (ctx.statementList && ctx.statementList[1]) {
                    elseBlock = this.visit(ctx.statementList[1]);
                } else {
                    throw new Error("Unsupported else block");
                }
            } else {
                elseBlock = [];
            }

            return {
                stmtType: "if",
                condition,
                thenBlock,
                elseBlock
            };
        }

        returnStatement(ctx: any): AstReturnStatement {
            return {
                stmtType: "return",
                returnValue: this.visit(ctx.expression),
            };
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
            if (ctx.logicalOr) {
                return this.visit(ctx.logicalOr);
            }

            throw new Error("Unexpected expression shape");
        }

        logicalOr(ctx: any): AstExpression {
            let node = this.visit(ctx.logicalAnd[0]);

            const opsCount = (ctx.logicalAnd?.length ?? 1) - 1;
            for (let i = 0; i < opsCount; i++) {
                let operatorToken = ctx.Or[i];
                if (!operatorToken) {
                    throw new Error("Missing logical OR operator token");
                }

                const right = this.visit(ctx.logicalAnd[i + 1]);
                node = {
                    exprType: "binary",
                    operator: operatorToken.image,
                    lhs: node,
                    rhs: right
                } as AstBinaryExpression;
            }

            return node;
        }

        logicalAnd(ctx: any): AstExpression {
            let node = this.visit(ctx.logicalNot[0]);

            const opsCount = (ctx.logicalNot?.length ?? 1) - 1;
            for (let i = 0; i < opsCount; i++) {
                let operatorToken = ctx.And[i];
                if (!operatorToken) {
                    throw new Error("Missing logical AND operator token");
                }

                const right = this.visit(ctx.logicalNot[i + 1]);
                node = {
                    exprType: "binary",
                    operator: operatorToken.image,
                    lhs: node,
                    rhs: right
                } as AstBinaryExpression;
            }

            return node;
        }

        logicalNot(ctx: any): AstExpression {
            let expr = this.visit(ctx.equality[0]);

            if (ctx.Not && ctx.Not[0]) {
                return {
                    exprType: "unary",
                    operator: "!",
                    operand: expr,
                } as AstUnaryExpression;
            }

            return expr;
        }

        equality(ctx: any): AstExpression {
            let node = this.visit(ctx.comparison[0]);

            const opsCount = (ctx.comparison?.length ?? 1) - 1;
            for (let i = 0; i < opsCount; i++) {
                let operatorToken = ctx.EqualsEquals[i] || ctx.NotEquals[i];
                if (!operatorToken) {
                    throw new Error("Missing equality operator token");
                }

                const right = this.visit(ctx.comparison[i + 1]);
                node = {
                    exprType: "binary",
                    operator: operatorToken.image,
                    lhs: node,
                    rhs: right
                } as AstBinaryExpression;
            }

            return node;
        }

        comparison(ctx: any): AstExpression {
            let node = this.visit(ctx.additiveExpression[0]);

            const opsCount = (ctx.additiveExpression?.length ?? 1) - 1;
            for (let i = 0; i < opsCount; i++) {
                let operatorToken = ctx.LessThan && ctx.LessThan[i];
                if (!operatorToken && ctx.GreaterThan && ctx.GreaterThan[i]) {
                    operatorToken = ctx.GreaterThan[i];
                } else if (!operatorToken && ctx.LessThanOrEqual && ctx.LessThanOrEqual[i]) {
                    operatorToken = ctx.LessThanOrEqual[i];
                } else if (!operatorToken && ctx.GreaterThanOrEqual && ctx.GreaterThanOrEqual[i]) {
                    operatorToken = ctx.GreaterThanOrEqual[i];
                }

                if (!operatorToken) {
                    throw new Error("Missing comparison operator token");
                }

                const right = this.visit(ctx.additiveExpression[i + 1]);
                node = {
                    exprType: "binary",
                    operator: operatorToken.image,
                    lhs: node,
                    rhs: right
                } as AstBinaryExpression;
            }

            return node;
        }

        additiveExpression(ctx: any): AstExpression {
            let node = this.visit(ctx.multiplicativeExpression[0]);

            const opsCount = (ctx.multiplicativeExpression?.length ?? 1) - 1;
            for (let i = 0; i < opsCount; i++) {
                let operatorToken = undefined;
                if (ctx.Plus && ctx.Plus[i]) operatorToken = ctx.Plus[i];
                else if (ctx.Minus && ctx.Minus[i]) operatorToken = ctx.Minus[i];

                if (!operatorToken) {
                    throw new Error("Missing additive operator token");
                }

                const right = this.visit(ctx.multiplicativeExpression[i + 1]);
                node = {
                    exprType: "binary",
                    operator: operatorToken.image,
                    lhs: node,
                    rhs: right
                } as AstBinaryExpression;
            }

            return node;
        }

        multiplicativeExpression(ctx: any): AstExpression {
            let node = this.visit(ctx.memberExpression[0]);

            const opsCount = ctx.memberExpression ? ctx.memberExpression.length - 1 : 0;
            for (let i = 0; i < opsCount; i++) {
                let operatorToken = undefined;
                if (ctx.Star && ctx.Star[i]) operatorToken = ctx.Star[i];
                else if (ctx.Slash && ctx.Slash[i]) operatorToken = ctx.Slash[i];

                if (!operatorToken) {
                    throw new Error("Missing multiplicative operator token");
                }

                const right = this.visit(ctx.memberExpression[i + 1]);
                node = {
                    exprType: "binary",
                    operator: operatorToken.image,
                    lhs: node,
                    rhs: right
                } as AstBinaryExpression;
            }

            return node;
        }

        memberExpression(ctx: any, baseArg?: AstExpression): AstExpression {
            // if called as a subrule result it will have memberExpression array
            if (ctx.primaryExpression) {
                let node = this.visit(ctx.primaryExpression);
                if (ctx.suffix) {
                    for (const s of ctx.suffix) {
                        node = this.visit(s, node);
                    }
                }
                return node;
            }

            // if called from suffix visitor with a base argument, just return it
            if (baseArg) return baseArg;

            throw new Error("Unexpected memberExpression shape");
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
            if (ctx.BooleanLiteral) {
                return { exprType: "booleanLiteral", value: ctx.BooleanLiteral[0].image === "true" } as AstBooleanLiteralExpression;
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
