import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The current URL values of a set of slot-owned query params (e.g. the
 * records-toolbar slot's `listParamKeys`), as a stable object keyed by param
 * name — `undefined` for an absent key. Memoized on the serialized values so
 * an unrelated URL change doesn't re-key the list query.
 */
export function useSlotListParams(
    keys: readonly string[]
): Record<string, string | undefined> {
    const [searchParams] = useSearchParams();
    const serialized = keys
        .map((key) => `${key}=${searchParams.get(key) ?? ''}`)
        .join('&');
    return useMemo(() => {
        const params: Record<string, string | undefined> = {};
        for (const key of keys) {
            params[key] = searchParams.get(key) ?? undefined;
        }
        return params;
        // `serialized` captures every read value; `keys` arrive from
        // boot-frozen slot items, so identity churn is the only thing the
        // dep-array indirection avoids.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serialized]);
}
