import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare function enrollBusinessHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function addEmployeeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getEmployeesHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function addClientHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getClientsHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function createJobHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function assignEmployeeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function updateJobStatusHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getJobsHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function recordPayrollHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getPayrollHistoryHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function recordExpenseHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getExpensesHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getDashboardStatsHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=crm.controller.d.ts.map