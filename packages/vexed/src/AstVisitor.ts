import { AstClass, AstExpression, AstMethodDeclaration, AstProgram, AstStatement, formatAstTypeName, isAstArrayLiteral, isAstBinaryExpression, isAstBooleanLiteral, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIfStatement, isAstIndexExpression, isAstIntegerLiteral, isAstLocalVarAssignment, isAstLocalVarDeclaration, isAstMember, isAstReturnStatement, isAstStringLiteral, isAstUnaryExpression, isClass, isMethodDeclaration, isPropertyDefinition, isPropertyStatement } from "./AstProgram.js";
import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstStatement, TstThisExpression, TstUnaryExpression, TstUnboundFunctionReferenceExpression, TstVariable, TstVariableExpression } from "./TstExpression.js";
import { TypeDefinition, TypeMethod, TypeParameter } from "./TstType.js";
import { TstRuntime } from "./TstRuntime.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";
import { FunctionTypeDefinition, getFunctionTypeName } from "./types/FunctionTypeDefinition.js";

// There is no visitor for Ast types, it is only traversed once during conversion to Tst types.

export class AstVisitor {
    parent: AstVisitor|null;
    runtime: TstRuntime;
    thisType: TypeDefinition;
    parameters: TypeParameter[];
    scope: TypeParameter[] = []; // local variables

    constructor(parent: AstVisitor|null, runtime: TstRuntime, thisType: TypeDefinition, parameters: TypeParameter[]) {
        this.parent = parent;
        this.runtime = runtime;
        this.thisType = thisType;
        this.parameters = parameters;
    }

