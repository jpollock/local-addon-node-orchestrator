/**
 * Error handling utilities for Node.js Orchestrator addon
 * Sanitizes error messages to prevent leaking sensitive information
 */

/**
 * Patterns to remove from error messages
 */
const SENSITIVE_PATTERNS = [
  // Absolute file paths
  /\/Users\/[^/\s]+/g,
  /\/home\/[^/\s]+/g,
  /C:\\Users\\[^\\s]+/g,
  // Environment variables
  /process\.env\.[A-Z_]+/g,
  // Stack traces
  /\s+at\s+.+\(.+:\d+:\d+\)/g,
];

/**
 * Sanitizes an error message to remove sensitive information
 *
 * @param message - The error message to sanitize
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'An unknown error occurred';
  }

  let sanitized = message;

  // Remove sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Remove any remaining absolute paths (simple heuristic)
  sanitized = sanitized.replace(/\/[a-zA-Z0-9/_-]+\/[a-zA-Z0-9/_.-]+/g, '[PATH]');
  sanitized = sanitized.replace(/[A-Z]:\\[a-zA-Z0-9\\/_.-]+/g, '[PATH]');

  return sanitized;
}

/**
 * Extracts a safe error message from an Error object
 *
 * @param error - The error object
 * @returns Safe error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }

  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return sanitizeErrorMessage(String((error as any).message));
  }

  return 'An unknown error occurred';
}

/**
 * Logs an error with full details (for server logs)
 * Returns sanitized message for client
 *
 * @param logger - The logger instance
 * @param context - Context about where the error occurred
 * @param error - The error object
 * @returns Sanitized error message safe for client
 */
export function logAndSanitizeError(
  logger: any,
  context: string,
  error: unknown
): string {
  // Log full error details server-side (for debugging)
  logger.error(context, {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error
  });

  // Return sanitized message for client
  return getErrorMessage(error);
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Standard success response format
 */
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  [key: string]: any;
}

/**
 * Creates a standardized error response
 *
 * @param error - The error to convert
 * @returns Standardized error response
 */
export function createErrorResponse(error: unknown): ErrorResponse {
  return {
    success: false,
    error: getErrorMessage(error)
  };
}

/**
 * Creates a standardized success response
 *
 * @param data - Optional data to include
 * @returns Standardized success response
 */
export function createSuccessResponse<T>(data?: T): SuccessResponse<T> {
  return {
    success: true,
    ...(data !== undefined && { data })
  };
}
