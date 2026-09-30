export declare class JobLifecycleService {
    /**
     * Check in for a job
     */
    checkInJob(jobId: string, userId: string, latitude?: number, longitude?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessId: string;
        status: string;
        clientId: string;
        reminderSentAt: Date | null;
        notes: string | null;
        address: string | null;
        completedAt: Date | null;
        serviceType: string;
        bookingId: string | null;
        price: number;
        duration: number | null;
        scheduledDate: Date;
        escrowStatus: string;
        scheduledTime: string | null;
        durationMinutes: number | null;
        checkedInAt: Date | null;
        checkedOutAt: Date | null;
        employeeId: string | null;
        checkinLat: number | null;
        checkinLng: number | null;
        checkinDistanceM: number | null;
        locationVerified: boolean;
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
            status: string;
            clientId: string;
            reminderSentAt: Date | null;
            notes: string | null;
            address: string | null;
            completedAt: Date | null;
            serviceType: string;
            bookingId: string | null;
            price: number;
            duration: number | null;
            scheduledDate: Date;
            escrowStatus: string;
            scheduledTime: string | null;
            durationMinutes: number | null;
            checkedInAt: Date | null;
            checkedOutAt: Date | null;
            employeeId: string | null;
            checkinLat: number | null;
            checkinLng: number | null;
            checkinDistanceM: number | null;
            locationVerified: boolean;
        };
        isLate: boolean;
        durationMinutes: number;
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