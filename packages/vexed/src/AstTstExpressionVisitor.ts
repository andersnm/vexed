import { AstLocation } from "./AstLocation.js";
import { AstArrayLiteralExpression, AstBinaryExpression, AstBooleanLiteralExpression, AstClass, AstClassUnit, AstDecimalLiteralExpression, AstExpression, AstFunctionCallExpression, AstIdentifierExpression, AstIfStatement, AstIndexExpression, AstIntegerLiteralExpression, AstLocalVarAssignment, AstLocalVarDeclaration, AstMemberExpression, AstMethodDeclaration, AstNativeMemberExpression, AstProgram, AstProgramUnit, AstPropertyDefinition, AstReturnStatement, AstStatement, AstStringLiteralExpression, AstUnaryExpression, formatAstTypeName, isAstArrayLiteral, isAstBinaryExpression, isAstBooleanLiteral, isAstDecimalLiteral, isAstFunctionCall, isAstIdentifier, isAstIfStatement, isAstIndexExpression, isAstIntegerLiteral, isAstLocalVarAssignment, isAstLocalVarDeclaration, isAstMember, isAstNativeMember, isAstReturnStatement, isAstStringLiteral, isAstUnaryExpression, isClass, isMethodDeclaration, isPropertyDefinition } from "./AstProgram.js";
import { TstBuilder } from "./TstBuilder.js";
import { InstanceMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstInstanceObject, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNativeMemberExpression, TstNewArrayExpression, TstNewExpression, TstParameterExpression, TstPoisonExpression, TstReturnStatement, TstStatement, TstThisExpression, TstUnaryExpression, TstVariableExpression } from "./TstExpression.js";
import { TstRuntime } from "./TstRuntime.js";
import { TypeDefinition, TypeParameter } from "./TstType.js";
import { ArrayBaseTypeDefinition } from "./types/ArrayBaseTypeDefinition.js";
import { FunctionTypeDefinition } from "./types/FunctionTypeDefinition.js";
import { GenericUnresolvedTypeDefinition } from "./types/GenericUnresolvedTypeDefinition.js";
import { PoisonTypeDefinition } from "./types/PoisonTypeDefinition.js";

// Converts AST expressions to TST nodes witin a class or a method.

export class AstTstExpressionVisitor {
    runtime: TstRuntime;
    scope: TypeParameter[] = [];

    constructor(private builder: TstBuilder, private classDef: AstClass, private methodDef: AstMethodDeclaration | null) {
        this.runtime = builder.runtime;
    }

    visitExpression(expr: AstExpression): TstExpression {
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
        if (isAstNativeMember(expr)) {
            return this.visitNativeMember(expr);
        }
        if (isAstBinaryExpression(expr)) {
            return this.visitBinaryExpression(expr);
        }
        if (isAstUnaryExpression(expr)) {
            return this.visitUnaryExpression(expr);
        }

        throw new Error(`Internal error: Unhandled expression type: ${expr.exprType}`);
    }


    visitStringLiteral(expr: AstStringLiteralExpression): TstExpression {
        const stringType = this.runtime.getType("string");
        const stringObject = stringType.createInstance([]);
        stringObject[InstanceMeta] = expr.value;

        return {
            exprType: "instance",
            instance: stringObject
        } as TstInstanceExpression;
    }

    visitIntegerLiteral(expr: AstIntegerLiteralExpression): TstExpression {
        return {
            exprType: "instance",
            instance: this.runtime.createInt(parseInt(expr.value))
        } as TstInstanceExpression;
    }

    visitDecimalLiteral(expr: AstDecimalLiteralExpression): TstExpression {
        const decimalType = this.runtime.getType("decimal");
        const decimalObject = decimalType.createInstance([]);
        decimalObject[InstanceMeta] = parseFloat(expr.value);
        return {
            exprType: "instance",
            instance: decimalObject,
        } as TstInstanceExpression;
    }

    visitBooleanLiteral(expr: AstBooleanLiteralExpression): TstExpression {
        return {
            exprType: "instance",
            instance: this.runtime.createBool(expr.value)
        } as TstInstanceExpression;
    }

