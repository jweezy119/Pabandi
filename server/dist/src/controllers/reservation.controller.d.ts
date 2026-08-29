import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const createReservation: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getReservation: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateReservation: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const cancelReservation: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getUserReservations: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const completeReservation: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const markNoShow: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Submit freelance deliverables (Marks milestone as pending approval)
 */
export declare const submitFreelanceWork: (req: any, res: Response) => Promise<void>;
/**
 * Request AI Arbitration for a freelance job
 */
export declare const arbitrateFreelanceWork: (req: any, res: Response) => Promise<void>;
//# sourceMappingURL=reservation.controller.d.ts.map