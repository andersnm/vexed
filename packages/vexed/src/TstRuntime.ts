import { readFile } from "fs/promises";
import { InstanceMeta, isInstanceExpression, TstExpression, TstInstanceExpression, TstInstanceObject, TstMethodExpression, TstPromiseExpression, TstScopedExpression, TstVariable, TypeMeta } from "./TstExpression.js";
import { TypeDefinition, TypeMethod } from "./TstType.js";
import { TstExpressionTypeVisitor } from "./visitors/TstExpressionTypeVisitor.js";
import { printExpression } from "./visitors/TstPrintVisitor.js";
import { TstReduceExpressionVisitor, TstScope } from "./visitors/TstReduceExpressionVisitor.js";
import path from "path";

class AnyTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "any", "<native>");
    }
}

class BoolTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "bool", "<native>");
    }

    createInstance(args: TstExpression[]): TstInstanceObject {
        return this.runtime.createInstance(this, args, false);
    }

}

class StringTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "string", "<native>");
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
        super(runtime, "int", "<native>");
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
        super(runtime, name, "<native>");
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

class TypeTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Type", "<native>");
    }

    initializeType(): void {
        this.properties.push({
            modifier: "public",
            name: "name",
            type: this.runtime.getType("string"),
        });

        this.properties.push({
            modifier: "public",
            name: "scriptPath",
            type: this.runtime.getType("string"),
        });
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        if (propertyName === "name") {
            const type = instance[InstanceMeta] as TypeDefinition;
            return { exprType: "instance", instance: this.runtime.createString(type.name) } as TstInstanceExpression;
        }

        if (propertyName === "scriptPath") {
            const type = instance[InstanceMeta] as TypeDefinition;

            const scriptPath = path.dirname(type.fileName);
            return { exprType: "instance", instance: this.runtime.createString(scriptPath) } as TstInstanceExpression;
        }

        throw new Error("Property not implemented: " + propertyName);
    }
}

class IoTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Io", "<native>");
    }

    initializeType(): void {
        this.methods.push({
            name: "print",
            parameters: [
                { name: "message", type: this.runtime.getType("any") },
            ],
            returnType: this.runtime.getType("any"),
            body: [],
        });

        this.methods.push({
            name: "readTextFile",
            parameters: [
                { name: "path", type: this.runtime.getType("string") },
            ],
            returnType: this.runtime.getType("string"),
            body: [],
        });
    }

    callFunction(method: TypeMethod, scope: TstScope): TstExpression | null {
        if (method.name === "print") {
            const messageVar = scope.variables.find(v => v.name === "message");
            if (!messageVar) {
                throw new Error("Io.print: message parameter not found");
            }

            const messageExpr = messageVar.value;
            const message = printExpression(messageExpr);
            console.log("Io.print: " + message);

            return {
                exprType: "null",
            } as TstExpression;
        }

        if (method.name === "readTextFile") {
            const pathVar = scope.variables.find(v => v.name === "path");
            if (!pathVar) {
                throw new Error("Io.readTextFile: path parameter not found");
            }

            const pathExpr = pathVar.value;
            if (!isInstanceExpression(pathExpr)) {
                return null; // Signals to caller that we cannot proceed yet
            }

            const path = pathExpr.instance[InstanceMeta];

            return {
                exprType: "promise",
                promiseType: this.runtime.getType("string"),
                promise: new Promise(async (resolve, reject) => {
                    try {
                        const str = await readFile(path, "utf-8");
                        resolve({
                            exprType: "instance",
                            instance: this.runtime.createString(str)
                        } as TstInstanceExpression);
                    } catch (err) {
                        reject(err);
                    }
                })
            } as TstPromiseExpression;
        }

        throw new Error("Method not implemented: " + method.name);
    }
}

export class TstRuntime {
    types: TypeDefinition[] = [];

    constructor() {
        this.types.push(new AnyTypeDefinition(this));
        this.types.push(new IntTypeDefinition(this));
        this.types.push(new BoolTypeDefinition(this));
        this.types.push(new ArrayBaseTypeDefinition(this, "any[]"));
        this.types.push(new StringTypeDefinition(this));
        // this.types.push(new ArrayTypeDefinition(this, "string[]"));
        this.types.push(new IoTypeDefinition(this));
        this.types.push(new TypeTypeDefinition(this));

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

        const scope: TstScope = {
            parent: null,
            thisObject: obj,
            variables: chainNamedArguments,
        };

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

            obj[prop.name] = { exprType: "scoped", scope, expr: prop.initializer! } as TstScopedExpression;
        }

        for (let stmt of scopeType.initializers) {
            obj[stmt.name] = { exprType: "scoped", scope, expr: stmt.argument } as TstScopedExpression;
        }

        for (let method of scopeType.methods) {
            obj[method.name] = { exprType: "method", method, scope } as TstMethodExpression;
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

    private reduceInstanceByType(reducer: TstReduceExpressionVisitor, obj: TstInstanceObject, scopeType: TypeDefinition, visitedInstances: Set<TstInstanceObject>): number {

        let reduceCount = 0;

        if (scopeType.extends) {
            reduceCount += this.reduceInstanceByType(reducer, obj, scopeType.extends, visitedInstances);
        }

        for (let propertyDeclaration of scopeType.properties) {
            const propertyScopedExpression = obj[propertyDeclaration.name];

            // NOTE: Parameters should've been converted to scoped expressions so don't have to pass them again here
            const reduced = reducer.visit(propertyScopedExpression);

            reduceCount += reducer.reduceCount;

            // Check if types match using the TstExpressionTypeVisitor
            const reducedType = this.getExpressionType(reduced, obj[TypeMeta]);

            if (reducedType != propertyDeclaration.type) {
                throw new Error(`Type mismatch when reducing property ${propertyDeclaration.name} of type ${propertyDeclaration.type.name}, got ${reducedType?.name || "unknown"}`);
            }

            obj[propertyDeclaration.name] = reduced;
        }

        // console.log("Promises: ", reducer.promiseExpressions);

        return reduceCount;
    }

    async reduceInstance(obj: TstInstanceObject) {
        const type = obj[TypeMeta];
        const visitedInstances = new Set<TstInstanceObject>();
        
        const scope: TstScope = {
            parent: null,
            thisObject: obj,
            variables: [],
        };

        let counter = 0;
        let promiseExpressions: TstPromiseExpression[] = [];
        while (true) {
            const reducer = new TstReduceExpressionVisitor(this, scope, visitedInstances);
            if (!this.reduceInstanceByType(reducer, obj, type, visitedInstances)) {
                promiseExpressions = reducer.promiseExpressions;
                break;
            }

            counter++;
            if (counter > 1000) {
                throw new Error("Too many reduction iterations, possible infinite loop");
            }
        }

        if (promiseExpressions.length === 0) {
            return;
        }

        const promises = promiseExpressions.map(pe => new Promise(async (resolve) => {
            try {
                pe.promiseValue = await pe.promise;
            } catch (err) {
                pe.promiseError = err as Error;
            }

            resolve(null);
        }));

        await Promise.all(promises);

        // reduce again with resolved promises
        await this.reduceInstance(obj);
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
}
