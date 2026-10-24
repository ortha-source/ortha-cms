import { useCallback, useMemo } from 'react';
import { useContentTypes } from '@orthacms/content-admin';

/**
 * A content type's display label by its name — "Articles" for `article` —
 * from the type catalogue the Content Library already caches.
 *
 * Falls back to the name itself while the catalogue loads or for a type it no
 * longer lists (an alarm can outlive its collection): a raw name is honest,
 * a blank is not.
 */
export function useTypeLabels(enabled = true): (name: string) => string {
    const types = useContentTypes(enabled);
    const labels = useMemo(
        () =>
            new Map((types.data ?? []).map((type) => [type.name, type.label])),
        [types.data]
    );
    return useCallback((name: string) => labels.get(name) ?? name, [labels]);
}
