export declare class BuilderService {
    createProfile(userId: string, data: {
        companyName: string;
        licenseNumber?: string;
    }): Promise<{
        id: string;
        companyName: string;
        trustScore: number;
        createdAt: Date;
        userId: string;
        verified: boolean;
        licenseNumber: string | null;
        totalProjects: number;
        totalUnits: number;
        totalSold: number;
    }>;
    getProfile(userId: string): Promise<({
        projects: ({
            _count: {
                units: number;
                milestones: number;
            };
        } & {
            id: string;
            trustScore: number;
            createdAt: Date;
            name: string;
            status: string;
            description: string | null;
            startDate: Date;
            location: string;
            totalUnits: number;
            soldUnits: number;
            bookedUnits: number;
            expectedCompletion: Date;
            actualCompletion: Date | null;
            builderId: string;
        })[];
    } & {
        id: string;
        companyName: string;
        trustScore: number;
        createdAt: Date;
        userId: string;
        verified: boolean;
        licenseNumber: string | null;
        totalProjects: number;
        totalUnits: number;
        totalSold: number;
    }) | null>;
    createProject(builderId: string, data: {
        name: string;
        location: string;
        description?: string;
        totalUnits: number;
        startDate: Date;
        expectedCompletion: Date;
    }): Promise<{
        id: string;
        trustScore: number;
        createdAt: Date;
        name: string;
        status: string;
        description: string | null;
        startDate: Date;
        location: string;
        totalUnits: number;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
        builderId: string;
    }>;
    getProjects(builderId: string): Promise<({
        _count: {
            units: number;
            milestones: number;
        };
    } & {
        id: string;
        trustScore: number;
        createdAt: Date;
        name: string;
        status: string;
        description: string | null;
        startDate: Date;
        location: string;
        totalUnits: number;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
        builderId: string;
    })[]>;
    getProjectDetail(projectId: string): Promise<({
        units: ({
            buyer: ({
                user: {
                    email: string;
                    firstName: string;
                    lastName: string;
                };
            } & {
                phone: string | null;
                id: string;
                createdAt: Date;
                userId: string;
                address: string | null;
                verified: boolean;
                cnic: string | null;
            }) | null;
        } & {
            id: string;
            createdAt: Date;
            type: string;
            status: string;
            price: number;
            unitNumber: string;
            projectId: string;
            size: number;
            buyerId: string | null;
            floor: number | null;
        })[];
        milestones: {
            id: string;
            createdAt: Date;
            status: string;
            description: string | null;
            title: string;
            completedAt: Date | null;
            photos: string[];
            projectId: string;
            dueDate: Date;
        }[];
        builder: {
            user: {
                email: string;
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            companyName: string;
            trustScore: number;
            createdAt: Date;
            userId: string;
            verified: boolean;
            licenseNumber: string | null;
            totalProjects: number;
            totalUnits: number;
            totalSold: number;
        };
    } & {
        id: string;
        trustScore: number;
        createdAt: Date;
        name: string;
        status: string;
        description: string | null;
        startDate: Date;
        location: string;
        totalUnits: number;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
        builderId: string;
    }) | null>;
    addUnit(projectId: string, data: {
        unitNumber: string;
        type: string;
        size: number;
        price: number;
        floor?: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: string;
        status: string;
        price: number;
        unitNumber: string;
        projectId: string;
        size: number;
        buyerId: string | null;
        floor: number | null;
    }>;
    bookUnit(unitId: string, buyerId: string): Promise<{
        id: string;
        createdAt: Date;
        type: string;
        status: string;
        price: number;
        unitNumber: string;
        projectId: string;
        size: number;
        buyerId: string | null;
        floor: number | null;
    }>;
    sellUnit(unitId: string, buyerId: string): Promise<{
        id: string;
        createdAt: Date;
        type: string;
        status: string;
        price: number;
        unitNumber: string;
        projectId: string;
        size: number;
        buyerId: string | null;
        floor: number | null;
    }>;
    addMilestone(projectId: string, data: {
        title: string;
        description?: string;
        dueDate: Date;
    }): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        description: string | null;
        title: string;
        completedAt: Date | null;
        photos: string[];
        projectId: string;
        dueDate: Date;
    }>;
    completeMilestone(milestoneId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        description: string | null;
        title: string;
        completedAt: Date | null;
        photos: string[];
        projectId: string;
        dueDate: Date;
    }>;
    getBuyers(builderId: string): Promise<({
        user: {
            email: string;
            firstName: string;
            lastName: string;
        };
        units: {
            id: string;
            createdAt: Date;
            type: string;
            status: string;
            price: number;
            unitNumber: string;
            projectId: string;
            size: number;
            buyerId: string | null;
            floor: number | null;
        }[];
        installments: {
            method: string | null;
            id: string;
            createdAt: Date;
            status: string;
            txHash: string | null;
            amount: number;
            paidAt: Date | null;
            unitId: string;
            dueDate: Date;
            buyerId: string;
        }[];
    } & {
        phone: string | null;
        id: string;
        createdAt: Date;
        userId: string;
        address: string | null;
        verified: boolean;
        cnic: string | null;
    })[]>;
    getInstallments(builderId: string, status?: string): Promise<({
        unit: {
            project: {
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            type: string;
            status: string;
            price: number;
            unitNumber: string;
            projectId: string;
            size: number;
            buyerId: string | null;
            floor: number | null;
        };
        buyer: {
            user: {
                email: string;
                firstName: string;
                lastName: string;
            };
        } & {
            phone: string | null;
            id: string;
            createdAt: Date;
            userId: string;
            address: string | null;
            verified: boolean;
            cnic: string | null;
        };
    } & {
        method: string | null;
        id: string;
        createdAt: Date;
        status: string;
        txHash: string | null;
        amount: number;
        paidAt: Date | null;
        unitId: string;
        dueDate: Date;
        buyerId: string;
    })[]>;
    sendReminder(installmentId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getTrustScore(builderId: string): Promise<{
        score: number;
        verified: boolean;
        totalProjects: number;
        totalUnits: number;
        soldUnits: number;
        completedMilestones: number;
        totalMilestones: number;
    }>;
    searchProjects(filters: {
        location?: string;
        priceMin?: number;
        priceMax?: number;
        type?: string;
    }): Promise<({
        _count: {
            units: number;
        };
        units: {
            id: string;
            createdAt: Date;
            type: string;
            status: string;
            price: number;
            unitNumber: string;
            projectId: string;
            size: number;
            buyerId: string | null;
            floor: number | null;
        }[];
        builder: {
            user: {
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            companyName: string;
            trustScore: number;
            createdAt: Date;
            userId: string;
            verified: boolean;
            licenseNumber: string | null;
            totalProjects: number;
            totalUnits: number;
            totalSold: number;
        };
    } & {
        id: string;
        trustScore: number;
        createdAt: Date;
        name: string;
        status: string;
        description: string | null;
        startDate: Date;
        location: string;
        totalUnits: number;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
        builderId: string;
    })[]>;
}
export declare const builderService: BuilderService;
//# sourceMappingURL=builder.service.d.ts.map