const warned = new Set<string>();

/**
 * Logs `message` once per process for `key`. Config is built once, but the
 * spec suites build it hundreds of times, and a boot log that repeats a
 * deprecation for every reader is one people learn to skip.
 */
export function warnOnce(key: string, message: string): void {
    if (warned.has(key)) {
        return;
    }
    warned.add(key);
    console.warn(message);
}
