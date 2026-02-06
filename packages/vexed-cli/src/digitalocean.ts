import { TstRuntime, TypeDefinition } from "vexed";
import { ResourceTypeDefinition, DigitalOceanProviderTypeDefinition, DropletInfoTypeDefinition, DropletTypeDefinition, VpcInfoTypeDefinition, VpcNatGatewayInfoTypeDefinition, VpcNatGatewayTypeDefinition, VpcNatGatewayVpcTypeDefinition, VpcTypeDefinition } from "vexed-digitalocean";

// Import ArrayTypeDefinition from the internal path since it's not exported from main index
// We need to create the array type manually
class ArrayTypeDefinition extends TypeDefinition {
    constructor(runtime: TstRuntime, name: string, public elementType: TypeDefinition) {
        super(runtime, name, undefined);
        this.astNode = {
            type: "class",
            name: name,
            parameters: [],
            extends: "any[]",
            extendsArguments: [],
            units: [],
        };
    }
}

export function registerDigitalOcean(runtime: TstRuntime) {
    const vpcNatGatewayVpcType = new VpcNatGatewayVpcTypeDefinition(runtime);
    const vpcNatGatewayVpcArrayType = new ArrayTypeDefinition(
        runtime, 
        "VpcNatGatewayVpc[]", 
        vpcNatGatewayVpcType
    );

    const doTypes = [
        new ResourceTypeDefinition(runtime),
        new DigitalOceanProviderTypeDefinition(runtime),
        new DropletTypeDefinition(runtime),
        new DropletInfoTypeDefinition(runtime),
        new VpcTypeDefinition(runtime),
        new VpcInfoTypeDefinition(runtime),
        new VpcNatGatewayTypeDefinition(runtime),
        new VpcNatGatewayInfoTypeDefinition(runtime),
        vpcNatGatewayVpcType,
        vpcNatGatewayVpcArrayType,
    ];

    runtime.types.push(...doTypes);
}
