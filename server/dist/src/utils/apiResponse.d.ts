import { Response } from 'express';
export declare function ok<T>(res: Response, data: T, status?: number): Response<any, Record<string, any>>;
export declare function fail(res: Response, message: string, status?: number): Response<any, Record<string, any>>;
//# sourceMappingURL=apiResponse.d.ts.map