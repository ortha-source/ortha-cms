import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delayMs`, re-settling only after input stops
 * changing for that long. Used to throttle slug-availability checks and
 * directory searches so each keystroke doesn't fire a request.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);

    return debounced;
}
