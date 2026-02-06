import { promises as fs } from "fs";
import { inspect, isPrimitive, parseArgs } from "node:util";
import { InstanceMeta, isInstanceExpression, isMemberExpression, isMissingInstanceExpression, isNativeMemberExpression, isParameter, isScopedExpression, printExpression, printJsonObject, printObject, RuntimeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMemberExpression, TstMissingInstanceExpression, TstParameterExpression, TstRuntime, TstScopedExpression, TstVariable, TstVariableExpression, TypeDefinition, TypeMeta } from "vexed";
import { TstInstanceVisitor } from "vexed/dist/visitors/TstInstanceVisitor.js";
import { registerDigitalOcean } from "./digitalocean.js";
import { TstReplaceVisitor } from "vexed/dist/visitors/TstReplaceVisitor.js";
import { getScopeParameter, TstScope } from "vexed/dist/visitors/TstReduceExpressionVisitor.js";
import { topoSort } from "./toposort.js";

// Helper function to get all instances from root
function getInstancesFromRoot(runtime: TstRuntime, obj: TstInstanceObject): TstInstanceObject[] {
    const instanceVisitor = new TstInstanceVisitor(runtime);
    instanceVisitor.visitInstanceExpression({
        exprType: "instance",
        instance: obj,
    } as TstInstanceExpression);
    return [...instanceVisitor.visited];
}

// "diff" is an analysis mode.

interface TstEdge {
    from: TstInstanceObject;
    to: TstInstanceObject;
    links: { instance: TstInstanceObject; propertyName: string; initializer: TstExpression | null }[];
}

// TODO: FindMany?
class FindExpressionVisitor extends TstReplaceVisitor {
    found: boolean = false;
    visited: Set<TstExpression> = new Set();
    scopeStack: TstScope[] = [];

    constructor(private matcher: (expr: TstExpression) => boolean) {
        super();
    }

    visit(expr: TstExpression): TstExpression {
        if (this.found) {
            return expr;
        }

        if (this.matcher(expr)) {
            this.found = true;
            return expr;
        }

        return super.visit(expr);
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        // Search inside parameters
        const variable = getScopeParameter(this.scopeStack[this.scopeStack.length - 1], expr.name);
        if (variable && variable.value) {
            this.visit(variable.value);
        }

        return expr;
    }

    visitVariableExpression(expr: TstVariableExpression): TstExpression {
        const variable = getScopeParameter(this.scopeStack[this.scopeStack.length - 1], expr.name);
        if (variable && variable.value) {
            this.visit(variable.value);
        }

        return expr;
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        this.scopeStack.push(expr.scope);
        super.visitScopedExpression(expr);
        this.scopeStack.pop();
        return expr;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        if (this.visited.has(expr)) {
            return expr;
        }

        this.visited.add(expr);

        const instanceType = expr.instance[TypeMeta];

        // Not visiting properties, the boundary is the instance.

        // Search inside array instances
        if (instanceType.name.endsWith("[]")) {
            const array = expr.instance[InstanceMeta] as TstExpression[];
            for (let item of array) {
                this.visit(item);
            }
        }

        return expr;
    }
}

function expressionHasInstanceReference(expr: TstExpression, searchInstance: TstInstanceObject): boolean {
    const visitor = new FindExpressionVisitor((expr) => isInstanceExpression(expr) && expr.instance === searchInstance);
    visitor.visit(expr);
    return visitor.found;
}

function findInstanceReferences(obj: TstInstanceObject, scopeType: TypeDefinition, searchInstance: TstInstanceObject, edges: TstEdge[]) {

    // Create edge if any of the instance properties have an expression which references the searchInstance

    if (scopeType.extends) {
        findInstanceReferences(obj, scopeType.extends, searchInstance, edges);
    }

    for (let propertyDeclaration of scopeType.properties) {
        if (!obj[propertyDeclaration.name]) {
            continue;
        }

        if (expressionHasInstanceReference(obj[propertyDeclaration.name], searchInstance)) {
            // the link here is such, if searchInstance(to) changes, then from must be recomputed
            // so we have from[property]= 
            const link = { instance: obj, propertyName: propertyDeclaration.name, initializer: obj[propertyDeclaration.name] };
            const e = edges.find(e => e.from === obj && e.to === searchInstance);
            if (e) {
                e.links.push(link);
                continue;
            }

            edges.push({ from: obj, to: searchInstance, links: [ link ] });
        }
    }
}

function findAllInstanceReferences(instances: TstInstanceObject[], edges: TstEdge[], searchInstance: TstInstanceObject): TstEdge[] {
    for (let instance of instances) {
        if (searchInstance === instance) {
            continue;
        }

        const instanceType = instance[TypeMeta];
        findInstanceReferences(instance, instanceType, searchInstance, edges);
    }

    return edges;
}


