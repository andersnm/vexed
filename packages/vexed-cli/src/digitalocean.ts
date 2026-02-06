import { TstRuntime, TypeDefinition } from "vexed";
import { ResourceTypeDefinition, DigitalOceanProviderTypeDefinition, DropletInfoTypeDefinition, DropletTypeDefinition, VpcInfoTypeDefinition, VpcNatGatewayInfoTypeDefinition, VpcNatGatewayTypeDefinition, VpcNatGatewayVpcTypeDefinition, VpcTypeDefinition } from "vexed-digitalocean";

// Import ArrayTypeDefinition from the internal path since it's not exported from main index
// We need to create the array type manually
class LocalArrayTypeDefinition extends TypeDefinition {
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
    // Register Resource base type first
    const resourceType = new ResourceTypeDefinition(runtime);
    runtime.types.push(resourceType);
    
    // Then register provider type
    const providerType = new DigitalOceanProviderTypeDefinition(runtime);
    runtime.types.push(providerType);
    
    // Register info types (they don't depend on anything)
    const dropletInfoType = new DropletInfoTypeDefinition(runtime);
    const vpcInfoType = new VpcInfoTypeDefinition(runtime);
    const vpcNatGatewayInfoType = new VpcNatGatewayInfoTypeDefinition(runtime);
    runtime.types.push(dropletInfoType, vpcInfoType, vpcNatGatewayInfoType);
    
    // Create VpcNatGatewayVpc type and its array type
    const vpcNatGatewayVpcType = new VpcNatGatewayVpcTypeDefinition(runtime);
    const vpcNatGatewayVpcArrayType = new LocalArrayTypeDefinition(
        runtime, 
        "VpcNatGatewayVpc[]", 
        vpcNatGatewayVpcType
    );
    runtime.types.push(vpcNatGatewayVpcType, vpcNatGatewayVpcArrayType);

    // Now create resource types
    const dropletType = new DropletTypeDefinition(runtime);
    const vpcType = new VpcTypeDefinition(runtime);
    const vpcNatGatewayType = new VpcNatGatewayTypeDefinition(runtime);
    runtime.types.push(dropletType, vpcType, vpcNatGatewayType);
    
    // Initialize types after all are registered
    providerType.initializeType?.();
    vpcNatGatewayVpcType.initializeType?.();
    dropletType.initializeType?.();
    vpcType.initializeType?.();
    vpcNatGatewayType.initializeType?.();
}
