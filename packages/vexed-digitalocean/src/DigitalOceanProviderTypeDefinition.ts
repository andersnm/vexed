import { InstanceMeta, printJsonObject, RuntimeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstRuntime, TypeDefinition } from "vexed";
import { DigitalOceanApi, DigitalOceanRepository } from "./DigitalOceanRepository.js";

export interface DigitalOceanProviderInfo {
    api: DigitalOceanApi;
    repository: DigitalOceanRepository;
}

export class DigitalOceanProviderTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "DigitalOceanProvider", undefined);
    }

    initializeType(): void {
        this.properties.push({
            modifier: "public",
            name: "apiToken",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({
            modifier: "public",
            name: "region",
            type: this.runtime.getType("string")!,
        });
    }

    sealedInstance(instance: TstInstanceObject) {
        const jsonOutput = printJsonObject(instance, false);

        const apiToken = jsonOutput.apiToken as string;
        const region = jsonOutput.region as string;

        // console.log("[DigitalOcean] Sealing the provider instance: " + apiToken + ", " + region);

        const api = new DigitalOceanApi(apiToken, region);
        const repository = new DigitalOceanRepository(api);

        instance[InstanceMeta] = { api, repository };

        super.sealedInstance(instance);
    }
}
