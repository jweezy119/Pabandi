import { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data } as { success: true; data: T });
}

export function fail(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, message } as { success: false; message: string });
}
