import { promises as fs } from "fs";
import { inspect, parseArgs } from "node:util";
import { TstExpression } from "vexed";

// "exec" runs a diff JSON and applies it to the remote provider
// It implements the VM that diffs rely on to replay computations etc

interface DstObject {
    [key: string]: DstExpression;
}

interface DstAction {
    type: string;
}

interface DstCreateAction extends DstAction {
    type: "create";
    providerType: string;
    sourceObject: string;
    remoteObject: any;
    depends: string[];
    recompute: any[];
}

interface DstUpdateAction extends DstAction {
    type: "update";
    providerType: string;
    sourceObject: string;
    remoteObject: any;
    depends: string[];
}

interface DstRecompute {
    object: string;
    propertyName: string;
    value: DstExpression;
}

interface DstExpression {
    kind: string;
}

interface DstInstanceExpression extends DstExpression {
    kind: "instance";
    ref: string;
}

interface DstMemberExpression extends DstExpression {
    kind: "member";
    object: DstExpression;
    member: string;
}

interface DstConstantExpression extends DstExpression {
    kind: "constant";
    value: any;
}

interface DstScopedExpression extends DstExpression {
    kind: "scoped";
    scope: any;
    body: DstExpression;
}

interface DstParameterExpression extends DstExpression {
    kind: "parameter";
    name: string;
}

interface DstArrayExpression extends DstExpression {
    kind: "array";
    items: DstExpression[];
}

interface DstObjectExpression extends DstExpression {
    kind: "object";
    value: DstObject; // { [key: string]: DstExpression };
}

interface DstProgram {
    objects: DstObject[];
    objectNames: string[];
    actions: DstAction[];
}

function isDstInstanceExpression(expr: DstExpression): expr is DstInstanceExpression {
    return expr.kind === "instance";
}

function isDstMemberExpression(expr: DstExpression): expr is DstMemberExpression {
    return expr.kind === "member";
}

function isDstConstantExpression(expr: DstExpression): expr is DstConstantExpression {
    return expr.kind === "constant";
}

function isDstScopedExpression(expr: DstExpression): expr is DstScopedExpression {
    return expr.kind === "scoped";
}

function isDstParameterExpression(expr: DstExpression): expr is DstParameterExpression {
    return expr.kind === "parameter";
}

function isDstArrayExpression(expr: DstExpression): expr is DstArrayExpression {
    return expr.kind === "array";
}

function isDstObjectExpression(expr: DstExpression): expr is DstObjectExpression {
    return expr.kind === "object";
}

class DiffVm {

    program: DstProgram = { objects: [], objectNames: [], actions: []};

    load(script: any) {
        this.program = script as DstProgram;
    }

    run() {

        for (let action of this.program.actions) {
            if (action.type === "create") {
                const createAction = action as DstCreateAction;
                console.log("CREATE", createAction.sourceObject, "->", inspect(createAction.remoteObject, { depth: null }));

                const sourceObject = this.getObject(createAction.sourceObject);

                // TODO: Lookup provider type from createAction.resourceType
                // TODO: Call provider type "Create()" method
                // TODO: Convert response to Dst and assign to sourceObject "remote" property

                sourceObject["remote"] = {
                    kind: "object",
                    value: {
                        id: {
                            kind: "constant",
                            value: "321"
                        } as DstConstantExpression
                    }
                } as DstObjectExpression;

                for (let propertyName of Object.keys(sourceObject)) {
                    try {
                        console.log("  " + propertyName + " = " + this.formatExpression(this.evaluateExpression(sourceObject[propertyName])));
                    } catch (err: any) {
                        console.error(err.message);
                    }
                }

                for (let recompute of createAction.recompute) {
                    this.recompute(recompute);
                }
            } else if (action.type === "update") {
                const updateAction = action as DstUpdateAction;
                console.log("UPDATE", updateAction.sourceObject, "->", inspect(updateAction.remoteObject, { depth: null }));

                const sourceObject = this.getObject(updateAction.sourceObject);
                // TODO: Changed fields should be listed in diff
            }
        }
    }

    recompute(recompute: DstRecompute) {
        console.log("Recompute " + recompute.object + "." + recompute.propertyName + " = " + this.formatExpression(this.evaluateExpression(recompute.value)));
        const instance = this.getObject(recompute.object);
        instance[recompute.propertyName] = this.evaluateExpression(recompute.value);
    }

