interface DropletRegionInfo {
    name: string;
    slug: string;
    available: boolean;
    features: string[];
    sizes: [];
}

interface DropletImageInfo {
    id: number;
    name: string;
    distribution: string;
    slug: string;
    public: boolean;
    regions: string[];
    created_at: string;
}

export interface DropletInfo {
    id: number;
    name: string;
    size: string;
    memory: number;
    vcpus: number;
    disk: string;
    image: DropletImageInfo;
    status: string;
    region: DropletRegionInfo;
    vpc_uuid: string;
}

export interface VpcInfo {
    id: string;
    name: string; // ^[a-zA-Z0-9\-\.]+$
    description: string;
    region: string;
    ip_range: string;
    default: boolean;
    urn: string;
}

interface VpcList {
    vpcs: VpcInfo[];
}

interface VpcNatGatewayVpc {
    vpc_uuid: string;
    gateway_ip?: string;
    default_gateway?: boolean;
}

export interface VpcNatGatewayInfo {
    id: string;
    name: string;
    region: string;
    type: string;
    state: string;
    size: number;
    vpcs: VpcNatGatewayVpc[];
}

interface VpcNatGatewayList {
    vpc_nat_gateways: VpcNatGatewayInfo[];
}

const ubuntuImage: DropletImageInfo = {
    id: 6372321,
    name: "Ubuntu 20.04 x64",
    distribution: "Ubuntu",
    slug: "ubuntu-20-04-x64",
    public: true,
    regions: ["nyc1", "sfo2"],
    created_at: "2020-06-10T12:00:00Z",
};

const nycRegion: DropletRegionInfo = {
    name: "New York 1",
    slug: "nyc1",
    available: true,
    features: ["backups", "ipv6", "metadata"],
    sizes: [],
};

export class DigitalOceanApi {
    droplets: DropletInfo[] = [
        {
            id: 123456,
            name: "example-droplet",
            size: "s-1vcpu-2gb",
            memory: 2048, // info
            disk: "50GB", // info
            vcpus: 1, // info
            status: "active", // info
            image: ubuntuImage,
            region: nycRegion,
            vpc_uuid: "5a4981aa-9653-4bd1-bef5-d6bff52042e4",
        },
    ];

    vpcs: VpcInfo[] = [
        {
            id: "5a4981aa-9653-4bd1-bef5-d6bff52042e4",
            name: "default-vpc",
            description: "Primary default VPC",
            region: "nyc3",
            ip_range: "10.0.0.0/16",
            default: true,
            urn: "do:vpc:5a4981aa-9653-4bd1-bef5-d6bff52042e4"
        },
        {
            id: "e0fe0f4d-596a-465e-a902-571ce57b79fa",
            name: "secondary-vpc",
            description: "Secondary test VPC",
            region: "nyc3",
            ip_range: "10.1.0.0/16",
            default: false,
            urn: "do:vpc:e0fe0f4d-596a-465e-a902-571ce57b79fa"
        }
    ];

    vpcNatGateways: VpcNatGatewayInfo[] = [
        {
            id: "70e1b58d-cdec-4e95-b3ee-2d4d95feff51",
            name: "test-vpc-nat-gateways",
            type: "PUBLIC",
            state: "ACTIVE",
            region: "tor1",
            size: 1,
            vpcs: [
                {
                    vpc_uuid: "0eb1752f-807b-4562-a077-8018e13ab1fb",
                    gateway_ip: "10.118.0.35",
                    default_gateway: true
                }
            ],
            // egresses: {
            //     public_gateways: [
            //         {
            //             ipv4: "174.138.113.197"
            //         }
            //     ]
            // },
            // udp_timeout_seconds: 30,
            // icmp_timeout_seconds: 30,
            // tcp_timeout_seconds: 30,
            // created_at: "2025-08-12T18:43:14Z",
            // updated_at: "2025-08-12T19:00:04Z"
        }
    ];

    constructor(public apiKey: string, public region: string) {
        // use apiKey and region to configure client
    }

    getDroplet(name: string): Promise<DropletInfo | null> {
        const droplet = this.droplets.find(d => d.name === name);
        if (droplet) {
            return Promise.resolve(droplet);
        }

        return Promise.resolve(null);
    }

    getVpcs(): Promise<VpcList> {
        return Promise.resolve({ vpcs: this.vpcs, meta: { total: this.vpcs.length } });
    }

    getVpc(id: string): Promise<VpcInfo | null> {
        const vpc = this.vpcs.find(v => v.id === id);
        if (vpc) {
            return Promise.resolve(vpc);
        }

        return Promise.resolve(null);
    }

    getVpcNatGateways(): Promise<VpcNatGatewayList> {
        return Promise.resolve({ vpc_nat_gateways: this.vpcNatGateways, meta: { total: this.vpcNatGateways.length } });
    }
}

export class DigitalOceanRepository {

    dropletMap: Map<string, DropletInfo | null> = new Map();
    vpcs: VpcList | null = null;
    vpcNatGateways: VpcNatGatewayList | null = null;

    constructor(private api: DigitalOceanApi) {

    }

    async getDroplet(name: string): Promise<DropletInfo | null> {
        let droplet = this.dropletMap.get(name);
        if (droplet) {
            return droplet;
        }

        droplet = await this.api.getDroplet(name);
        this.dropletMap.set(name, droplet);
        return droplet;
    }

    async getVpcs(): Promise<VpcList> {
        if (this.vpcs) {
            return this.vpcs;
        }

        this.vpcs = await this.api.getVpcs();
        return this.vpcs;
    }

    async getVpcByName(name: string): Promise<VpcInfo | null> {
        const vpcs = await this.getVpcs();
        return vpcs.vpcs.find(v => v.name === name) || null;
    }

    async getVpcNatGateways(): Promise<VpcNatGatewayList> {
        if (this.vpcNatGateways) {
            return this.vpcNatGateways;
        }
        this.vpcNatGateways = await this.api.getVpcNatGateways();
        return this.vpcNatGateways;
    }

    async getVpcNatGatewayByName(name: string): Promise<VpcNatGatewayInfo | null> {
        const vpcNatGateways = await this.getVpcNatGateways();
        return vpcNatGateways.vpc_nat_gateways.find(g => g.name === name) || null;
    }
}