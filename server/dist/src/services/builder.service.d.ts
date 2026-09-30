export declare class BuilderService {
    createProfile(userId: string, data: {
        companyName: string;
        licenseNumber?: string;
    }): Promise<{
        id: string;
        userId: string;
        createdAt: Date;
        companyName: string;
        trustScore: number;
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
            createdAt: Date;
            name: string;
            trustScore: number;
            location: string;
            status: string;
            description: string | null;
            startDate: Date;
            totalUnits: number;
            builderId: string;
            soldUnits: number;
            bookedUnits: number;
            expectedCompletion: Date;
            actualCompletion: Date | null;
        })[];
    } & {
        id: string;
        userId: string;
        createdAt: Date;
        companyName: string;
        trustScore: number;
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
        createdAt: Date;
        name: string;
        trustScore: number;
        location: string;
        status: string;
        description: string | null;
        startDate: Date;
        totalUnits: number;
        builderId: string;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
    }>;
    getProjects(builderId: string): Promise<({
        _count: {
            units: number;
            milestones: number;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        trustScore: number;
        location: string;
        status: string;
        description: string | null;
        startDate: Date;
        totalUnits: number;
        builderId: string;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
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
                userId: string;
                createdAt: Date;
                address: string | null;
                verified: boolean;
                cnic: string | null;
            }) | null;
        } & {
            id: string;
            createdAt: Date;
            status: string;
            type: string;
            price: number;
            unitNumber: string;
            projectId: string;
            buyerId: string | null;
            size: number;
            floor: number | null;
        })[];
        milestones: {
            id: string;
            createdAt: Date;
            status: string;
            title: string;
            description: string | null;
            dueDate: Date;
            completedAt: Date | null;
            projectId: string;
            photos: string[];
        }[];
        builder: {
            user: {
                email: string;
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            companyName: string;
            trustScore: number;
            verified: boolean;
            licenseNumber: string | null;
            totalProjects: number;
            totalUnits: number;
            totalSold: number;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        trustScore: number;
        location: string;
        status: string;
        description: string | null;
        startDate: Date;
        totalUnits: number;
        builderId: string;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
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
        status: string;
        type: string;
        price: number;
        unitNumber: string;
        projectId: string;
        buyerId: string | null;
        size: number;
        floor: number | null;
    }>;
    bookUnit(unitId: string, buyerId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        type: string;
        price: number;
        unitNumber: string;
        projectId: string;
        buyerId: string | null;
        size: number;
        floor: number | null;
    }>;
    sellUnit(unitId: string, buyerId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        type: string;
        price: number;
        unitNumber: string;
        projectId: string;
        buyerId: string | null;
        size: number;
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
        title: string;
        description: string | null;
        dueDate: Date;
        completedAt: Date | null;
        projectId: string;
        photos: string[];
    }>;
    completeMilestone(milestoneId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        title: string;
        description: string | null;
        dueDate: Date;
        completedAt: Date | null;
        projectId: string;
        photos: string[];
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
            status: string;
            type: string;
            price: number;
            unitNumber: string;
            projectId: string;
            buyerId: string | null;
            size: number;
            floor: number | null;
        }[];
        installments: {
            id: string;
            createdAt: Date;
            status: string;
            method: string | null;
            txHash: string | null;
            amount: number;
            dueDate: Date;
            unitId: string;
            paidAt: Date | null;
            buyerId: string;
        }[];
    } & {
        phone: string | null;
        id: string;
        userId: string;
        createdAt: Date;
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
            status: string;
            type: string;
            price: number;
            unitNumber: string;
            projectId: string;
            buyerId: string | null;
            size: number;
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
            userId: string;
            createdAt: Date;
            address: string | null;
            verified: boolean;
            cnic: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        status: string;
        method: string | null;
        txHash: string | null;
        amount: number;
        dueDate: Date;
        unitId: string;
        paidAt: Date | null;
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
            status: string;
            type: string;
            price: number;
            unitNumber: string;
            projectId: string;
            buyerId: string | null;
            size: number;
            floor: number | null;
        }[];
        builder: {
            user: {
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            companyName: string;
            trustScore: number;
            verified: boolean;
            licenseNumber: string | null;
            totalProjects: number;
            totalUnits: number;
            totalSold: number;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        trustScore: number;
        location: string;
        status: string;
        description: string | null;
        startDate: Date;
        totalUnits: number;
        builderId: string;
        soldUnits: number;
        bookedUnits: number;
        expectedCompletion: Date;
        actualCompletion: Date | null;
    })[]>;
}
export declare const builderService: BuilderService;
//# sourceMappingURL=builder.service.d.ts.map