function getResourceEdges(nodes: TstInstanceObject[], edges: TstEdge[], resourceType: TypeDefinition, startNode: TstInstanceObject, visited: TstEdge[], parents: TstEdge[], result: TstEdge[]) {
    // Search for all the nodes that connect through all neighbouring resources to the startNode.
    // Resource nodes = instances of types inheriting from the "Resource" base class.
    // Non-resource nodes = instances of script classes, arrays and primitives like strings, numbers etc.

    const linkedEdges = edges.filter(e => e.from === startNode);
    for (let toNode of linkedEdges) {
        if (visited.find(e => e.from === toNode.from && e.to === toNode.to)) {
            continue;
        }

        visited.push(toNode);

        const toType = toNode.to[TypeMeta];
        const edgeParents = [ ...parents, toNode ];
        if (toType.runtime.isTypeAssignable(toType, resourceType)) {
            // If its a resource, we are done. Combine edges that led here into a final resource->resource edge.
            const resourceEdge: TstEdge = { from: edgeParents[0].from, to: toNode.to, links: [] };
            result.push(resourceEdge);
            continue;
        }

        getResourceEdges(nodes, edges, resourceType, toNode.to, visited, edgeParents, result);
    }
}

class PrintDiffVisitor extends TstReplaceVisitor {

    instanceRefMap: Map<TstInstanceObject, string> = new Map();

    getInstanceRef(instance: TstInstanceObject): string {
        if (this.instanceRefMap.has(instance)) {
            return this.instanceRefMap.get(instance)!;
        }

        const instanceType = instance[TypeMeta];
        const key = (instanceType.name + (this.instanceRefMap.size + 1)).replace(/\[\]/g, "");
        this.instanceRefMap.set(instance, key);
        return key;
    }

    printScope(scope: TstScope): any {
        const result: Record<string, any> = {};
        for (let variable of scope.variables) {
            result[variable.name] = this.printExpression(variable.value!);
        }

        if (scope.parent) {
            const parentScope = this.printScope(scope.parent);
            result.__PARENT__ = parentScope;
        }
        return result;
    }

    printExpression(expr: TstExpression): any {

        if (isInstanceExpression(expr)) {
            const instanceType = expr.instance[TypeMeta];
            if (instanceType.name === "int" || instanceType.name === "string" || instanceType.name === "bool") {
                return {
                    kind: "constant",
                    value: expr.instance[InstanceMeta],
                };
            }

            if (instanceType.name.endsWith("[]")) {
                const array = expr.instance[InstanceMeta] as TstExpression[];
                return {
                    kind: "array",
                    items: array.map(item => this.printExpression(item)),
                };
            }

            return {
                kind: "instance",
                ref: this.getInstanceRef(expr.instance),
            };
        }

        if (isScopedExpression(expr)) {
            return {
                kind: "scoped",
                scope: this.printScope(expr.scope),
                body: this.printExpression(expr.expr),
            };
        }

        if (isMemberExpression(expr)) {
            return {
                kind: "member",
                object: this.printExpression(expr.object),
                member: expr.property,
            }
        }

        if (isParameter(expr)) {
            return {
                kind: "parameter",
                name: expr.name,
            };
        }

        if (isNativeMemberExpression(expr)) {
            return this.printExpression({
                exprType: "member",
                object: expr.object,
                property: expr.memberName,
            } as TstMemberExpression);
        }

        return {
            kind: expr.exprType,
            __UNHANDLED__: "___UNHANDLED__"
        }
    }

    printInstanceType(instance: TstInstanceObject, obj: Record<string, unknown>, type: TypeDefinition): any {

        if (type.extends) {
            this.printInstanceType(instance, obj, type.extends);
        }

        for (let property of type.properties) {
            const propertyName = property.name;
            const propExpr = type.resolvePropertyExpression(instance, propertyName);
            if (propExpr) {
                obj[propertyName] = this.printExpression(propExpr);
            }
        }
    }

    printPrimitive(instance: TstExpression): any {
        if (isInstanceExpression(instance)) {
            return instance.instance[InstanceMeta];
        }
    }

    printInstance(instance: TstInstanceObject): any {
        const instanceType = instance[TypeMeta];

        // if (instanceType.name === "int" || instanceType.name === "string" || instanceType.name === "bool") {
        //     return {
        //         kind: "constant",
        //         value: instance[InstanceMeta],
        //     };
        // }

        const obj: Record<string, unknown> = {};
        this.printInstanceType(instance, obj, instanceType);
        return obj;
    }

    printInstanceRef(instance: TstInstanceObject): string {
        return this.getInstanceRef(instance);
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        return super.visit(expr);
    }
}

class ProviderDiffer {

