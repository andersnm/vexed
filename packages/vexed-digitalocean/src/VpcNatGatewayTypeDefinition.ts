import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMissingInstanceExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta } from "vexed";
import { getInstanceMetaFromScopeParameter, hasNameInstance, makeThisRemoteNativeMemberExpression } from "./TstAsyncProperty.js";
import { DigitalOceanProviderInfo } from "./DigitalOceanProviderTypeDefinition.js";
import { VpcNatGatewayInfo } from "./DigitalOceanRepository.js";

async function vpcNatGatewayGetter(instance: TstInstanceObject, propertyName: string): Promise<TstExpression> {
    const instanceType = instance[TypeMeta];

    const nameExpr = instance["name"] as TstInstanceExpression;
    const name: string = nameExpr.instance[InstanceMeta];

    const provider = getInstanceMetaFromScopeParameter<DigitalOceanProviderInfo>(instance, "provider");

    try {
        const gateway = await provider.repository.getVpcNatGatewayByName(name);
        if (!gateway) {
            throw new Error("No such VPC NAT Gateway"); // uses exceptions for flow :(
        }

        const infoType = instanceType.runtime.getType("VpcNatGatewayInfo");
        const infoInstance: TstInstanceObject = instanceType.runtime.createInstance(infoType, [], gateway)!;
        return {
            exprType: "instance",
            instance: infoInstance,
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
            propertyType: instanceType.runtime.getType("VpcNatGatewayInfo"),
        } as TstMissingInstanceExpression;
    }
}

export class VpcNatGatewayInfoTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "VpcNatGatewayInfo", "<native>");
    }

    initializeType(): void {
        // opaque object
    }
}

export class VpcNatGatewayVpcTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "VpcNatGatewayVpc", "<native>");
    }

    initializeType(): void {
        this.properties.push({ // "input"
            modifier: "public",
            name: "vpc_uuid",
            type: this.runtime.getType("string"),
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "default_gateway",
            type: this.runtime.getType("bool"),
        });

    }
}

export class VpcNatGatewayTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "VpcNatGateway", "<native>");
    }

    initializeType(): void {
        this.extends = this.runtime.getType("Resource");

        this.parameters.push({
            name: "provider",
            type: this.runtime.getType("DigitalOceanProvider"),
        });

        this.properties.push({ // "output", resource must exist
            modifier: "public",
            name: "id",
            type: this.runtime.getType("string"),
            initializer: makeThisRemoteNativeMemberExpression(this.runtime.getType("string"), "id", (remoteInstance: TstInstanceObject) => {
                const natGateway = remoteInstance[InstanceMeta] as VpcNatGatewayInfo;
                return this.runtime.createString(natGateway.id);
            }),
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "name",
            type: this.runtime.getType("string"),
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "region",
            type: this.runtime.getType("string"),
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "type", // "PUBLIC"
            type: this.runtime.getType("string"),
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "size",
            type: this.runtime.getType("int"),
        });

        this.properties.push({ // "input"
            modifier: "public",
            name: "vpcs",
            type: this.runtime.getType("VpcNatGatewayVpc[]"),
        });

        this.properties.push({
            modifier: "private",
            name: "remote",
            type: this.runtime.getType("VpcNatGatewayInfo"),
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
                    promiseType: this.runtime.getType("VpcNatGatewayInfo"),
                    promise: vpcNatGatewayGetter(instance, "remote"),
                } as TstPromiseExpression;
        }

        return super.resolveProperty(instance, propertyName);
    }
}
