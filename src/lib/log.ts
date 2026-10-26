/** Logs an error without user values in release builds (error messages can carry amounts). */
export function logError(tag: string, error: unknown): void {
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  console.warn(tag, dev ? error : error instanceof Error ? error.name : 'error');
}
