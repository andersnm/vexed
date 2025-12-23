import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstScopedExpression, TstVariable, TypeMeta } from "./TstExpression.js";
import { TypeDefinition } from "./TstType.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";
import { TstReduceExpressionVisitor } from "./visitors/TstReduceExpressionVisitor.js";

class AnyTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "any");
    }
}

class StringTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "string");
    }

    initializeType() {
        this.properties.push({
            modifier: "public",
            name: "length",
            type: this.runtime.getType("int"),
        });
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        // console.log("[StringTypeDefinition] Creating instance of type", this.name);
        return this.runtime.createInstance(this, args, "");
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        // console.log("[StringTypeDefinition] Resolving", propertyName);
        if (propertyName === "length") {
            const stringValue = instance[InstanceMeta] as string;
            return { exprType: "instance", instance: this.runtime.createInt(stringValue.length) } as TstInstanceExpression;
        }

        return null;
    }
}

class IntTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "int");
    }

    initializeType() {}

    createInstance(args: TstExpression[]): TstInstanceObject {
        // console.log("[IntTypeDefinition] Creating instance of type", this.name);
        return this.runtime.createInstance(this, args, 0);
    }
}

/**
 * NOTE: ArrayBaseTypeDefinition serves two purposes:
 * - When instantiated directly, corresponds to the Tst "any[]" type. This is the Tst base class of all array types.
 * - As the base class for ArrayTypeDefinition, which is used for types like string[].
 */
class ArrayBaseTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name);
    }

    initializeType() {
        this.properties.push({
            modifier: "public",
            name: "length",
            type: this.runtime.getType("int"),
        });
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        // console.log("[ArrayBaseTypeDefinition] Creating instance of type", this.name);
        return this.runtime.createInstance(this, args, []);
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        // console.log("[ArrayBaseTypeDefinition] Resolving", propertyName);
        if (propertyName === "length") {
            const arrayValue = instance[InstanceMeta] as any[];
            return { exprType: "instance", instance: this.runtime.createInt(arrayValue.length) } as TstInstanceExpression;
        }

        return null;
    }

    resolveIndex(instance: TstInstanceObject, index: number): TstExpression | null {
        const arrayValue = instance[InstanceMeta] as any[];
        return arrayValue[index] || null;
    }
}

class ArrayTypeDefinition extends ArrayBaseTypeDefinition {
    constructor(runtime: TstRuntime, name: string) {
        super(runtime, name);
    }

    initializeType() {
        // Do not call super.initializeType(). It adds
        this.extends = this.runtime.getType("any[]");
    }
}

export class TstRuntime {
    types: TypeDefinition[] = [];

    constructor() {
        this.types.push(new AnyTypeDefinition(this));
        this.types.push(new IntTypeDefinition(this));
        this.types.push(new ArrayBaseTypeDefinition(this, "any[]"));
        this.types.push(new StringTypeDefinition(this));
        // this.types.push(new ArrayTypeDefinition(this, "string[]"));

        for (let type of this.types) {
            type.initializeType();
        }
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
        }));

        // console.log("Named arguments now", scopeType.name, chainNamedArguments, args, "props", scopeType.properties.map(p => p.name).join(","));

        if (scopeType.extends) {
            // Each base class constructor argument is wrapped in a scoped expression.
            const extendsArguments = scopeType.extendsArguments?.map(arg => ({
                exprType: "scoped",
                parameters: chainNamedArguments,
                expr: arg,
            } as TstScopedExpression)) || [];

            this.setupInstanceScope(obj, scopeType.extends, extendsArguments);
        }

        for (let prop of scopeType.properties) {
            // TODO: Default initializers should be applied in a separate pass if not overridden at any class depth.
            // Doing it here works for most cases, but probably not for some cases when "this.XX" is used in a argument
            // to a base class constructor and resolves to the default instead of an overridden initializer.

            obj[prop.name] = { exprType: "scoped", parameters: chainNamedArguments, expr: prop.initializer! } as TstScopedExpression;
        }

        for (let stmt of scopeType.initializers) {
            obj[stmt.name] = { exprType: "scoped", parameters: chainNamedArguments, expr: stmt.argument } as TstScopedExpression;
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
        specializedArrayType.initializeType();
        this.types.push(specializedArrayType);
    }

    createInstance(type: TypeDefinition, args: TstExpression[], userData: any = null): TstInstanceObject {
        const obj: TstInstanceObject = { 
            [TypeMeta]: type,
            [InstanceMeta]: userData,
        };

        this.setupInstanceScope(obj, type, args);
        return obj;
    }

    private reduceInstanceByType(obj: TstInstanceObject, scopeType: TypeDefinition, visitedInstances: Set<TstInstanceObject>) {
        if (scopeType.extends) {
            this.reduceInstanceByType(obj, scopeType.extends, visitedInstances);
        }

        for (let propertyDeclaration of scopeType.properties) {
            const propertyScopedExpression = obj[propertyDeclaration.name];

            // NOTE: Parameters should've been converted to scoped expressions so don't have to pass them again here
            const reducer = new TstReduceExpressionVisitor(this, obj, [], visitedInstances);
            const reduced = reducer.visit(propertyScopedExpression);

            // Check if types match using the TstExpressionTypeVisitor
            const reducedType = this.getExpressionType(reduced, obj[TypeMeta]);

            if (reducedType != propertyDeclaration.type) {
                throw new Error(`Type mismatch when reducing property ${propertyDeclaration.name} of type ${propertyDeclaration.type.name}, got ${reducedType?.name || "unknown"}`);
            }

            obj[propertyDeclaration.name] = reduced;
        }
    }

    reduceInstance(obj: TstInstanceObject) {
        const type = obj[TypeMeta];
        const visitedInstances = new Set<TstInstanceObject>();
        this.reduceInstanceByType(obj, type, visitedInstances);
    }

    createInt(value: number): TstInstanceObject {
        const intType = this.getType("int");
        const intObject = intType.createInstance([]);
        intObject[InstanceMeta] = value | 0;
        return intObject;
    }
}
