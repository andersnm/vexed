import { AstArrayLiteralExpression, AstBinaryExpression, AstBooleanLiteralExpression, AstClass, AstClassUnit, AstDecimalLiteralExpression, AstExpression, AstFunctionCallExpression, AstIdentifierExpression, AstIfStatement, AstIndexExpression, AstIntegerLiteralExpression, AstLocalVarAssignment, AstLocalVarDeclaration, AstMemberExpression, AstMethodDeclaration, AstProgram, AstProgramUnit, AstPropertyDefinition, AstPropertyStatement, AstReturnStatement, AstStatement, AstStringLiteralExpression, AstUnaryExpression, isAstArrayLiteral, isAstBinaryExpression, isAstBooleanLiteral, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIfStatement, isAstIndexExpression, isAstIntegerLiteral, isAstLocalVarAssignment, isAstLocalVarDeclaration, isAstMember, isAstReturnStatement, isAstStringLiteral, isAstUnaryExpression, isClass, isMethodDeclaration, isPropertyDefinition, isPropertyStatement } from "../AstProgram.js";

// A replacing visitor base class for traversing AST nodes

export class AstReplaceVisitor {

    visitProgram(expr: AstProgram): AstProgram {
        return {
            fileName: expr.fileName,
            programUnits: expr.programUnits.map(unit => this.visitProgramUnit(unit)),
        }
    }

    visitProgramUnit(unit: AstProgramUnit): AstProgramUnit {
        if (isClass(unit)) {
            return this.visitClassDefinition(unit);
        }

        throw new Error(`AstBaseVisitor: Unhandled program unit type: ${unit.type}`);
    }

    visitClassDefinition(classDef: AstClass): AstClass {
        return {
            type: classDef.type,
            name: classDef.name,
            parameters: classDef.parameters,
            extends: classDef.extends,
            extendsArguments: classDef.extendsArguments,
            units: classDef.units.map(unit => this.visitClassUnit(unit)),
            location: classDef.location,
        };
    }

    visitClassUnit(unit: AstClassUnit): AstClassUnit {
        if (isPropertyDefinition(unit)) {
            return this.visitPropertyDefinition(unit);
        }

        if (isMethodDeclaration(unit)) {
            return this.visitMethodDeclaration(unit);
        }

        if (isPropertyStatement(unit)) {
            return this.visitPropertyStatement(unit);
        }

        throw new Error(`AstBaseVisitor: Unhandled class unit type: ${unit.type}`);
    }

    visitPropertyDefinition(propDef: AstPropertyDefinition): AstPropertyDefinition {
        return {
            modifier: propDef.modifier,
            type: propDef.type,
            name: propDef.name,
            propertyType: propDef.propertyType,
            argument: propDef.argument ? this.visitExpression(propDef.argument) : null,
            location: propDef.location,
        };
    }

    visitMethodDeclaration(methodDef: AstMethodDeclaration): AstMethodDeclaration {
        return {
            type: methodDef.type,
            name: methodDef.name,
            parameters: methodDef.parameters,
            returnType: methodDef.returnType,
            genericParameters: methodDef.genericParameters,
            statementList: this.visitStatementList(methodDef.statementList),
            location: methodDef.location,
        };
    }

    visitPropertyStatement(propStmt: AstPropertyStatement): AstPropertyStatement {
        return {
            type: propStmt.type,
            name: propStmt.name,
            argument: this.visitExpression(propStmt.argument),
            location: propStmt.location,
        };
    }

    visitExpression(expr: AstExpression): AstExpression {
        if (isAstStringLiteral(expr)) {
            return this.visitStringLiteral(expr);
        }
        if (isAstIntegerLiteral(expr)) {
            return this.visitIntegerLiteral(expr);
        }
        if (isAstDecimalLiteral(expr)) {
            return this.visitDecimalLiteral(expr);
        }
        if (isAstBooleanLiteral(expr)) {
            return this.visitBooleanLiteral(expr);
        }
        if (isAstArrayLiteral(expr)) {
            return this.visitArrayLiteral(expr);
        }
        if (isAstFunctionCall(expr)) {
            return this.visitFunctionCall(expr);
        }
        if (isAstIdentifier(expr)) {
            return this.visitIdentifier(expr);
        }
        if (isAstMember(expr)) {
            return this.visitMember(expr);
        }
        if (isAstIndexExpression(expr)) {
            return this.visitIndexExpression(expr);
        }
        if (isAstBinaryExpression(expr)) {
            return this.visitBinaryExpression(expr);
        }
        if (isAstUnaryExpression(expr)) {
            return this.visitUnaryExpression(expr);
        }
        throw new Error(`AstBaseVisitor: Unhandled expression type: ${expr.exprType}`);
    }