    visitArrayLiteral(expr: AstArrayLiteralExpression): TstExpression {
        const elements = expr.elements.map(e => this.visitExpression(e));
        const arrayType = this.inferArrayType(elements, expr.location);
        if (!arrayType) {
            // inferArrayType has already reported the error, just return poison expression
            const poisonType = this.builder.createPoisonType("<InvalidArrayLiteral>");
            return {
                exprType: "poison",
                poisonType: poisonType,
                identifierName: "<InvalidArrayLiteral>",
            } as TstPoisonExpression;
        }

        // Return TstNewArrayExpression to defer array creation until reduction time
        // This allows array elements to be wrapped in scoped expressions
        return {
            exprType: "newArray",
            arrayType: arrayType,
            elements: elements
        } as TstNewArrayExpression;
    }

    visitFunctionCall(expr: AstFunctionCallExpression): TstExpression {
        if (isAstIdentifier(expr.callee)) {
            const functionName = expr.callee.value;
            const typeIfNewExpression = this.runtime.tryGetType(functionName);
            if (typeIfNewExpression) {
                const properties = expr.properties ? expr.properties.map(prop => ({
                    name: prop.name,
                    argument: this.visitExpression(prop.argument)
                })) : undefined;
                return { 
                    exprType: "new", 
                    type: typeIfNewExpression, 
                    args: expr.args.map(arg => this.visitExpression(arg)),
                    properties: properties,
                } as TstNewExpression;
            }
            // If not a type, fall through to handle as a function-typed variable
        }

        if (expr.properties !== undefined) {
            this.runtime.error("Unexpected '{' after function call.", expr.location);
        }

        const callee = this.visitExpression(expr.callee);
        const methodType = this.runtime.getExpressionType(callee);

        if (methodType instanceof PoisonTypeDefinition) {
            return callee;
        }

        if (!(methodType instanceof FunctionTypeDefinition)) {
            this.runtime.error(`Callee is not a function type, got type ${methodType.name}`, expr.callee.location);
            const poisonType = this.builder.createPoisonType("<InvalidFunctionCall>");
            return {
                exprType: "poison",
                poisonType: poisonType,
                identifierName: "<InvalidFunctionCall>",
            } as TstPoisonExpression;
        }

        const genericBindings = new Map<string, TypeDefinition>();

        const argumentExpressions = expr.args.map(arg => this.visitExpression(arg));

        for (let i = 0; i < argumentExpressions.length; i++) {
            const argumentExpression = argumentExpressions[i];
            const methodParameterType = methodType.parameterTypes[i];
            const argumentType = this.runtime.getExpressionType(argumentExpression);

            // First try to infer generic type bindings
            if (!this.runtime.inferBindings(methodParameterType, argumentType, genericBindings)) {
                this.runtime.error(`Cannot infer bindings for function call argument ${i}: expected ${methodParameterType.name}, got ${argumentType.name}`, expr.args[i].location);
                const poisonType = this.builder.createPoisonType("<InvalidFunctionCallArgs>");
                return {
                    exprType: "poison",
                    poisonType: poisonType,
                    identifierName: "<InvalidFunctionCallArgs>",
                } as TstPoisonExpression;
            }

            // After inference, check if the argument type is actually assignable to the parameter type
            // inferBindings handles generic type parameter inference but doesn't validate compatibility for concrete types
            // This additional check catches concrete type mismatches (e.g., passing string when int is expected)
            if (!this.runtime.isTypeAssignable(argumentType, methodParameterType, genericBindings)) {
                this.runtime.error(`Argument ${i} type mismatch: expected ${methodParameterType.name}, got ${argumentType.name}`, expr.args[i].location);
                const poisonType = this.builder.createPoisonType("<InvalidFunctionCallArgs>");
                return {
                    exprType: "poison",
                    poisonType: poisonType,
                    identifierName: "<InvalidFunctionCallArgs>",
                } as TstPoisonExpression;
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

    visitIdentifier(expr: AstIdentifierExpression): TstExpression {
        // Classify all identifiers as parameter, type, function, variable

        const thisType = this.runtime.getType(this.classDef.name);
        const parameters = [ ...this.classDef.parameters, ...(this.methodDef ? this.methodDef.parameters : []) ];

        if (expr.value === "this") {
            return { exprType: "this", type: thisType } as TstThisExpression;
        } else {
            const pi = parameters.find(p => p.name == expr.value);
            if (pi) {
                const parameterType = this.runtime.getType(formatAstTypeName(pi.type, this.classDef, this.methodDef));
                return { exprType: "parameter", name: expr.value, type: parameterType } as TstParameterExpression;
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

            this.runtime.error(`Unknown identifier ${expr.value}`, expr.location);
            const poisonType = this.builder.createPoisonType(`<MissingIdentifier:${expr.value}>`);
            return {
                exprType: "poison",
                poisonType: poisonType,
                identifierName: expr.value,
            } as TstPoisonExpression;
        }
    }

    visitMember(expr: AstMemberExpression): TstExpression {
        return { exprType: "member", object: this.visitExpression(expr.object), property: expr.property } as TstMemberExpression;
    }

    visitNativeMember(expr: AstNativeMemberExpression): TstExpression {
        // Get the member type
        const memberType = this.runtime.getType(expr.memberTypeName);
        
        // Handle the special __this_remote__ placeholder
        let objectExpr: TstExpression;
        if (isAstIdentifier(expr.object) && expr.object.value === "__this_remote__") {
            // Convert to this.remote
            objectExpr = {
                exprType: "member",
                object: { exprType: "this" },
                property: "remote",
            } as TstMemberExpression;
        } else {
            objectExpr = this.visitExpression(expr.object);
        }
        
        // Create a callback that extracts the member from the remote instance
        const memberName = expr.memberName;
        const callback = (remoteInstance: TstInstanceObject) => {
            const value = remoteInstance[InstanceMeta][memberName];
            const instance = memberType.createInstance([]);
            instance[InstanceMeta] = value;
            return {
                exprType: "instance",
                instance: instance,
            } as TstInstanceExpression;
        };
        
        return {
            exprType: "nativeMember",
            object: objectExpr,
            memberType: memberType,
            memberName: memberName,
            callback: callback,
        } as any; // TstNativeMemberExpression
    }

    visitIndexExpression(expr: AstIndexExpression): TstExpression {
        let indexExpr = this.visitExpression(expr.index);
        const indexType = this.runtime.getExpressionType(indexExpr);

        if (indexType !== this.runtime.getType("int")) {
            this.runtime.error("Index expression must be of type int", expr.index.location);

            return {
                exprType: "poison",
                poisonType: this.builder.createPoisonType("<InvalidIndexExpression>"),
                identifierName: "<InvalidIndexExpression>",
            } as TstPoisonExpression;
        }

        const objectExpr = this.visitExpression(expr.object);
        return {
            exprType: "index",
            object: objectExpr,
            index: indexExpr
        } as TstIndexExpression;
    }

    visitBinaryExpression(expr: AstBinaryExpression): TstExpression {
        return {
            exprType: "binary",
            left: this.visitExpression(expr.lhs),
            right: this.visitExpression(expr.rhs),
            operator: expr.operator
        } as TstBinaryExpression;
    }

    visitUnaryExpression(expr: AstUnaryExpression): TstExpression {
        return {
            exprType: "unary",
            operator: expr.operator,
            operand: this.visitExpression(expr.operand),
        } as TstUnaryExpression;
    }

    visitStatement(stmt: AstStatement): TstStatement {
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

        throw new Error(`Internal error: Unhandled statement type: ${stmt.stmtType}`);
    }

    visitIfStatement(stmt: AstIfStatement): TstStatement {
        return {
            stmtType: "if",
            condition: this.visitExpression(stmt.condition),
            then: stmt.thenBlock.map(s => this.visitStatement(s)),
            else: stmt.elseBlock ? stmt.elseBlock.map(s => this.visitStatement(s)) : null
        } as TstIfStatement;
    }

    visitReturnStatement(stmt: AstReturnStatement): TstStatement {
        if (!this.methodDef) {
            throw new Error("Internal error: Return statement outside of method");
        }

        let returnExpression = this.visitExpression(stmt.returnValue);
        const returnExpressionType = this.runtime.getExpressionType(returnExpression);
        const returnTypeName = formatAstTypeName(this.methodDef.returnType, this.classDef, this.methodDef);
        const returnType = this.runtime.getType(returnTypeName);

        if (!this.runtime.isTypeAssignable(returnType, returnExpressionType)) {
            this.runtime.error(`Cannot return type ${returnExpressionType.name} from method with return type ${returnType.name}`, stmt.location);
            returnExpression = {
                exprType: "poison",
                poisonType: this.builder.createPoisonType(`<InvalidReturn:${this.methodDef.name}>`),
                identifierName: this.methodDef.name,
            } as TstPoisonExpression;
        }

        return {
            stmtType: "return",
            returnValue: returnExpression,
        } as TstReturnStatement;

    }

    visitLocalVarDeclaration(stmt: AstLocalVarDeclaration): TstStatement {
        const varTypeName = formatAstTypeName(stmt.varType, this.classDef, this.methodDef);
        const varType = this.runtime.getType(varTypeName);

        let initializer: TstExpression | null = null;
        if (stmt.initializer) {
            initializer = this.visitExpression(stmt.initializer);
            const initializerType = this.runtime.getExpressionType(initializer);
            if (!this.runtime.isTypeAssignable(varType, initializerType)) {
                this.runtime.error(`Cannot assign type ${initializerType.name} to variable ${stmt.name} of type ${varType.name}`, stmt.location);
                initializer = {
                    exprType: "poison",
                    poisonType: this.builder.createPoisonType(`<InvalidInitialization:${stmt.name}>`),
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
    }

    visitLocalVarAssignment(stmt: AstLocalVarAssignment): TstStatement {
        const variable = this.scope.find(v => v.name === stmt.name);
        if (!variable) {
            throw new Error("Internal error: Variable not found: " + stmt.name);
        }

        let expr = this.visitExpression(stmt.expr);
        const exprType = this.runtime.getExpressionType(expr);
        if (!this.runtime.isTypeAssignable(variable.type, exprType)) {
            this.runtime.error(`Cannot assign type ${exprType.name} to variable ${stmt.name} of type ${variable.type.name}`, stmt.location);
            expr = {
                exprType: "poison",
                poisonType: this.builder.createPoisonType(`<InvalidAssignment:${variable.name}>`),
                identifierName: variable.name,
            } as TstPoisonExpression;
        }

        return {
            stmtType: "localVarAssignment",
            name: stmt.name,
            expr: expr,
        } as TstLocalVarAssignment;
    }

    visitStatementList(stmtList: AstStatement[]): TstStatement[] {
        const result: TstStatement[] = [];
        for (let stmt of stmtList) {
            const visited = this.visitStatement(stmt);
            result.push(visited);
        }
        return result;
    }

    inferArrayType(elements: TstExpression[], location: AstLocation): TypeDefinition | null {
        let type: TypeDefinition | null = null;
        // TODO: allow common base type
        for (let element of elements) {
            const elementType = this.runtime.getExpressionType(element);
            if (!type) {
                type = elementType;
                continue;
            }

            if (type !== elementType) {
                this.runtime.error(`Array elements must be of the same type, got ${type.name} and ${elementType.name}`, location);
                return null;
            }
        }

        if (!type) {
            // Empty arrays should be handled explicitly earlier
            this.runtime.error("Cannot determine array element type for empty array", location);
            return null;
        }

        // Implicitly inferred array literal types are not collected during the static pass and must be created.
        // F.ex "([[1,2],[3,4]])[0]"
        const arrayTypeName = type.name + "[]";
        return this.builder.createArrayType(arrayTypeName, type);
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
            return this.builder.createArrayType(elementType.name + "[]", elementType);
        }

        if (inputType instanceof GenericUnresolvedTypeDefinition) {
            const binding = bindings.get(inputType.name);
            if (!binding) {
                throw new Error(`Internal error: Cannot resolve generic type ${inputType.name}`);
            }

            return binding;
        }

        return inputType;
    }
}