    resolveExpression(expr: AstExpression): TstExpression {
        if (isAstStringLiteral(expr)) {
            const stringType = this.runtime.getType("string");
            const stringObject = stringType.createInstance([]);
            stringObject[InstanceMeta] = expr.value;

            return {
                exprType: "instance",
                instance: stringObject
            } as TstInstanceExpression;
        }

        if (isAstIntegerLiteral(expr)) {
            return {
                exprType: "instance",
                instance: this.runtime.createInt(parseInt(expr.value))
            } as TstInstanceExpression;
        }

        if (isAstDecimalLiteral(expr)) {
            const decimalType = this.runtime.getType("decimal");
            const decimalObject = decimalType.createInstance([]);
            decimalObject[InstanceMeta] = parseFloat(expr.value);
            return {
                exprType: "instance",
                instance: decimalObject
            } as TstInstanceExpression;
        }

        if (isAstBooleanLiteral(expr)) {
            return {
                exprType: "instance",
                instance: this.runtime.createBool(expr.value)
            } as TstInstanceExpression;
        }

        if (isAstFunctionCall(expr)) {
            // TODO: constructor vs function typed variable
            if (isAstIdentifier(expr.callee)) {
                const functionName = expr.callee.value;
                const typeIfNewExpression = this.runtime.getType(functionName);
                if (!typeIfNewExpression) {
                    throw new Error("Unknown type: " + functionName);
                }

                return { exprType: "new", type: typeIfNewExpression, args: expr.args.map(arg => this.resolveExpression(arg)) } as TstNewExpression;
            }

            const callee = this.resolveExpression(expr.callee);
            const methodType = this.runtime.getExpressionType(callee);
            if (!methodType) {
                throw new Error("Could not find type for function call callee");
            }

            if (!(methodType instanceof FunctionTypeDefinition)) {
                throw new Error("Callee is not a function type");
            }

            const genericBindings = new Map<string, TypeDefinition>();

            const argumentExpressions = expr.args.map(arg => this.resolveExpression(arg));

            for (let i = 0; i < argumentExpressions.length; i++) {
                const argumentExpression = argumentExpressions[i];
                const methodParameterType = methodType.parameterTypes[i];

                const argumentType = this.runtime.getExpressionType(argumentExpression);
                if (!argumentType) {
                    throw new Error("Could not determine type of argument expression");
                }

                if (!this.runtime.inferBindings(methodParameterType, argumentType, genericBindings)) {
                    throw new Error(`Cannot infer bindings for function call argument ${i}: expected ${methodParameterType.name}, got ${argumentType.name}`);
                }
            }

            const returnType = this.runtime.constructGenericType(methodType.returnType, genericBindings);

            return {
                exprType: "functionCall", 
                callee: callee,
                args: argumentExpressions,
                returnType: returnType,
                genericBindings: genericBindings,
            } as TstFunctionCallExpression;
        }

        if (isAstIdentifier(expr)) {
            // Classify all identifiers as parameter, type, function, variable

            if (expr.value === "this") {
                return { exprType: "this", type: this.thisType } as TstThisExpression;
            } else {
                const pi = this.parameters.find(p => p.name == expr.value);
                if (pi) {
                    return { exprType: "parameter", name: expr.value, type: pi.type } as TstParameterExpression;
                }

                const vi = this.scope.find(v => v.name === expr.value);
                if (vi) {
                    return { exprType: "variable", name: expr.value, type: vi.type } as TstVariableExpression;
                }

                const gi = this.runtime.globalScope.variables.find(v => v.name === expr.value);
                if (gi) {
                    const giType = this.runtime.getExpressionType(gi.value);
                    return { exprType: "variable", name: expr.value, type: giType } as TstVariableExpression;
                }

                if (this.parent) {
                    return this.parent.resolveExpression(expr);
                }

                throw new Error("Unknown identifier " + expr.value)
            }
        }

        if (isAstMember(expr)) {
            return { exprType: "member", object: this.resolveExpression(expr.object), property: expr.property } as TstMemberExpression;
        }

        if (isAstArrayLiteral(expr)) {
            const elements = expr.elements.map(e => this.resolveExpression(e));
            const visitor = new TstExpressionTypeVisitor(this.runtime)
            const arrayType = this.runtime.findArrayType(visitor, elements);
            if (!arrayType) {
                throw new Error("Could not determine array type for elements");
            }

            // console.log("Literal array constructed at resolve time with type", arrayType?.name || "unknown");
            const arrayInstance = arrayType.createInstance([]);
            arrayInstance![InstanceMeta].push(...elements);

            return {
                exprType: "instance",
                instance: arrayInstance
            } as TstInstanceExpression;
        }

        if (isAstIndexExpression(expr)) {
            const objectExpr = this.resolveExpression(expr.object);
            const indexExpr = this.resolveExpression(expr.index);
            return {
                exprType: "index",
                object: objectExpr,
                index: indexExpr
            } as TstIndexExpression;
        }

        if (isAstBinaryExpression(expr)) {
            return {
                exprType: "binary",
                left: this.resolveExpression(expr.lhs),
                right: this.resolveExpression(expr.rhs),
                operator: expr.operator
            } as TstBinaryExpression;
        }

        if (isAstUnaryExpression(expr)) {
            // can resolve typeof with type instance directly
            return {
                exprType: "unary",
                operator: expr.operator,
                operand: this.resolveExpression(expr.operand),
            } as TstUnaryExpression;
        }

        throw new Error(`Unsupported expression type ${expr.exprType} in TstBuilder`);
    }

    resolveStatement(classDef: AstClass, method: AstMethodDeclaration, stmt: AstStatement): TstStatement {
        if (isAstReturnStatement(stmt)) {
            return {
                stmtType: "return",
                returnValue: this.resolveExpression(stmt.returnValue),
            } as TstReturnStatement;
        } else if (isAstIfStatement(stmt)) {
            return {
                stmtType: "if",
                condition: this.resolveExpression(stmt.condition),
                then: stmt.thenBlock.map(s => this.resolveStatement(classDef, method, s)),
                else: stmt.elseBlock ? stmt.elseBlock.map(s => this.resolveStatement(classDef, method, s)) : null
            } as TstIfStatement;
        } else if (isAstLocalVarDeclaration(stmt)) {
            const varTypeName = formatAstTypeName(stmt.varType, classDef, method);
            const varType = this.runtime.getType(varTypeName);

            this.scope.push({
                name: stmt.name,
                type: varType,
            });
            return {
                stmtType: "localVarDeclaration",
                varType: varType,
                name: stmt.name,
                initializer: stmt.initializer ? this.resolveExpression(stmt.initializer) : null,
            } as TstLocalVarDeclaration;
        } else if (isAstLocalVarAssignment(stmt)) {
            return {
                stmtType: "localVarAssignment",
                name: stmt.name,
                expr: this.resolveExpression(stmt.expr),
            } as TstLocalVarAssignment;
        }

        throw new Error("Unknown statement type " + stmt.stmtType);
    }
}
