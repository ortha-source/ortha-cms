import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { SlugStatus } from '../../types/wizard';
import { checkSlugAvailable } from '../workspacesClient';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Live slug-availability check. Debounces input (300ms), then resolves to
 * `available` / `taken`. Returns `empty` for blank input and `invalid` when the
 * value breaks the `^[a-z0-9-]+$` pattern, and reports `checking` while
 * debouncing or fetching.
 *
 * TODO(workspaces-server): back this with `GET /api/workspaces/slug-available`
 * (see {@link checkSlugAvailable}).
 */
export function useSlugAvailability(slug: string): SlugStatus {
    const debounced = useDebouncedValue(slug, 300);
    const enabled = !!debounced && SLUG_PATTERN.test(debounced);

    const query = useQuery({
        queryKey: ['workspaces', 'slug-available', debounced],
        queryFn: () => checkSlugAvailable(debounced),
        enabled,
        staleTime: 30_000
    });

    if (!slug) return 'empty';
    if (!SLUG_PATTERN.test(slug)) return 'invalid';
    if (slug !== debounced || query.isFetching) return 'checking';
    return query.data === false ? 'taken' : 'available';
}
