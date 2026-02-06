import { TstRuntime, TypeDefinition } from "vexed";

export class ResourceTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Resource", undefined);
        
        this.astNode = {
            type: "class",
            name: "Resource",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [],
        };
    }
}
