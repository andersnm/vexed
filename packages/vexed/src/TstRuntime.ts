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

        const types = [
            new AnyTypeDefinition(this),
            new IntTypeDefinition(this),
            new BoolTypeDefinition(this),
            new ArrayBaseTypeDefinition(this, "any[]"),
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

    getExpressionType(expr: TstExpression, thisType: TypeDefinition): TypeDefinition | null {
        const visitor = new TstExpressionTypeVisitor(this, thisType);
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

    createFunctionType(parameterTypes: TypeDefinition[], returnType: TypeDefinition) {
        const functionTypeName = getFunctionTypeName(returnType, parameterTypes);
        if (this.tryGetType(functionTypeName)) {
            return;
        }

        // console.log("Creating function type: ", functionTypeName);
        const functionType = new FunctionTypeDefinition(this, returnType, parameterTypes);
        this.registerTypes([functionType]);
    }

    createArrayType(name: string) {
        if (this.tryGetType(name)) {
            return;
        }

        const arrayItemType = name.substring(0, name.length - 2);

        if (!this.tryGetType(arrayItemType)) {
            if (arrayItemType.endsWith("[]")) {
                this.createArrayType(arrayItemType);
            } else {
                throw new Error("Could not find array item type: " + arrayItemType);
            }
        }

        const specializedArrayType = new ArrayTypeDefinition(this, name)!;
        this.registerTypes([specializedArrayType]);
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

    isTypeAssignable(fromType: TypeDefinition | null, toType: TypeDefinition | null): boolean {
        if (!fromType || !toType) return false;

        // Handle array types
        const anyArrayType = this.getType("any[]");
        if (fromType.extends === anyArrayType && toType.extends === anyArrayType) {
            const fromElementName = fromType.name.substring(0, fromType.name.length - 2);
            const toElementName = toType.name.substring(0, toType.name.length - 2);
            const fromElementType = this.tryGetType(fromElementName);
            const toElementType = this.tryGetType(toElementName);
            return this.isTypeAssignable(fromElementType, toElementType);
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
