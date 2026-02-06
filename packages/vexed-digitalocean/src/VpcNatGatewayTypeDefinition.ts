import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMissingInstanceExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta, AstArrayType, AstIdentifierType, AstParameter, AstPropertyDefinition } from "vexed";
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
            throw new Error("No such VPC NAT Gateway");
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
                resourceType: "VpcNatGateway",
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
        super(runtime, "VpcNatGatewayInfo", undefined);
        
        this.astNode = {
            type: "class",
            name: "VpcNatGatewayInfo",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [],
        };
    }
}

export class VpcNatGatewayVpcTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "VpcNatGatewayVpc", undefined);
        
        this.astNode = {
            type: "class",
            name: "VpcNatGatewayVpc",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "vpc_uuid",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "default_gateway",
                    propertyType: { type: "identifier", typeName: "bool" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
            ],
        };
    }
}

export class VpcNatGatewayTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "VpcNatGateway", undefined);
        
        this.astNode = {
            type: "class",
            name: "VpcNatGateway",
            parameters: [
                {
                    name: "provider",
                    type: { type: "identifier", typeName: "DigitalOceanProvider" } as AstIdentifierType,
                } as AstParameter,
            ],
            extends: "Resource",
            extendsArguments: [],
            units: [
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "id",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "name",
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
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "type",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "size",
                    propertyType: { type: "identifier", typeName: "int" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "vpcs",
                    propertyType: {
                        type: "array",
                        arrayItemType: { type: "identifier", typeName: "VpcNatGatewayVpc" } as AstIdentifierType,
                    } as AstArrayType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "private",
                    type: "propertyDefinition",
                    name: "remote",
                    propertyType: { type: "identifier", typeName: "VpcNatGatewayInfo" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
            ],
        };
    }
    
    initializeProperties(): void {
        // Set the initializer for the id property after types are registered
        const idProperty = this.properties.find(p => p.name === "id");
        if (idProperty) {
            idProperty.initializer = makeThisRemoteNativeMemberExpression(
                this.runtime.getType("string")!,
                "id",
                (remoteInstance: TstInstanceObject) => {
                    const natGateway = remoteInstance[InstanceMeta] as VpcNatGatewayInfo;
                    return this.runtime.createString(natGateway.id);
                }
            );
        }
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
