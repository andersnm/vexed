import { InstanceMeta, isFunctionReferenceExpression, isInstanceExpression, RuntimeMeta, ScopeMeta, TstExpression, TstFunctionReferenceExpression, TstInstanceExpression, TstInstanceObject, TstPromiseExpression, TstScopedExpression, TstVariable, TypeMeta } from "./TstExpression.js";
import { TypeDefinition } from "./TstType.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";
import { TstScope } from "./visitors/TstReduceExpressionVisitor.js";
import { TstBuilder } from "./TstBuilder.js";
import { Parser } from "./Parser.js";
import { AnyTypeDefinition } from "./types/AnyTypeDefinition.js";
import { IntTypeDefinition } from "./types/IntTypeDefinition.js";
import { BoolTypeDefinition } from "./types/BoolTypeDefinition.js";
import { ArrayBaseTypeDefinition, ArrayTypeDefinition } from "./types/ArrayBaseTypeDefinition.js";
import { StringTypeDefinition } from "./types/StringTypeDefinition.js";
import { IoTypeDefinition } from "./types/IoTypeDefinition.js";
import { TypeTypeDefinition } from "./types/TypeTypeDefinition.js";
import { TstReducer } from "./TstReducer.js";
import { AstProgram } from "./AstProgram.js";
import { FunctionTypeDefinition, getFunctionTypeName } from "./types/FunctionTypeDefinition.js";
import { GenericUnresolvedTypeDefinition } from "./types/GenericUnresolvedTypeDefinition.js";

export class TstRuntime {
    verbose: boolean = false;
    maxSteps: number = 1000;

    types: TypeDefinition[] = [];
    globalScope: TstScope = {
        parent: null,
        thisObject: null as any,
        variables: [],
        comment: "global",
    };

    constructor() {

        const anyType = new AnyTypeDefinition(this);
        const types = [
            anyType,
            new IntTypeDefinition(this),
            new BoolTypeDefinition(this),
            new ArrayBaseTypeDefinition(this, "any[]", anyType),
            new StringTypeDefinition(this),
            new IoTypeDefinition(this),
            new TypeTypeDefinition(this),
        ];
        this.registerTypes(types);

        this.globalScope.variables.push({
            name: "io",
            value: {
                exprType: "instance",
                instance: this.getType("Io").createInstance([]),
            } as TstInstanceExpression,
            type: this.getType("Io"),
        });
    }

    getType(name: string): TypeDefinition {
        const type = this.types.find(t => t.name == name);
        if (!type) {
            throw new Error("Type not found: " + name);
        }

        return type;
    }

    tryGetType(name: string): TypeDefinition | null {
        const type = this.types.find(t => t.name == name);
        return type || null;
    }

    getExpressionType(expr: TstExpression): TypeDefinition {
        const visitor = new TstExpressionTypeVisitor(this);
        visitor.visit(expr);
        return visitor.visitType;
    }

    private setupInstanceScope(obj: TstInstanceObject, scopeType: TypeDefinition, args: TstExpression[]) {
        if (scopeType.parameters.length != args.length) {
            throw new Error(`Type ${scopeType.name} expects ${scopeType.parameters.length} arguments, but got ${args.length}`);
        }

        const chainNamedArguments: TstVariable[] = scopeType.parameters.map((p, index) => ({
            name: p.name,
            value: args[index],
            type: p.type,
        }));

        const scope: TstScope = {
            parent: this.globalScope,
            thisObject: obj,
            variables: chainNamedArguments,
            comment: scopeType.name + ".constructor(...)",
        };

        obj[ScopeMeta].set(scopeType, scope);

        // console.log("Named arguments now", scopeType.name, chainNamedArguments, args, "props", scopeType.properties.map(p => p.name).join(","));

        if (scopeType.extends) {
            // Each base class constructor argument is wrapped in a scoped expression.
            const extendsArguments = scopeType.extendsArguments?.map(arg => ({
                exprType: "scoped",
                expr: arg,
                scope,
            } as TstScopedExpression)) || [];

            this.setupInstanceScope(obj, scopeType.extends, extendsArguments);
        }

        for (let prop of scopeType.properties) {
            // TODO: Default initializers should be applied in a separate pass if not overridden at any class depth.
            // Doing it here works for most cases, but probably not for some cases when "this.XX" is used in a argument
            // to a base class constructor and resolves to the default instead of an overridden initializer.

            if (prop.initializer) {
                obj[prop.name] = { exprType: "scoped", scope, expr: prop.initializer } as TstScopedExpression;
            } else {
                obj[prop.name] = null as any as TstExpression;
            }
        }

        for (let stmt of scopeType.initializers) {
            const typeProperty = scopeType.getProperty(stmt.name);
            if (!typeProperty) {
                throw new Error(`Initializer refers to unknown property ${stmt.name} on type ${scopeType.name}`);
            }

            obj[stmt.name] = { exprType: "scoped", scope, expr: stmt.argument } as TstScopedExpression;
        }
    }

    findArrayType(visitor: TstExpressionTypeVisitor, elements: TstExpression[]): TypeDefinition | null {
        let type: TypeDefinition | null = null;
        // TODO: allow common base type
        for (let element of elements) {
            visitor.visit(element);

            if (!type) {
                type = visitor.visitType;
            }

            if (type !== visitor.visitType) {
                throw new Error("Array elements must be of the same type");
            }
        }

        if (!type) {
            // Empty arrays should be handled explicitly earlier
            throw new Error("Cannot determine array element type for empty array");
        }

        const arrayTypeName = type.name + "[]";
        return this.getType(arrayTypeName);
    }

