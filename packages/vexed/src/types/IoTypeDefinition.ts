import { readFile } from "fs/promises";
import { InstanceMeta, isInstanceExpression, TstExpression, TstInstanceExpression, TstInstanceObject, TstPromiseExpression } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition, TypeMethod } from "../TstType.js";
import { printExpression } from "../visitors/TstPrintVisitor.js";
import { TstScope } from "../visitors/TstReduceExpressionVisitor.js";
import { AstMethodDeclaration } from "../AstProgram.js";
import { AstIdentifierType } from "../AstType.js";

export class IoTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Io");

        this.astNode = {
            type: "class",
            name: "Io",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [
                {
                    type: "methodDeclaration",
                    name: "print",
                    parameters: [
                        {
                            name: "message",
                            type: { type: "identifier", typeName: "any" } as AstIdentifierType,
                        }
                    ],
                    returnType: { type: "identifier", typeName: "any" } as AstIdentifierType,
                    statementList: [],
                } as AstMethodDeclaration,
                {
                    type: "methodDeclaration",
                    name: "readTextFile",
                    parameters: [
                        {
                            name: "path",
                            type: { type: "identifier", typeName: "string" } as AstIdentifierType,
                        }
                    ],
                    returnType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    statementList: [],
                } as AstMethodDeclaration,
            ],
        };
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
                exprType: "instance",
                instance: this.runtime.createInt(0)
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
