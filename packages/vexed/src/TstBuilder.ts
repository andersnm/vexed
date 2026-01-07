import { AstExpression, AstProgram, AstStatement, isAstArrayLiteral, isAstBinaryExpression, isAstBooleanLiteral, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIfStatement, isAstIndexExpression, isAstIntegerLiteral, isAstLocalVarAssignment, isAstLocalVarDeclaration, isAstMember, isAstReturnStatement, isAstStringLiteral, isAstUnaryExpression, isClass, isMethodDeclaration, isPropertyDefinition, isPropertyStatement } from "./AstProgram.js";
import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstStatement, TstThisExpression, TstUnaryExpression, TstVariable, TstVariableExpression } from "./TstExpression.js";
import { TypeDefinition, TypeParameter } from "./TstType.js";
import { TstRuntime } from "./TstRuntime.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";

// There is no visitor for Ast types, it is only traversed once during conversion to Tst types.

class AstVisitor {
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
            if (isAstIdentifier(expr.callee)) {
                const functionName = expr.callee.value;
                const typeIfNewExpression = this.runtime.getType(functionName);
                if (!typeIfNewExpression) {
                    throw new Error("Unknown type: " + functionName);
                }

                return { exprType: "new", type: typeIfNewExpression, args: expr.args.map(arg => this.resolveExpression(arg)) } as TstNewExpression;
            }

            if (isAstMember(expr.callee)) {
                const functionName = expr.callee.property;
                const object = this.resolveExpression(expr.callee.object) as TstMemberExpression;
                const calleeType = this.runtime.getExpressionType(object, this.thisType);
                if (!calleeType) {
                    throw new Error(`Could not find type for member ${functionName}`);
                }

                const method = calleeType.getMethod(functionName);
                if (!method) {
                    throw new Error(`Method ${functionName} not found on type ${calleeType.name}`);
                }

                // TODO: unwrap to StatementExpression here?? and embed parameter expressions - may be too early
                return { exprType: "functionCall", object, method, args: expr.args.map(arg => this.resolveExpression(arg)) } as TstFunctionCallExpression;
            }

            throw new Error("Function calls not implemented yet: " + expr.callee + " " + expr.callee.exprType);
        }

        if (isAstIdentifier(expr)) {
            // Classify all identifiers as parameter, type, function, variable

            if (expr.value === "this") {
                return { exprType: "this" } as TstThisExpression;
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
                    const giType = this.runtime.getExpressionType(gi.value, this.thisType);
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
            const visitor = new TstExpressionTypeVisitor(this.runtime, this.thisType)
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

    resolveStatement(stmt: AstStatement): TstStatement {
        if (isAstReturnStatement(stmt)) {
            return {
                stmtType: "return",
                returnValue: this.resolveExpression(stmt.returnValue),
            } as TstReturnStatement;
        } else if (isAstIfStatement(stmt)) {
            return {
                stmtType: "if",
                condition: this.resolveExpression(stmt.condition),
                then: stmt.thenBlock.map(s => this.resolveStatement(s)),
                else: stmt.elseBlock ? stmt.elseBlock.map(s => this.resolveStatement(s)) : null
            } as TstIfStatement;
        } else if (isAstLocalVarDeclaration(stmt)) {
            this.scope.push({
                name: stmt.name,
                type: this.runtime.getType(stmt.varType)
            });
            return {
                stmtType: "localVarDeclaration",
                varType: this.runtime.getType(stmt.varType),
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

export class TstBuilder {
    private runtime: TstRuntime;

    constructor(runtime: TstRuntime) {
        this.runtime = runtime;
    }

    resolveProgram(visited: AstProgram) {

        // Pass 1: Create new half-constructed types
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                let type = this.runtime.tryGetType(programUnit.name);
                if (!type) {
                    type = new TypeDefinition(this.runtime, programUnit.name, visited.fileName);
                    this.runtime.types.push(type);
                }
            }
        }

        // Pass 1.5: Collect array types
        // TODO: Also collect from array literals f.ex "([[1,2],[3,4]])[0]" requires int[][] internally
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                for (let unit of programUnit.units) {
                    if (isPropertyDefinition(unit)) {
                        if (unit.propertyType.endsWith("[]")) {
                            this.runtime.createArrayType(unit.propertyType);
                        }
                    }
                }
            }
        }

        // Pass 2: Resolve extends, parameters, property types and method signatures
        for (let programUnit of visited.programUnits) {
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);

                if (programUnit.extends) {
                    const baseType = this.runtime.getType(programUnit.extends);

                    type.extends = baseType;
                    // type.extendsArguments -> evaluate expressions after instance is constructed
                }

                for (let parameter of programUnit.parameters) {
                    const parameterType = this.runtime.getType(parameter.type);

                    type.parameters.push({
                        name: parameter.name,
                        type: parameterType
                    });
                }

                for (let unit of programUnit.units) {
                    if (isMethodDeclaration(unit)) {
                        const methodType = this.runtime.getType(unit.returnType);
                        if (!methodType) {
                            throw new Error(`Could not find type ${unit.returnType} for method ${unit.name} of type ${programUnit.name}`);
                        }

                        type.methods.push({
                            name: unit.name,
                            declaringType: type,
                            returnType: methodType,
                            parameters: unit.parameters.map(param => ({
                                name: param.name,
                                type: this.runtime.getType(param.type)
                            })),
                            body: [], // assigned later
                        });
                    }
                }

            }
        }

        // Pass 3: Resolve symbols in initializers, extends-arguments and method bodies, AstExpression -> TstExpression
        for (let programUnit of visited.programUnits) {
                // the properties in the class - derives from extends - only add explicit public/private, and we have their types now. but its not parsed yet
            if (isClass(programUnit)) {
                const type = this.runtime.getType(programUnit.name);
                if (!type) {
                    throw new Error("Type should have been created in previous pass");
                }

                const visitor  = new AstVisitor(null, this.runtime, type, type.parameters);
                if (programUnit.extends && programUnit.extendsArguments) {
                    type.extendsArguments = programUnit.extendsArguments.map(arg => visitor.resolveExpression(arg));
                }

                for (let unit of programUnit.units) {
                    if (isPropertyStatement(unit)) {
                        // TODO: resolve with a target type? then we can deduce type for empty array literal "[]"
                        type.initializers.push({ name: unit.name, argument: visitor.resolveExpression(unit.argument) })
                    } else
                    if (isPropertyDefinition(unit)) {
                        const propertyType = this.runtime.getType(unit.propertyType);
                        if (!propertyType) {
                            throw new Error(`Could not find type ${unit.propertyType} for property ${unit.name} of type ${programUnit.name}`);
                        }

                        type.properties.push({
                            modifier: unit.modifier,
                            name: unit.name,
                            type: propertyType,
                            initializer: unit.argument ? visitor.resolveExpression(unit.argument) : undefined,
                        });
                    } else if (isMethodDeclaration(unit)) {
                        const typeMethod = type.methods.find(m => m.name === unit.name);
                        if (!typeMethod) {
                            throw new Error(`Method ${unit.name} not found on type ${type.name}`);
                        }

                        const methodVisitor = new AstVisitor(visitor, this.runtime, type, typeMethod.parameters);

                        for (let astStmt of unit.statementList) {
                            const stmt = methodVisitor.resolveStatement(astStmt);
                            typeMethod.body.push(stmt);
                        }
                    }
                }
            }
        }
    }
}
