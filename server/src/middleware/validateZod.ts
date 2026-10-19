import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

/**
 * Zod-backed request validation.
 *
 * ─── WHY THIS EXISTS ALONGSIDE validateRequest.ts ───────────────────────────
 * `validateRequest.ts` is wired to express-validator and reads its rules off
 * the route via a side channel (`validationResult(req)`). That works, but it
 * means the shape of a request is described somewhere other than the handler,
 * so the two can drift, and it only describes requests that were remembered to
 * be described at all.
 *
 * A Zod schema is a value. It is passed to the route, it is the single source
 * of truth, and it can be exported and unit-tested on its own. That matters
 * more than usual here because the routes this is applied to are the ones AI
 * agents call. A human filling in a form will eventually send a valid request;
 * an agent guessing at an endpoint will send `{"amount": "-5"}`, `{}`, a
 * stringified object, or 200KB of junk, and it will do so at a rate no manual
 * testing will reproduce. Those routes need validation that is part of the
 * route's definition rather than an optional extra someone remembered.
 *
 * ─── WHY THE 400 SHAPE IS WHAT IT IS ────────────────────────────────────────
 * The response is deliberately explicit about every failing field rather than
 * stopping at the first one. An agent that sends one malformed field should be
 * able to fix it from the 400 alone instead of discovering the next problem on
 * the retry. `errors` maps field path -> first message for that path, matching
 * the shape `validateRequest.ts` already returns, so existing clients that
 * read `body.errors[field]` keep working against both.
 */

export interface ZodValidationDetail {
  field: string;
  message: string;
  code: string;
}

export interface ZodValidationErrorBody {
  success: false;
  error: 'VALIDATION_ERROR';
  message: string;
  errors: Record<string, string>;
  details: ZodValidationDetail[];
}

type Source = 'body' | 'query' | 'params';

/**
 * Path segments inside arrays and objects are joined with `.` rather than the
 * bracket syntax Zod emits (`capabilities.0`), because bracket paths are
 * awkward for an agent to act on and do not survive a round trip through JSON
 * in a predictable place.
 */
function normalisePath(path: Array<string | number>): string {
  return path
    .map((segment) => String(segment))
    .join('.')
    .replace(/\.\./g, '.');
}

/**
 * Collapse a ZodError into one message per field. Zod reports every issue it
 * found, including several for the same field, so the same key can appear more
 * than once; the first is kept, matching validateRequest.ts.
 */
export function formatZodError(error: ZodError): ZodValidationErrorBody {
  const errors: Record<string, string> = {};
  const details: ZodValidationDetail[] = [];

  for (const issue of error.issues) {
    const field = normalisePath(issue.path);
    const key = field.length > 0 ? field : 'general';
    if (errors[key] === undefined) {
      errors[key] = issue.message;
    }
    details.push({ field: key, message: issue.message, code: issue.code });
  }

  const first = details.length > 0 ? details[0] : undefined;

  return {
    success: false,
    error: 'VALIDATION_ERROR',
    message: first ? first.message : 'Request validation failed',
    errors,
    details,
  };
}

/**
 * Build an Express middleware that parses and replaces the chosen request
 * source with the schema's output.
 *
 * The replacement matters and is easy to miss: `express.json()` produces a
 * fresh object on every access, so writing `req.body = parsed.data` is what
 * makes the handler actually see coerced values. Without it a handler reading
 * `req.body.amount` would get the raw string `"5"` and arithmetic on it would
 * quietly concatenate rather than add.
 *
 * `z.object({...}).strip()` (the default) removes unknown keys, so handlers
 * cannot be reached with fields the schema did not sanction.
 */
export function validateWithZod(schema: ZodTypeAny, source: Source = 'body') {
  return function zodValidationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      res.status(400).json(formatZodError(result.error));
      return;
    }

    if (source === 'body') {
      req.body = result.data;
    } else {
      // `req.query` and `req.params` have read-only getters on Express 5 and
      // are shared objects in Express 4. Overwriting the property itself is
      // unreliable on both, so the parsed value is stashed and read from
      // there instead.
      const slot = source === 'query' ? 'validatedQuery' : 'validatedParams';
      (req as unknown as Record<string, unknown>)[slot] = result.data;
    }

    next();
  };
}

/**
 * Read back what `validateWithZod` parsed for a non-body source. Returns the
 * parsed value when validation ran and the raw source otherwise, so a route
 * can adopt this without a flag day.
 */
export function validated<T>(req: Request, source: Exclude<Source, 'body'> = 'query'): T {
  const slot = source === 'query' ? 'validatedQuery' : 'validatedParams';
  const stored = (req as unknown as Record<string, unknown>)[slot];
  return (stored === undefined ? req[source] : stored) as T;
}

/** Shorthand for the common case: validate `req.body` against `schema`. */
export function validateBody(schema: ZodTypeAny) {
  return validateWithZod(schema, 'body');
}