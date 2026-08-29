import { Request, Response } from 'express';
/**
 * Get details for a specific job posting (Public Route)
 * Used by the ATS landing page
 */
export declare const getJobDetails: (req: Request, res: Response) => Promise<any>;
/**
 * Apply for a job (Authenticated Route)
 * Users are redirected here after being forced to create an account
 */
export declare const applyForJob: (req: Request, res: Response) => Promise<any>;
//# sourceMappingURL=jobs.controller.d.ts.map