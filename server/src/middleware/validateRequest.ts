import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fieldErrors: Record<string, string> = {};
    errors.array().forEach((e: any) => {
      const field = e.path || e.param || 'general';
      if (!fieldErrors[field]) fieldErrors[field] = humanizeError(field, e.msg);
    });

    return res.status(400).json({
      success: false,
      message: Object.values(fieldErrors)[0], // first human-readable message
      errors: fieldErrors,
    });
  }
  next();
};

function humanizeError(field: string, msg: string): string {
  const map: Record<string, string> = {
    email: 'Please enter a valid email address.',
    password: 'Password must be at least 8 characters long.',
    firstName: 'First name is required.',
    lastName: 'Last name is required.',
    phone: 'Please enter a valid phone number (e.g. +1 312 489 6967).',
  };
  return map[field] || msg;
}