    createInstance(type: TypeDefinition, args: TstExpression[], userData: any = null, sealed: boolean = false): TstInstanceObject {
        const obj: TstInstanceObject = { 
            [TypeMeta]: type,
            [InstanceMeta]: userData,
            [ScopeMeta]: new Map<TypeDefinition, TstScope>(),
            [RuntimeMeta]: { sealed },
        };

        this.setupInstanceScope(obj, type, args);
        return obj;
    }

    constructGenericType(inputType: TypeDefinition, bindings: Map<string, TypeDefinition>): TypeDefinition {
        if (bindings.size === 0) {
            return inputType;
        }

        if (inputType instanceof ArrayBaseTypeDefinition) {
            const genericElementType = inputType.elementType;
            const elementType = this.constructGenericType(genericElementType, bindings);
            return this.getType(elementType.name + "[]");
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

    inferBindings(expected: TypeDefinition, actual: TypeDefinition, out: Map<string, TypeDefinition>): boolean {

        // inferBindings returns false if there is an inference conflict, otherwise true.

        if (actual instanceof GenericUnresolvedTypeDefinition) {
            // Cannot infer from an unresolved actual type
            // If this happens, the the type originator site should resolve it (e.g function return types)
            throw new Error("Cannot infer from unresolved actual type: " + actual.name);
        }

        // Case 1: expected is a generic placeholder
        if (expected instanceof GenericUnresolvedTypeDefinition) {
            const name = expected.name;
            const existing = out.get(name);

            if (!existing) {
                out.set(name, actual);
                return true;
            }

            // Must agree with previous inference
            return existing === actual;
        }

        // Case 2: both are arrays
        if (expected instanceof ArrayBaseTypeDefinition && actual instanceof ArrayBaseTypeDefinition) {
            return this.inferBindings(expected.elementType, actual.elementType, out);
        }

        // Case 3: both are function types
        if (expected instanceof FunctionTypeDefinition && actual instanceof FunctionTypeDefinition) {

            if (!this.inferBindings(expected.returnType, actual.returnType, out)) {
                return false;
            }

            if (expected.parameterTypes.length !== actual.parameterTypes.length) {
                return false;
            }

            for (let i = 0; i < expected.parameterTypes.length; i++) {
                if (!this.inferBindings(expected.parameterTypes[i], actual.parameterTypes[i], out)) {
                    return false;
                }
            }

            return true;
        }

        // Inference done
        return true;
    }

    isTypeAssignable(fromType: TypeDefinition | null, toType: TypeDefinition | null, bindings: Map<string, TypeDefinition> = new Map()): boolean {

        if (!fromType || !toType) return false;

        if (fromType instanceof ArrayBaseTypeDefinition && toType instanceof ArrayBaseTypeDefinition) {
            return this.isTypeAssignable(fromType.elementType, toType.elementType, bindings);
        }

        if (toType instanceof GenericUnresolvedTypeDefinition) {
            const bindingType = bindings.get(toType.name);
            if (!bindingType) {
                throw new Error("Unbound generic type: " + toType.name);
            }
            toType = bindingType;
        }

        if (fromType instanceof GenericUnresolvedTypeDefinition) {
            const bindingType = bindings.get(fromType.name);
            if (!bindingType) {
                throw new Error("Unbound generic type: " + fromType.name);
            }
            fromType = bindingType;
        }

        if (fromType instanceof FunctionTypeDefinition && toType instanceof FunctionTypeDefinition) {
            if (!this.isTypeAssignable(fromType.returnType, toType.returnType, bindings)) {
                return false;
            }

            if (fromType.parameterTypes.length !== toType.parameterTypes.length) {
                return false;
            }

            for (let i = 0; i < fromType.parameterTypes.length; i++) {
                const fromParamType = fromType.parameterTypes[i];
                const toParamType = toType.parameterTypes[i];
                if (!this.isTypeAssignable(fromParamType, toParamType, bindings)) {
                    return false;
                }
            }

            return true;
        }

        // Handle class inheritance
        if (fromType.extends || toType.extends) {
            let current: TypeDefinition | undefined = fromType;
            while (current) {
                if (current === toType) return true;
                current = current.extends;
            }
            return false;
        }

        // Fallback to strict equality
        return fromType === toType;
    }

    async reduceInstance(obj: TstInstanceObject) {
        const reducer = new TstReducer(this);
        await reducer.reduceInstance(obj);
    }

    createInt(value: number): TstInstanceObject {
        const intType = this.getType("int");
        const intObject = intType.createInstance([]);
        intObject[InstanceMeta] = value | 0;
        return intObject;
    }

    createString(value: string): TstInstanceObject {
        const stringType = this.getType("string");
        const stringObject = stringType.createInstance([]);
        stringObject[InstanceMeta] = value;
        return stringObject;
    }

    createBool(value: boolean): TstInstanceObject {
        const boolType = this.getType("bool");
        const boolObject = boolType.createInstance([]);
        boolObject[InstanceMeta] = value;
        return boolObject;
    }

    loadScript(script: string, fileName: string) {
        const parser = new Parser();
        const program = parser.parse(script, fileName);
        const resolver = new TstBuilder(this);
        resolver.resolveProgram(program);
    }

    registerTypes(types: TypeDefinition[]) {
        this.types.push(...types);

        const program = {
            fileName: "<native>",
            programUnits: types.filter(t => t.astNode).map(t => t.astNode),
        } as AstProgram;

        const builder = new TstBuilder(this);
        builder.resolveProgram(program);
    }
}