    visitStringLiteral(expr: AstStringLiteralExpression): AstExpression {
        return {
            exprType: expr.exprType,
            value: expr.value,
            location: expr.location,
        } as AstStringLiteralExpression;
    }

    visitIntegerLiteral(expr: AstIntegerLiteralExpression): AstExpression {
        return {
            exprType: expr.exprType,
            value: expr.value,
            location: expr.location,
        } as AstIntegerLiteralExpression;
    }

    visitDecimalLiteral(expr: AstDecimalLiteralExpression): AstExpression {
        return {
            exprType: expr.exprType,
            value: expr.value,
            location: expr.location,
        } as AstDecimalLiteralExpression;
    }

    visitBooleanLiteral(expr: AstBooleanLiteralExpression): AstExpression {
        return {
            exprType: expr.exprType,
            value: expr.value,
            location: expr.location,
        } as AstBooleanLiteralExpression;
    }

    visitArrayLiteral(expr: AstArrayLiteralExpression): AstExpression {
        return {
            exprType: expr.exprType,
            elements: expr.elements.map(e => this.visitExpression(e)),
            location: expr.location,
        } as AstArrayLiteralExpression;
    }

    visitFunctionCall(expr: AstFunctionCallExpression): AstExpression {
        return {
            exprType: expr.exprType,
            callee: this.visitExpression(expr.callee),
            args: expr.args.map(arg => this.visitExpression(arg)),
            properties: expr.properties,
            location: expr.location,
        } as AstFunctionCallExpression;
    }

    visitIdentifier(expr: AstIdentifierExpression): AstExpression {
        return {
            exprType: expr.exprType,
            value: expr.value,
            location: expr.location,
        } as AstIdentifierExpression;
    }

    visitMember(expr: AstMemberExpression): AstExpression {
        return {
            exprType: expr.exprType,
            object: this.visitExpression(expr.object),
            property: expr.property,
            location: expr.location,
        } as AstMemberExpression;
    }

    visitIndexExpression(expr: AstIndexExpression): AstExpression {
        return {
            exprType: expr.exprType,
            object: this.visitExpression(expr.object),
            index: this.visitExpression(expr.index),
            location: expr.location,
        } as AstIndexExpression;
    }

    visitBinaryExpression(expr: AstBinaryExpression): AstExpression {
        return {
            exprType: expr.exprType,
            operator: expr.operator,
            lhs: this.visitExpression(expr.lhs),
            rhs: this.visitExpression(expr.rhs),
            location: expr.location,
        } as AstBinaryExpression;
    }

    visitUnaryExpression(expr: AstUnaryExpression): AstExpression {
        return {
            exprType: expr.exprType,
            operator: expr.operator,
            operand: this.visitExpression(expr.operand),
            location: expr.location,
        } as AstUnaryExpression;
    }

    visitStatement(stmt: AstStatement): AstStatement {
        if (isAstIfStatement(stmt)) {
            return this.visitIfStatement(stmt);
        }
        if (isAstReturnStatement(stmt)) {
            return this.visitReturnStatement(stmt);
        }
        if (isAstLocalVarDeclaration(stmt)) {
            return this.visitLocalVarDeclaration(stmt);
        }
        if (isAstLocalVarAssignment(stmt)) {
            return this.visitLocalVarAssignment(stmt);
        }
        throw new Error(`AstBaseVisitor: Unhandled statement type: ${stmt.stmtType}`);
    }

    visitIfStatement(stmt: AstIfStatement): AstStatement {
        return {
            stmtType: "if",
            condition: this.visitExpression(stmt.condition),
            thenBlock: this.visitStatementList(stmt.thenBlock),
            elseBlock: this.visitStatementList(stmt.elseBlock),
            location: stmt.location,
        } as AstIfStatement;
    }

    visitReturnStatement(stmt: AstReturnStatement): AstStatement {
        return {
            stmtType: "return",
            returnValue: this.visitExpression(stmt.returnValue),
            location: stmt.location,
        } as AstReturnStatement;
    }

    visitLocalVarDeclaration(stmt: AstLocalVarDeclaration): AstStatement {
        return {
            stmtType: "localVarDeclaration",
            varType: stmt.varType,
            name: stmt.name,
            initializer: stmt.initializer ? this.visitExpression(stmt.initializer) : null,
            location: stmt.location,
        } as AstLocalVarDeclaration;
    }

    visitLocalVarAssignment(stmt: AstLocalVarAssignment): AstStatement {
        return {
            stmtType: "localVarAssignment",
            name: stmt.name,
            expr: this.visitExpression(stmt.expr),
            location: stmt.location,
        } as AstLocalVarAssignment;
    }

    visitStatementList(stmtList: AstStatement[]): AstStatement[] {
        const result: AstStatement[] = [];
        for (let stmt of stmtList) {
            const visited = this.visitStatement(stmt);
            result.push(visited);
        }
        return result;
    }
}
