import { Request, Response, NextFunction } from 'express';
import { CustomError } from './errorHandler';

const fileType = require('file-type');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'application/pdf'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

interface SecureFile extends Express.Multer.File {
  secureName?: string;
  originalName?: string;
}

export const uploadSecurity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
    
    for (const file of files) {
      if (!file.buffer && file.path) {
        const fs = await import('fs');
        file.buffer = await new Promise((resolve, reject) => {
          fs.readFile(file.path, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      }

      if (!file.buffer) {
        throw new CustomError('File buffer missing', 400);
      }

      if (file.buffer.length > MAX_FILE_SIZE) {
        throw new CustomError('File exceeds 10MB limit', 413);
      }

      const typeResult = await fileType.fileTypeFromBuffer(file.buffer);
      
      if (!typeResult || !ALLOWED_MIME_TYPES.includes(typeResult.mime)) {
        throw new CustomError(
          `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`, 
          400
        );
      }

      const ext = `.${typeResult.ext}`;
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new CustomError(
          `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
          400
        );
      }

      const crypto = await import('crypto');
      const extMap: Record<string, string> = {
        'jpeg': '.jpg',
        'png': '.png',
        'webp': '.webp',
        'pdf': '.pdf'
      };
      const secureExt = extMap[typeResult.ext] || `.${typeResult.ext}`;
      const secureFile = file as SecureFile;
      secureFile.originalName = file.originalname;
      secureFile.secureName = `${crypto.randomUUID()}${extMap[typeResult.ext] || `.${typeResult.ext}`}`;
    }

    next();
  } catch (err: any) {
    next(err instanceof CustomError ? err : new CustomError(err.message, 500));
  }
};