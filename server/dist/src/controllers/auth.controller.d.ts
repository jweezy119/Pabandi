import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
interface RegisterBody {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: string;
    businessName?: string;
    googlePlaceId?: string;
    fiverrUrl?: string;
    upworkUrl?: string;
    refCode?: string;
}
interface LoginBody {
    email: string;
    password: string;
}
export declare const register: (req: Request<{}, {}, RegisterBody>, res: Response, next: NextFunction) => Promise<void>;
export declare const login: (req: Request<{}, {}, LoginBody>, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const refreshToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const verifyEmail: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const verifyPhone: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const forgotPassword: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const resetPassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updatePassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getTrustAttestation: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getNonce: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const verifyWallet: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requestProfileChange: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getProfileChangeStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=auth.controller.d.ts.map