import { InstanceMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstMissingInstanceExpression, TstPromiseExpression, TstRuntime, TypeDefinition, TypeMeta } from "vexed";
import { DropletInfo } from "./DigitalOceanRepository.js";
import { getInstanceMetaFromScopeParameter, hasNameInstance, makeThisRemoteNativeMemberExpression } from "./TstAsyncProperty.js";
import { DigitalOceanProviderInfo } from "./DigitalOceanProviderTypeDefinition.js";

async function dropletGetter(instance: TstInstanceObject, propertyName: string): Promise<TstExpression> {
    const instanceType = instance[TypeMeta];

    const nameExpr = instance["name"] as TstInstanceExpression;
    const name: string = nameExpr.instance[InstanceMeta];

    const provider = getInstanceMetaFromScopeParameter<DigitalOceanProviderInfo>(instance, "provider");

    try {
        const droplet = await provider.repository.getDroplet(name);
        if (!droplet) {
            throw new Error("No such Droplet"); // uses exceptions for flow :(
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
        // this shall be an opaque object, only the InstanceMeta is used with VpcInfo and rejection error
        // use nativeMember expression to read stuff
    }
}

export class DropletTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime) {
        super(runtime, "Droplet", undefined);
        
        this.extends = this.runtime.getType("Resource");

        this.parameters.push({
            name: "provider",
            type: this.runtime.getType("DigitalOceanProvider")!,
        });

        this.properties.push({ // id is "output" - depends on resource exists
            modifier: "public",
            name: "id",
            type: this.runtime.getType("int")!,
            initializer: makeThisRemoteNativeMemberExpression(this.runtime.getType("int")!, "id", (remoteInstance: TstInstanceObject) => {
                const droplet = remoteInstance[InstanceMeta] as DropletInfo;
                return this.runtime.createInt(droplet.id);
            }),
        });

        this.properties.push({ // name is "input", maps 1:1 w/DO droplet name
            modifier: "public",
            name: "name",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({ // size is "input", maps 1:1 w/DO droplet size
            modifier: "public",
            name: "size",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({ // image is "input", maps 1:1 w/DO droplet image
            modifier: "public",
            name: "image",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({ // vpc_uuid is "input"
            modifier: "public",
            name: "vpc_uuid",
            type: this.runtime.getType("string")!,
        });

        this.properties.push({
            modifier: "private",
            name: "remote",
            type: this.runtime.getType("DropletInfo")!,
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
                    promiseType: this.runtime.getType("DropletInfo"),
                    promise: dropletGetter(instance, "remote"),
                } as TstPromiseExpression;
        }

        return super.resolveProperty(instance, propertyName);
    }
}