    diff(runtime: TstRuntime, root: TstInstanceObject) {
        const resourceBaseType = runtime.getType("Resource");
        if (!resourceBaseType) {
            throw new Error("No Resource base type found");
        }

        const instances = getInstancesFromRoot(runtime, root);

        const edges: TstEdge[] = [];
        for (let instance of instances) {
            if (instance[RuntimeMeta].sealed) {
                continue;
            }

            findAllInstanceReferences(instances, edges, instance);
        }

        // Print graph
        // for (let edge of edges) {
        //     console.log(`${edge.from[TypeMeta].name} --> ${edge.to[TypeMeta].name} [${edge.links.map(l => l.fromProperty).join(", ")}]`);
        // }

        const resources: { instance: TstInstanceObject, sourceInstance: TstInstanceObject, remoteObject: any, typeName: string, dependencies: TstEdge[] | null}[] = [];

        for (const instance of instances) {
            const instanceType = instance[TypeMeta];

            if (runtime.isTypeAssignable(instanceType, resourceBaseType)) {
                // const sourceInstance = instance; // printJsonObject(instance, true);
                const remoteExpression = instance["remote"];

                let remoteObject: any = null;
                if (remoteExpression && isInstanceExpression(remoteExpression)) {
                    remoteObject = remoteExpression.instance[InstanceMeta];
                } else if (remoteExpression && isMissingInstanceExpression(remoteExpression)) {
                    // missingInstance is in the TST because it was actually requested and found to be missing.
                    // There can be other instances that were never requested, but not confirmed missing/existing due to missing dependencies.

                } else {
                    throw new Error("Internal error: resource instance 'remote' property is neither instance nor missingInstance expression");
                }

                const dependencies: TstEdge[] = [];
                getResourceEdges(instances, edges, resourceBaseType, instance, [], [], dependencies);

                // TODO: typeName = resource type vs derived class type
                // want to return the top-most non-script class
                let extendsType: TypeDefinition | undefined = instanceType
                for (; extendsType; extendsType = extendsType.extends) {
                    if (!extendsType.location) {
                        break;
                    }
                }

                resources.push({ instance, typeName: extendsType?.name??"ERROR", sourceInstance: instance, remoteObject, dependencies });
            }
        }

        const sorted = topoSort<TstInstanceObject>(instances, edges);

        // TODO: diff doesnt have to be sorted

        type DiffAction = { type: string; };
        type CreateDiffAction = DiffAction & { type: "create", providerType: string, sourceObject: any, remoteObject: any, depends: string[];  };
        type UpdateDiffAction = DiffAction & { type: "update", providerType: string, sourceObject: any, remoteObject: any; depends: string[];  };

        const objects: any[] = [];
        const objectNames: string[] = [];
        const actions: DiffAction[] = [];

        const result = {
            objects,
            objectNames,
            actions,
        }

        const printVisitor = new PrintDiffVisitor();

        const printDependencyReference = (dep: TstEdge): string => {
            return printVisitor.printInstanceRef(dep.to);
        }

        for (let sortedInstance of sorted) {
            if (sortedInstance[RuntimeMeta].sealed) {
                continue;
            }
            objects.push(printVisitor.printInstance(sortedInstance));
            objectNames.push(printVisitor.getInstanceRef(sortedInstance));

            const resource = resources.find(r => r.instance === sortedInstance)!;
            if (!resource) continue;

            if (resource.remoteObject === null) {
                const refs = edges.filter(e => e.to === sortedInstance);

                const recompute = [];
                for (let ref of refs) {
                    for (let link of ref.links) {
                        recompute.push({
                            object: printVisitor.getInstanceRef(link.instance),
                            propertyName: link.propertyName,
                            value: link.initializer ? printVisitor.printExpression(link.initializer) : null,
                        });
                    }
                }

                result.actions.push({
                    type: "create",
                    providerType: resource.typeName, // sortedInstance[TypeMeta].name,
                    sourceObject: printVisitor.printInstanceRef(resource.sourceInstance),
                    remoteObject: "",
                    depends: resource.dependencies?.map(d => printDependencyReference(d)) || [],
                    recompute: recompute
                } as CreateDiffAction);

                // console.log("Create " + resource.typeName + ": " + printObject(resource.sourceInstance));
                // console.log("Dependencies: " + resource.dependencies?.map(d => printDependency(d)).join(", ") || "None");
            } else {
                result.actions.push({
                    type: "update",
                    providerType: resource.typeName, // sortedInstance[TypeMeta].name,
                    sourceObject: printVisitor.printInstanceRef(resource.sourceInstance),
                    remoteObject: resource.remoteObject,
                    depends: resource.dependencies?.map(d => printDependencyReference(d)) || [],
                } as UpdateDiffAction);
            }
        }

        return result;
    }
}

export async function diffCommand(args: string[]) {

    const { values, positionals } = parseArgs({
        options: {
            force: { type: "boolean", short: "f" },
            verbose: { type: "boolean", short: "v" },
            debug: { type: "boolean", short: "d" } 
        }, 
        allowPositionals: true,
        args 
    });

    const fileName = positionals[0];
    const script = await fs.readFile(fileName, "utf-8");

    const runtime = new TstRuntime();
    runtime.verbose = values.verbose || false;

    registerDigitalOcean(runtime);

    runtime.loadScript(script, fileName);

    const main = runtime.getType("Main");
    if (!main) {
        throw new Error("No Main class found");
    }

    const instance = main.createInstance([])!;

    if (values.verbose) console.log("Created main instance: ", printObject(instance));

    await runtime.reduceInstance(instance);

    const differ = new ProviderDiffer();
    const diff = differ.diff(runtime, instance);
    if (values.debug) {
        console.log(inspect(diff, false, Infinity, true));
    } else {
        console.log(JSON.stringify(diff, null, 2));
    }
}
