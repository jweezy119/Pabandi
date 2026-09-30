export declare class FreightLoadService {
    postLoad(data: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        title: string;
        description: string | null;
        distanceMiles: number | null;
        budgetUsd: number;
        shipperId: string;
        cargoType: string;
        weightLbs: number;
        dimensions: string | null;
        valueUsd: number;
        originAddress: string;
        originCity: string;
        originState: string;
        originZip: string;
        originLat: number | null;
        originLng: number | null;
        destAddress: string;
        destCity: string;
        destState: string;
        destZip: string;
        destLat: number | null;
        destLng: number | null;
        pickupDate: Date;
        deliveryDate: Date;
        acceptedBidId: string | null;
    }>;
    getLoads(filters?: {
        status?: string;
        shipperId?: string;
        originCity?: string;
        destCity?: string;
        cargoType?: string;
    }): Promise<({
        _count: {
            bids: number;
        };
        shipper: {
            id: string;
            firstName: string;
            lastName: string;
            companyName: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        title: string;
        description: string | null;
        distanceMiles: number | null;
        budgetUsd: number;
        shipperId: string;
        cargoType: string;
        weightLbs: number;
        dimensions: string | null;
        valueUsd: number;
        originAddress: string;
        originCity: string;
        originState: string;
        originZip: string;
        originLat: number | null;
        originLng: number | null;
        destAddress: string;
        destCity: string;
        destState: string;
        destZip: string;
        destLat: number | null;
        destLng: number | null;
        pickupDate: Date;
        deliveryDate: Date;
        acceptedBidId: string | null;
    })[]>;
    getLoadDetail(loadId: string): Promise<({
        documents: {
            id: string;
            description: string | null;
            documentType: string;
            fileName: string;
            fileUrl: string;
            fileSize: number | null;
            uploadedAt: Date;
            mimeType: string | null;
            loadId: string | null;
            carrierId: string | null;
            uploadedById: string;
        }[];
        bids: ({
            carrier: {
                id: string;
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            notes: string | null;
            currency: string;
            loadId: string;
            carrierId: string;
            amountUsd: number;
            deliveryDays: number;
        })[];
        shipper: {
            email: string;
            phone: string | null;
            id: string;
            firstName: string;
            lastName: string;
        };
        tracking: {
            id: string;
            createdAt: Date;
            location: string | null;
            status: string;
            notes: string | null;
            loadId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        title: string;
        description: string | null;
        distanceMiles: number | null;
        budgetUsd: number;
        shipperId: string;
        cargoType: string;
        weightLbs: number;
        dimensions: string | null;
        valueUsd: number;
        originAddress: string;
        originCity: string;
        originState: string;
        originZip: string;
        originLat: number | null;
        originLng: number | null;
        destAddress: string;
        destCity: string;
        destState: string;
        destZip: string;
        destLat: number | null;
        destLng: number | null;
        pickupDate: Date;
        deliveryDate: Date;
        acceptedBidId: string | null;
    }) | null>;
    updateLoadStatus(loadId: string, status: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        title: string;
        description: string | null;
        distanceMiles: number | null;
        budgetUsd: number;
        shipperId: string;
        cargoType: string;
        weightLbs: number;
        dimensions: string | null;
        valueUsd: number;
        originAddress: string;
        originCity: string;
        originState: string;
        originZip: string;
        originLat: number | null;
        originLng: number | null;
        destAddress: string;
        destCity: string;
        destState: string;
        destZip: string;
        destLat: number | null;
        destLng: number | null;
        pickupDate: Date;
        deliveryDate: Date;
        acceptedBidId: string | null;
    }>;
    deleteLoad(loadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        title: string;
        description: string | null;
        distanceMiles: number | null;
        budgetUsd: number;
        shipperId: string;
        cargoType: string;
        weightLbs: number;
        dimensions: string | null;
        valueUsd: number;
        originAddress: string;
        originCity: string;
        originState: string;
        originZip: string;
        originLat: number | null;
        originLng: number | null;
        destAddress: string;
        destCity: string;
        destState: string;
        destZip: string;
        destLat: number | null;
        destLng: number | null;
        pickupDate: Date;
        deliveryDate: Date;
        acceptedBidId: string | null;
    }>;
}
export declare class FreightCarrierService {
    registerCarrier(data: any): Promise<{
        id: string;
        userId: string;
        createdAt: Date;
        companyName: string;
        updatedAt: Date;
        rating: number;
        verified: boolean;
        dotNumber: string | null;
        mcNumber: string | null;
        fleetSize: number;
        equipmentType: string[];
        operatingStates: string[];
        maxLoadLbs: number;
        totalDeliveries: number;
        onTimeRate: number;
        insuranceVerified: boolean;
    }>;
    getCarriers(filters?: {
        verified?: boolean;
        state?: string;
    }): Promise<({
        user: {
            email: string;
            firstName: string;
            lastName: string;
        };
        _count: {
            scorecards: number;
        };
    } & {
        id: string;
        userId: string;
        createdAt: Date;
        companyName: string;
        updatedAt: Date;
        rating: number;
        verified: boolean;
        dotNumber: string | null;
        mcNumber: string | null;
        fleetSize: number;
        equipmentType: string[];
        operatingStates: string[];
        maxLoadLbs: number;
        totalDeliveries: number;
        onTimeRate: number;
        insuranceVerified: boolean;
    })[]>;
    getCarrierDetail(carrierId: string): Promise<({
        user: {
            email: string;
            phone: string | null;
            firstName: string;
            lastName: string;
        };
        availability: {
            id: string;
            updatedAt: Date;
            preferredRegions: string[];
            availableFrom: Date | null;
            availableTo: Date | null;
            carrierId: string;
            isAvailable: boolean;
            maxDistance: number | null;
            lastLocation: string | null;
            lastLocationAt: Date | null;
        } | null;
        scorecards: {
            communication: number | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            shipperId: string;
            loadId: string;
            carrierId: string;
            onTimeDelivery: number | null;
            cargoCondition: number | null;
            professionalism: number | null;
            overallRating: number;
        }[];
    } & {
        id: string;
        userId: string;
        createdAt: Date;
        companyName: string;
        updatedAt: Date;
        rating: number;
        verified: boolean;
        dotNumber: string | null;
        mcNumber: string | null;
        fleetSize: number;
        equipmentType: string[];
        operatingStates: string[];
        maxLoadLbs: number;
        totalDeliveries: number;
        onTimeRate: number;
        insuranceVerified: boolean;
    }) | null>;
    rateCarrier(carrierId: string, rating: number, review?: string): Promise<{
        id: string;
        userId: string;
        createdAt: Date;
        companyName: string;
        updatedAt: Date;
        rating: number;
        verified: boolean;
        dotNumber: string | null;
        mcNumber: string | null;
        fleetSize: number;
        equipmentType: string[];
        operatingStates: string[];
        maxLoadLbs: number;
        totalDeliveries: number;
        onTimeRate: number;
        insuranceVerified: boolean;
    }>;
}
export declare class FreightMatchingService {
    matchLoadToCarrier(loadId: string): Promise<{
        id: string;
        userId: string;
        createdAt: Date;
        companyName: string;
        updatedAt: Date;
        rating: number;
        verified: boolean;
        dotNumber: string | null;
        mcNumber: string | null;
        fleetSize: number;
        equipmentType: string[];
        operatingStates: string[];
        maxLoadLbs: number;
        totalDeliveries: number;
        onTimeRate: number;
        insuranceVerified: boolean;
    }[]>;
    acceptLoad(carrierId: string, loadId: string, amountUsd: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        notes: string | null;
        currency: string;
        loadId: string;
        carrierId: string;
        amountUsd: number;
        deliveryDays: number;
    }>;
    getMatchingHistory(shipperId: string): Promise<({
        bids: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            notes: string | null;
            currency: string;
            loadId: string;
            carrierId: string;
            amountUsd: number;
            deliveryDays: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        title: string;
        description: string | null;
        distanceMiles: number | null;
        budgetUsd: number;
        shipperId: string;
        cargoType: string;
        weightLbs: number;
        dimensions: string | null;
        valueUsd: number;
        originAddress: string;
        originCity: string;
        originState: string;
        originZip: string;
        originLat: number | null;
        originLng: number | null;
        destAddress: string;
        destCity: string;
        destState: string;
        destZip: string;
        destLat: number | null;
        destLng: number | null;
        pickupDate: Date;
        deliveryDate: Date;
        acceptedBidId: string | null;
    })[]>;
}
export declare class FreightRateService {
    calculateRate(distance: number, weight: number, cargoType: string): Promise<{
        distance: number;
        weight: number;
        cargoType: string;
        baseRate: number;
        multiplier: number;
        total: number;
        currency: string;
    }>;
    getRateHistory(shipperId: string): Promise<{
        id: string;
        createdAt: Date;
        distanceMiles: number | null;
        budgetUsd: number;
        weightLbs: number;
        originCity: string;
        destCity: string;
    }[]>;
}
export declare const freightLoad: FreightLoadService;
export declare const freightCarrier: FreightCarrierService;
export declare const freightMatching: FreightMatchingService;
export declare const freightRate: FreightRateService;
//# sourceMappingURL=freight.service.d.ts.map