export declare class JobLifecycleService {
    /**
     * Check in for a job
     */
    checkInJob(jobId: string, userId: string, latitude?: number, longitude?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessId: string;
        clientId: string;
        status: string;
        notes: string | null;
        address: string | null;
        price: number;
        duration: number | null;
        serviceType: string;
        scheduledDate: Date;
        scheduledTime: string | null;
        completedAt: Date | null;
        employeeId: string | null;
    }>;
    /**
     * Check out from a job
     */
    checkOutJob(jobId: string, userId: string): Promise<{
        updatedJob: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            businessId: string;
            clientId: string;
            status: string;
            notes: string | null;
            address: string | null;
            price: number;
            duration: number | null;
            serviceType: string;
            scheduledDate: Date;
            scheduledTime: string | null;
            completedAt: Date | null;
            employeeId: string | null;
        };
        isLate: boolean;
        actualDurationMinutes: number;
    }>;
    /**
     * Handle no-show detection (called by cron job)
     */
    handleNoShow(jobId: string): Promise<void>;
    /**
     * Process recurring jobs - called by cron job or when creating a recurring job
     */
    processRecurringJobSeries(parentJobId: string): Promise<void>;
}
export declare const jobLifecycleService: JobLifecycleService;
//# sourceMappingURL=jobLifecycle.service.d.ts.map