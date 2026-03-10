import type { Request } from 'express';

// Single-user mode — no JWT or session auth needed.
// All API routes are open since this is a local single-user tool.

export interface AuthenticatedRequest extends Request {
  // kept for type compatibility with existing route handlers
}

// Fixed UUID for the single system user — used in userId DB columns
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
