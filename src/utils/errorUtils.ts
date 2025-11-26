/**
 * Error utility functions for safe error handling
 */

/**
 * Safely extract error message from an unknown error
 * @param error - Unknown error value
 * @param defaultMessage - Default message if error is not an Error instance
 * @returns Error message string
 */
export function getErrorMessage(error: unknown, defaultMessage = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return defaultMessage;
}

/**
 * Safely extract error stack from an unknown error
 * @param error - Unknown error value
 * @returns Error stack string or undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Check if error is an Error instance
 * @param error - Unknown error value
 * @returns True if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}
