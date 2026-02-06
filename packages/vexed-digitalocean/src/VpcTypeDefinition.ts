import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMissingInstanceExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta, AstIdentifierType, AstParameter, AstPropertyDefinition } from "vexed";
import { getInstanceMetaFromScopeParameter, hasNameInstance, makeAstThisRemoteNativeMemberExpression } from "./TstAsyncProperty.js";
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
            throw new Error("No such VPC");
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
        
        this.astNode = {
            type: "class",
            name: "VpcInfo",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [],
        };
    }
}

export class VpcTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Vpc", undefined);
        
        this.astNode = {
            type: "class",
            name: "Vpc",
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
                    argument: makeAstThisRemoteNativeMemberExpression("string", "id"),
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
                    name: "description",
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
                    name: "ip_range",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "private",
                    type: "propertyDefinition",
                    name: "remote",
                    propertyType: { type: "identifier", typeName: "VpcInfo" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
            ],
        };
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
