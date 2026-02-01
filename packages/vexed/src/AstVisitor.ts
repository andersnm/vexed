import { AstClass, AstExpression, AstMethodDeclaration, AstProgram, AstStatement, formatAstTypeName, isAstArrayLiteral, isAstBinaryExpression, isAstBooleanLiteral, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIfStatement, isAstIndexExpression, isAstIntegerLiteral, isAstLocalVarAssignment, isAstLocalVarDeclaration, isAstMember, isAstReturnStatement, isAstStringLiteral, isAstUnaryExpression, isClass, isMethodDeclaration, isPropertyDefinition, isPropertyStatement } from "./AstProgram.js";
import { InstanceMeta, TstBinaryExpression, TstPoisonExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNewArrayExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstStatement, TstThisExpression, TstUnaryExpression, TstUnboundFunctionReferenceExpression, TstVariable, TstVariableExpression } from "./TstExpression.js";
import { TypeDefinition, TypeMethod, TypeParameter } from "./TstType.js";
import { TstRuntime } from "./TstRuntime.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";
import { FunctionTypeDefinition, getFunctionTypeName } from "./types/FunctionTypeDefinition.js";
import { PoisonTypeDefinition } from "./types/PoisonTypeDefinition.js";
import { ArrayBaseTypeDefinition } from "./types/ArrayBaseTypeDefinition.js";
import { GenericUnresolvedTypeDefinition } from "./types/GenericUnresolvedTypeDefinition.js";

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
                const typeIfNewExpression = this.runtime.tryGetType(functionName);
                if (typeIfNewExpression) {
                    const properties = expr.properties ? expr.properties.map(prop => ({
                        name: prop.name,
                        argument: this.resolveExpression(prop.argument)
                    })) : undefined;
                    return { 
                        exprType: "new", 
                        type: typeIfNewExpression, 
                        args: expr.args.map(arg => this.resolveExpression(arg)),
                        properties: properties
                    } as TstNewExpression;
                }
                // If not a type, fall through to handle as a function-typed variable
            }

            const callee = this.resolveExpression(expr.callee);
            const methodType = this.runtime.getExpressionType(callee);
            if (!methodType) {
                throw new Error("Could not find type for function call callee");
            }

            if (methodType instanceof PoisonTypeDefinition) {
                return callee;
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

            const returnType = this.constructGenericType(methodType.returnType, genericBindings);

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

                this.runtime.error(`Unknown identifier ${expr.value}`, expr.location);
                const poisonType = this.runtime.createPoisonType(`<MissingIdentifier:${expr.value}>`);
                return {
                    exprType: "poison",
                    poisonType: poisonType,
                    identifierName: expr.value,
                } as TstPoisonExpression;
            }
        }

        if (isAstMember(expr)) {
            return { exprType: "member", object: this.resolveExpression(expr.object), property: expr.property } as TstMemberExpression;
        }

        if (isAstArrayLiteral(expr)) {
            const elements = expr.elements.map(e => this.resolveExpression(e));
            const arrayType = this.inferArrayType(elements);
            if (!arrayType) {
                throw new Error("Could not determine array type for elements");
            }

            // Return TstNewArrayExpression to defer array creation until reduction time
            // This allows array elements to be wrapped in scoped expressions
            return {
                exprType: "newArray",
                arrayType: arrayType,
                elements: elements
            } as TstNewArrayExpression;
        }

        if (isAstIndexExpression(expr)) {
            let indexExpr = this.resolveExpression(expr.index);

            const indexType = this.runtime.getExpressionType(indexExpr);
            if (indexType !== this.runtime.getType("int")) {
                this.runtime.error("Index expression must be of type int", expr.index.location);

                return {
                    exprType: "poison",
                    poisonType: this.runtime.createPoisonType("<InvalidIndexExpression>"),
                    identifierName: "<InvalidIndexExpression>",
                } as TstPoisonExpression;
            }

            const objectExpr = this.resolveExpression(expr.object);
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
            let returnExpression = this.resolveExpression(stmt.returnValue);
            const returnExpressionType = this.runtime.getExpressionType(returnExpression);

            const returnTypeName = formatAstTypeName(method.returnType, classDef, method);
            const returnType = this.runtime.getType(returnTypeName);

            if (!this.runtime.isTypeAssignable(returnType, returnExpressionType)) {
                this.runtime.error(`Cannot return type ${returnExpressionType.name} from method with return type ${returnType.name}`, stmt.location);
                returnExpression = {
                    exprType: "poison",
                    poisonType: this.runtime.createPoisonType(`<InvalidReturn:${method.name}>`),
                    identifierName: method.name,
                } as TstPoisonExpression;
            }

            return {
                stmtType: "return",
                returnValue: returnExpression,
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

            let initializer: TstExpression | null = null;
            if (stmt.initializer) {
                initializer = this.resolveExpression(stmt.initializer);
                const initializerType = this.runtime.getExpressionType(initializer);
                if (initializerType && !this.runtime.isTypeAssignable(varType, initializerType)) {
                    this.runtime.error(`Cannot assign type ${initializerType.name} to variable ${stmt.name} of type ${varType.name}`, stmt.location);
                    initializer = {
                        exprType: "poison",
                        poisonType: this.runtime.createPoisonType(`<InvalidInitialization:${stmt.name}>`),
                        identifierName: stmt.name,
                    } as TstPoisonExpression;
                }
            }

            this.scope.push({
                name: stmt.name,
                type: varType,
            });
            return {
                stmtType: "localVarDeclaration",
                varType: varType,
                name: stmt.name,
                initializer: initializer,
            } as TstLocalVarDeclaration;
        } else if (isAstLocalVarAssignment(stmt)) {
            const variable = this.scope.find(v => v.name === stmt.name);
            if (!variable) {
                throw new Error("Internal error: Variable not found: " + stmt.name);
            }

            let expr = this.resolveExpression(stmt.expr);
            const exprType = this.runtime.getExpressionType(expr);
            if (!this.runtime.isTypeAssignable(variable.type, exprType)) {
                this.runtime.error(`Cannot assign type ${exprType.name} to variable ${stmt.name} of type ${variable.type.name}`, stmt.location);
                expr = {
                    exprType: "poison",
                    poisonType: this.runtime.createPoisonType(`<InvalidAssignment:${variable.name}>`),
                    identifierName: variable.name,
                } as TstPoisonExpression;
            }

            return {
                stmtType: "localVarAssignment",
                name: stmt.name,
                expr: expr,
            } as TstLocalVarAssignment;
        }

        throw new Error("Internal error: Unknown statement type " + stmt.stmtType);
    }

    inferArrayType(elements: TstExpression[]): TypeDefinition | null {
        let type: TypeDefinition | null = null;
        // TODO: allow common base type
        for (let element of elements) {
            const elementType = this.runtime.getExpressionType(element);
            if (!type) {
                type = elementType;
                continue;
            }

            if (type !== elementType) {
                throw new Error("Array elements must be of the same type");
            }
        }

        if (!type) {
            // Empty arrays should be handled explicitly earlier
            throw new Error("Cannot determine array element type for empty array");
        }

        // Implicitly inferred array literal types are not collected during the static pass and must be created.
        // F.ex "([[1,2],[3,4]])[0]"
        const arrayTypeName = type.name + "[]";
        return this.runtime.createArrayType(arrayTypeName, type);
    }

    constructGenericType(inputType: TypeDefinition, bindings: Map<string, TypeDefinition>): TypeDefinition {
        if (bindings.size === 0) {
            return inputType;
        }

        if (inputType instanceof ArrayBaseTypeDefinition) {
            const genericElementType = inputType.elementType;
            const elementType = this.constructGenericType(genericElementType, bindings);
            // Implicitly inferred specialized generic array return types are not collected during the static pass and must be created.
            // F.ex the return type of array .map() is T[]
            return this.runtime.createArrayType(elementType.name + "[]", elementType);
        }

        if (inputType instanceof GenericUnresolvedTypeDefinition) {
            const binding = bindings.get(inputType.name);
            if (!binding) {
                throw new Error("Cannot resolve generic type: " + inputType.name);
            }

            return binding;
        }

        return inputType;
    }
}
