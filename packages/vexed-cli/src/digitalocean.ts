import { TstRuntime, ArrayTypeDefinition } from "vexed";
import { ResourceTypeDefinition, DigitalOceanProviderTypeDefinition, DropletInfoTypeDefinition, DropletTypeDefinition, VpcInfoTypeDefinition, VpcNatGatewayInfoTypeDefinition, VpcNatGatewayTypeDefinition, VpcNatGatewayVpcTypeDefinition, VpcTypeDefinition } from "vexed-digitalocean";

export function registerDigitalOcean(runtime: TstRuntime) {
    const doTypes = [
        new ResourceTypeDefinition(runtime),
        new DigitalOceanProviderTypeDefinition(runtime),
        new DropletTypeDefinition(runtime),
        new DropletInfoTypeDefinition(runtime),
        new VpcTypeDefinition(runtime),
        new VpcInfoTypeDefinition(runtime),
        new VpcNatGatewayTypeDefinition(runtime),
        new VpcNatGatewayInfoTypeDefinition(runtime),
        new VpcNatGatewayVpcTypeDefinition(runtime),
        new ArrayTypeDefinition(runtime, "VpcNatGatewayVpc[]"),
    ];

    runtime.types.push(...doTypes);
    doTypes.forEach(d => d.initializeType());

    runtime.createArrayType("VpcNatGatewayVpc[]");
}