    formatObject(obj: DstObject): string {
        const entries = Object.entries(obj).map(([key, value]) => `${key} = ${this.formatExpression(value)}`);
        return "{" + entries.join(", ") + "}";
    }

    formatExpression(expr: DstExpression): string {
        if (isDstConstantExpression(expr)) {
            if (expr.value === null || expr.value === undefined) {
                return "null";
            }

            return expr.value.toString();
        }

        if (isDstArrayExpression(expr)) {
            return "[" + expr.items.map(item => this.formatExpression(item)).join(", ") + "]";
        }

        if (isDstObjectExpression(expr)) {
            return this.formatObject(expr.value);
        }

        if (isDstInstanceExpression(expr)) {
            const object = this.getObject(expr.ref);
            return this.formatObject(object);
        }

        return "<" + expr.kind + ">";
    }

    getObject(ref: string): DstObject {
        const index = this.program.objectNames.indexOf(ref);
        if (index === -1) {
            throw new Error("Object not found: " + ref);
        }

        return this.program.objects[index];
    }

    scopes: any[] = [];

    evaluateExpression(expr: DstExpression): DstExpression {
        if (isDstInstanceExpression(expr)) {
            return expr;
        }

        if (isDstMemberExpression(expr)) {
            const objectExpression = this.evaluateExpression(expr.object);
            
            let object: DstObject;
            if (isDstInstanceExpression(objectExpression)) {
                object = this.getObject(objectExpression.ref);
            } else if (isDstConstantExpression(objectExpression)) {
                object = objectExpression.value as DstObject;
            } else if (isDstObjectExpression(objectExpression)) {
                object = objectExpression.value;
            } else {
                throw new Error("Member expression requires object for property " + expr.member);
            }

            const propertyExpression = object[expr.member];
            if (typeof propertyExpression === "string") {
                throw new Error("Property " + expr.member + " not found on object " + object.__ID__);
            }

            if (!propertyExpression) {
                return {
                    kind: "constant",
                    value: "###missing expr###"
                } as DstConstantExpression;
            }

            return this.evaluateExpression(propertyExpression);
        }

        if (isDstConstantExpression(expr)) {
            return expr;
        }

        if (isDstScopedExpression(expr)) {
            this.scopes.push(expr.scope);
            const result = this.evaluateExpression(expr.body);
            this.scopes.pop();
            return result;
        }

        if (isDstParameterExpression(expr)) {
            const scope = this.scopes[this.scopes.length - 1];
            const parameterExpression = scope[expr.name];
            if (!parameterExpression) {
                throw new Error("Parameter not found")
            }

            return this.evaluateExpression(parameterExpression);
        }

        if (isDstArrayExpression(expr)) {
            const items = expr.items.map(e => this.evaluateExpression(e));
            return {
                kind: "array",
                items: items
            } as DstArrayExpression;
        }

        if (isDstObjectExpression(expr)) {
            const value: { [key: string]: DstExpression } = {};
            for (let [key, valueExpression] of Object.entries(expr.value)) {
                value[key] = this.evaluateExpression(valueExpression);
            }

            return {
                kind: "object",
                value: value
            } as DstObjectExpression;
        }

        throw new Error("Unsupported expression: " + expr.kind + " (in " + JSON.stringify(expr) + ")");
    }
}

export function convertBufferToString(buf: Buffer): string {
  let encoding: BufferEncoding = "utf8";

  if (buf.length >= 2) {
    // UTF‑16LE BOM: FF FE
    if (buf[0] === 0xFF && buf[1] === 0xFE) {
      encoding = "utf16le";
      buf = buf.slice(2);
    }
  }

  if (buf.length >= 3) {
    // UTF‑8 BOM: EF BB BF
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      encoding = "utf8";
      buf = buf.slice(3);
    }
  }

  return buf.toString(encoding);
}

export async function execCommand(args: string[]) {

    const { values, positionals } = parseArgs({
        options: {
            verbose: { type: "boolean", short: "v" },
        }, 
        allowPositionals: true,
        args 
    });

    const fileName = positionals[0];
    const buffer = await fs.readFile(fileName);
    const script = convertBufferToString(buffer);

    const diffVm = new DiffVm();
    
    diffVm.load(JSON.parse(script));

    diffVm.run();
}
