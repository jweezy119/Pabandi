import { Request, Response, NextFunction } from 'express';
/**
 * Get public profile for a user
 * Hides sensitive information like exact email, phone, and password hash.
 */
export declare const getPublicUserProfile: (req: Request, res: Response, next: NextFunction) => Promise<any>;
/**
 * Search users by name
 * Hides sensitive information.
 */
export declare const searchUsers: (req: Request, res: Response, next: NextFunction) => Promise<any>;
//# sourceMappingURL=user.controller.d.ts.map