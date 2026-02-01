import { 
    InstanceMeta, 
    isInstanceExpression, 
    TstExpression, 
    TstInstanceExpression, 
    TstPromiseExpression,
    TstRuntime, 
    TypeDefinition, 
    TypeMethod, 
    AstMethodDeclaration, 
    AstIdentifierType,
    printExpression,
    TstScope
} from "vexed";

export class IoTypeDefinition extends TypeDefinition {
    private outputCallback: (message: string) => void;

    constructor(runtime: TstRuntime, outputCallback: (message: string) => void = console.log) {
        super(runtime, "Io");
        this.outputCallback = outputCallback;

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
            this.outputCallback("Io.print: " + message);

            return {
                exprType: "instance",
                instance: this.runtime.createInt(0)
            } as TstExpression;
        }

        throw new Error("Method not implemented: " + method.name);
    }
}
