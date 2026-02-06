import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMissingInstanceExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta, AstIdentifierType, AstParameter, AstPropertyDefinition } from "vexed";
import { DropletInfo } from "./DigitalOceanRepository.js";
import { getInstanceMetaFromScopeParameter, hasNameInstance, makeAstThisRemoteNativeMemberExpression } from "./TstAsyncProperty.js";
import { DigitalOceanProviderInfo } from "./DigitalOceanProviderTypeDefinition.js";

async function dropletGetter(instance: TstInstanceObject, propertyName: string): Promise<TstExpression> {
    const instanceType = instance[TypeMeta];

    const nameExpr = instance["name"] as TstInstanceExpression;
    const name: string = nameExpr.instance[InstanceMeta];

    const provider = getInstanceMetaFromScopeParameter<DigitalOceanProviderInfo>(instance, "provider");

    try {
        const droplet = await provider.repository.getDroplet(name);
        if (!droplet) {
            throw new Error("No such Droplet");
        }
        
        const dropletInfoType = instanceType.runtime.getType("DropletInfo");
        const dropletInstance: TstInstanceObject = instanceType.runtime.createInstance(dropletInfoType, [], droplet)!;
        return {
            exprType: "instance",
            instance: dropletInstance,
        } as TstInstanceExpression;
    } catch (err: any) {
        return {
            exprType: "missingInstance",
            error: err as Error,
            meta: {
                resourceType: "Droplet",
                name,
                vpc_uuid: instance["vpc_uuid"],
            },
            instance,
            propertyName,
            propertyType: instanceType.runtime.getType("DropletInfo"),
        } as TstMissingInstanceExpression;
    }
}

export class DropletInfoTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "DropletInfo", undefined);
        
        this.astNode = {
            type: "class",
            name: "DropletInfo",
            parameters: [],
            extends: "any",
            extendsArguments: [],
            units: [],
        };
    }
}

export class DropletTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Droplet", undefined);
        
        this.astNode = {
            type: "class",
            name: "Droplet",
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
                    propertyType: { type: "identifier", typeName: "int" } as AstIdentifierType,
                    argument: makeAstThisRemoteNativeMemberExpression("int", "id"),
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
                    name: "size",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "image",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "public",
                    type: "propertyDefinition",
                    name: "vpc_uuid",
                    propertyType: { type: "identifier", typeName: "string" } as AstIdentifierType,
                    argument: null,
                } as AstPropertyDefinition,
                {
                    modifier: "private",
                    type: "propertyDefinition",
                    name: "remote",
                    propertyType: { type: "identifier", typeName: "DropletInfo" } as AstIdentifierType,
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
                    promiseType: this.runtime.getType("DropletInfo"),
                    promise: dropletGetter(instance, "remote"),
                } as TstPromiseExpression;
        }

        return super.resolveProperty(instance, propertyName);
    }
}
