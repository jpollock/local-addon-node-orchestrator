/**
 * Timeout utilities for wrapping async operations
 */

// Re-export TIMEOUTS from constants for backward compatibility
export { TIMEOUTS } from '../constants';

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutError - Error message or Error to throw on timeout
 * @returns Promise that rejects with timeout error if not resolved in time
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string | Error = 'Operation timed out'
): Promise<T> {
  const error = typeof timeoutError === 'string' ? new Error(timeoutError) : timeoutError;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(error), timeoutMs)
    )
  ]);
}
