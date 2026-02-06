import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMissingInstanceExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta } from "vexed";
import { getInstanceMetaFromScopeParameter, hasNameInstance, makeThisRemoteNativeMemberExpression } from "./TstAsyncProperty.js";
import { VpcInfo } from "./DigitalOceanRepository.js";
import { DigitalOceanProviderInfo } from "./DigitalOceanProviderTypeDefinition.js";

async function vpcGetter(instance: TstInstanceObject, propertyName: string): Promise<TstExpression> {
    const instanceType = instance[TypeMeta];

    const nameExpr = instance["name"] as TstInstanceExpression;
    const name: string = nameExpr.instance[InstanceMeta];

    const provider = getInstanceMetaFromScopeParameter<DigitalOceanProviderInfo>(instance, "provider");

    try {
        const vpc = await provider.repository.getVpcByName(name);
        if (!vpc) {
            throw new Error("No such VPC"); // uses exceptions for flow :(
        }

        const vpcInfoType = instanceType.runtime.getType("VpcInfo");
        const vpcInstance: TstInstanceObject = instanceType.runtime.createInstance(vpcInfoType, [], vpc)!;
        return {
            exprType: "instance",
            instance: vpcInstance,
        } as TstInstanceExpression;
    } catch (err: any) {
        return {
            exprType: "missingInstance",
            error: err as Error,
            meta: {
                resourceType: "Vpc",
                name,
            },
            instance,
            propertyName: propertyName,
            propertyType: instanceType.runtime.getType("VpcInfo"),
        } as TstMissingInstanceExpression;
    }
}

export class VpcInfoTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "VpcInfo", undefined);
        // Opaque type
    }
}

export class VpcTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Vpc", undefined);
        
        this.extends = this.runtime.getType("Resource");

        this.parameters.push({
            name: "provider",
            type: this.runtime.getType("DigitalOceanProvider")!,
        });

        this.properties.push({ // "output"
            modifier: "public",
            name: "id",
            type: this.runtime.getType("string")!,
            initializer: makeThisRemoteNativeMemberExpression(this.runtime.getType("string")!, "id", (remoteInstance: TstInstanceObject) => {
                const vpc = remoteInstance[InstanceMeta] as VpcInfo;
                return this.runtime.createString(vpc.id);
            }),
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "name",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "description",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "region",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "ip_range",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({
            modifier: "private",
            name: "remote",
            type: this.runtime.getType("VpcInfo")!,
        });
    }

    resolveProperty(instance: TstInstanceObject, propertyName: string): TstExpression | null {
        switch (propertyName) {
            case "remote":
                if (instance[propertyName]) {
                    return instance[propertyName];
                }

                if (!hasNameInstance(instance)) {
                    return null;
                }

                return {
                    exprType: "promise",
                    promiseType: this.runtime.getType("VpcInfo"),
                    promise: vpcGetter(instance, "remote"),
                } as TstPromiseExpression;
        }

        return super.resolveProperty(instance, propertyName);
    }
}
