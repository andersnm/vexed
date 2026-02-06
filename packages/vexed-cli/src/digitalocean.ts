import { TstRuntime } from "vexed";
import { ResourceTypeDefinition, DigitalOceanProviderTypeDefinition, DropletInfoTypeDefinition, DropletTypeDefinition, VpcInfoTypeDefinition, VpcNatGatewayInfoTypeDefinition, VpcNatGatewayTypeDefinition, VpcNatGatewayVpcTypeDefinition, VpcTypeDefinition } from "vexed-digitalocean";

export function registerDigitalOcean(runtime: TstRuntime) {
    const doTypes = [
        new ResourceTypeDefinition(runtime),
        new DigitalOceanProviderTypeDefinition(runtime),
        new DropletInfoTypeDefinition(runtime),
        new DropletTypeDefinition(runtime),
        new VpcInfoTypeDefinition(runtime),
        new VpcTypeDefinition(runtime),
        new VpcNatGatewayInfoTypeDefinition(runtime),
        new VpcNatGatewayVpcTypeDefinition(runtime),
        new VpcNatGatewayTypeDefinition(runtime),
    ];

    runtime.registerTypes(doTypes);
}
