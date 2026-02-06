import { InstanceMeta, printJsonObject, RuntimeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstRuntime, TypeDefinition, AstIdentifierType, AstPropertyDefinition } from "vexed";
import { DigitalOceanApi, DigitalOceanRepository } from "./DigitalOceanRepository.js";

export interface DigitalOceanProviderInfo {
    api: DigitalOceanApi;
    repository: DigitalOceanRepository;
}

export class DigitalOceanProviderTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "DigitalOceanProvider", undefined);

        this.astNode = {
            type: "class",
            name: "DigitalOceanProvider",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "apiToken",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "region",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
            ],
        };
    }

    sealedInstance(instance: TstInstanceObject) {
        const jsonOutput = printJsonObject(instance, false);

        const apiToken = jsonOutput.apiToken as string;
        const region = jsonOutput.region as string;

        const api = new DigitalOceanApi(apiToken, region);
        const repository = new DigitalOceanRepository(api);

        instance[InstanceMeta] = { api, repository };

        super.sealedInstance(instance);
    }
}
