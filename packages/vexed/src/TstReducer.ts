import { InstanceMeta, isFunctionReferenceExpression, isInstanceExpression, RuntimeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstPromiseExpression, TypeMeta } from "./TstExpression.js";
import { TypeDefinition } from "./TstType.js";
import { TstReduceExpressionVisitor, TstScope } from "./visitors/TstReduceExpressionVisitor.js";
import { TstPromiseVisitor } from "./visitors/TstPromiseVisitor.js";
import { TstInstanceVisitor } from "./visitors/TstInstanceVisitor.js";
import { TstRuntime } from "./TstRuntime.js";

export class TstReducer {
    constructor(private runtime: TstRuntime) { }

    getPromisesFromRoot(obj: TstInstanceObject): TstPromiseExpression[] {
        const promiseVisitor = new TstPromiseVisitor(this.runtime);
        promiseVisitor.visitInstanceProperties(obj, obj[TypeMeta]);
        return [ ... promiseVisitor.promises];
    }

    reduceInstanceProperties(reducer: TstReduceExpressionVisitor, obj: TstInstanceObject, scopeType: TypeDefinition): boolean {

        let sealable = true;

        if (scopeType.extends) {
            sealable &&= this.reduceInstanceProperties(reducer, obj, scopeType.extends);
        }

        reducer.scopeStack.push({
            parent: reducer.scope,
            thisObject: obj,
            variables: [],
        });

        for (let propertyDeclaration of scopeType.properties) {
            const propertyExpression = scopeType.resolveProperty(obj, propertyDeclaration.name);
            if (!propertyExpression) {
                continue;
            }

            const reduced = reducer.visit(propertyExpression);

            // Check if types match
            const reducedType = this.runtime.getExpressionType(reduced, obj[TypeMeta]);

            // Empty bindings, everything should be resolved
            const bindings = new Map<string, TypeDefinition>();
            if (!this.runtime.isTypeAssignable(reducedType, propertyDeclaration.type, bindings)) {
                throw new Error(`Type mismatch when reducing property ${propertyDeclaration.name} of type ${propertyDeclaration.type.name}, got ${reducedType?.name || "unknown"}`);
            }

            sealable &&= (isInstanceExpression(reduced) && reduced.instance[RuntimeMeta].sealed) || isFunctionReferenceExpression(reduced);

            obj[propertyDeclaration.name] = reduced;
        }

        reducer.scopeStack.pop();

        // console.log("Promises: ", reducer.promiseExpressions);
        return sealable;
    }

    reduceArrayElements(reducer: TstReduceExpressionVisitor, instance: TstInstanceObject): boolean {
        let sealable = true;
        const array = instance[InstanceMeta] as TstExpression[];

        for (let i = 0; i < array.length; i++) {
            const element = array[i];
            const reduced = reducer.visit(element);

            sealable &&= ((isInstanceExpression(reduced) && reduced.instance[RuntimeMeta].sealed) || isFunctionReferenceExpression(reduced));
            array[i] = reduced;
        }

        return sealable;
    }

    reduceScopeVariables(reducer: TstReduceExpressionVisitor, scope: TstScope) {
        for (let i = 0; i < scope.variables.length; i++) {
            const variable = scope.variables[i];
            variable.value = reducer.visit(variable.value);
        }
    }

    reduceInstanceObject(reducer: TstReduceExpressionVisitor, instance: TstInstanceObject): boolean {

        if (instance[RuntimeMeta].sealed) {
            return true;
        }

        const instanceType = instance[TypeMeta];

        let sealable = true;

        // Reduces array items if array
        if (instanceType.name.endsWith("[]")) {
            sealable &&= this.reduceArrayElements(reducer, instance)
        }

        // Reduces all properties on the instance
        sealable &&= this.reduceInstanceProperties(reducer, instance, instanceType);

        if (sealable && !instance[RuntimeMeta].sealed) {
            // console.log("[TstRuntime] Sealing " + instanceType.name, instanceType.sealedInstance);
            instance[RuntimeMeta].sealed = true;
            instanceType.sealedInstance(instance);
        }

        return sealable;
    }

    async reduceInstance(obj: TstInstanceObject) {

        while (true) {
            this.reduceInstanceOnce(obj);

            const promiseExpressions = this.getPromisesFromRoot(obj);
            if (promiseExpressions.length === 0) {
                break;
            }

            await this.resolvePromises(promiseExpressions);
        }
    }

    reduceInstanceOnce(obj: TstInstanceObject) {
        let counter = 0;

        while (true) {
            if (this.runtime.verbose) console.log("[TstRuntime] Reduction iteration", counter);

            const instanceVisitor = new TstInstanceVisitor(this.runtime);
            instanceVisitor.visited.add(obj);
            instanceVisitor.visitInstanceProperties(obj, obj[TypeMeta]);

            const reducer = new TstReduceExpressionVisitor(this.runtime, this.runtime.globalScope);

            const scopes = [ ...instanceVisitor.scopes ];
            for (let scope of scopes) {
                this.reduceScopeVariables(reducer, scope);
            }

            const instances = [ ... instanceVisitor.visited ];
            for (let instance of instances) {
                this.reduceInstanceObject(reducer, instance);
            }

            if (reducer.reduceCount === 0) {
                break;
            }

            counter++;
            if (counter > this.runtime.maxSteps) {
                throw new Error("Too many reduction iterations, possible infinite loop");
            }
        }
    }

    async resolvePromises(promiseExpressions: TstPromiseExpression[]) {
        const promises = promiseExpressions.map(pe => new Promise(async (resolve) => {
            try {
                pe.promiseValue = await pe.promise;
            } catch (err) {
                pe.promiseError = err as Error;
            }

            resolve(null);
        }));

        await Promise.all(promises);
    }
}
