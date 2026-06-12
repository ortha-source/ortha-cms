import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delayMs`, re-settling only after input stops
 * changing for that long. Used to throttle requests (slug-availability checks,
 * directory searches) so each keystroke doesn't fire one.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);

    return debounced;
}
