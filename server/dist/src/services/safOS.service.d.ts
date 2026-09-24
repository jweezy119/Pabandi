export declare class SafLoadService {
    postLoad(data: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        budgetUsd: number;
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
        distanceMiles: number | null;
        acceptedBidId: string | null;
        shipperId: string;
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
        description: string | null;
        title: string;
        budgetUsd: number;
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
        distanceMiles: number | null;
        acceptedBidId: string | null;
        shipperId: string;
    })[]>;
    getLoadDetail(loadId: string): Promise<({
        documents: {
            id: string;
            description: string | null;
            mimeType: string | null;
            fileName: string;
            fileUrl: string;
            fileSize: number | null;
            loadId: string | null;
            carrierId: string | null;
            documentType: string;
            uploadedById: string;
            uploadedAt: Date;
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
            amountUsd: number;
            deliveryDays: number;
            loadId: string;
            carrierId: string;
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
            status: string;
            notes: string | null;
            location: string | null;
            loadId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        budgetUsd: number;
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
        distanceMiles: number | null;
        acceptedBidId: string | null;
        shipperId: string;
    }) | null>;
    updateLoadStatus(loadId: string, status: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        budgetUsd: number;
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
        distanceMiles: number | null;
        acceptedBidId: string | null;
        shipperId: string;
    }>;
    deleteLoad(loadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        budgetUsd: number;
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
        distanceMiles: number | null;
        acceptedBidId: string | null;
        shipperId: string;
    }>;
}
export declare class SafCarrierService {
    registerCarrier(data: any): Promise<{
        id: string;
        companyName: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
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
        companyName: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
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
            carrierId: string;
            availableFrom: Date | null;
            availableTo: Date | null;
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
        companyName: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
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
        companyName: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
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
export declare class SafMatchingService {
    matchLoadToCarrier(loadId: string): Promise<{
        id: string;
        companyName: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
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
        amountUsd: number;
        deliveryDays: number;
        loadId: string;
        carrierId: string;
    }>;
    getMatchingHistory(shipperId: string): Promise<({
        bids: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            notes: string | null;
            currency: string;
            amountUsd: number;
            deliveryDays: number;
            loadId: string;
            carrierId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        title: string;
        budgetUsd: number;
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
        distanceMiles: number | null;
        acceptedBidId: string | null;
        shipperId: string;
    })[]>;
}
export declare class SafRateService {
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
        budgetUsd: number;
        weightLbs: number;
        originCity: string;
        destCity: string;
        distanceMiles: number | null;
    }[]>;
}
export declare const safLoad: SafLoadService;
export declare const safCarrier: SafCarrierService;
export declare const safMatching: SafMatchingService;
export declare const safRate: SafRateService;
//# sourceMappingURL=safOS.service.d.ts.map