import { useQuery } from '@tanstack/react-query';
import {
    apiClient,
    toApiError,
    useDebouncedValue
} from '@ortha-cms/utils-admin';
import { SlugStatus } from '../../types/wizard';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Whether `slug` is free, via `GET /api/workspaces/slug-available`. */
async function checkSlugAvailable(slug: string): Promise<boolean> {
    try {
        const { data } = await apiClient.get<{ available: boolean }>(
            '/workspaces/slug-available',
            { params: { slug } }
        );
        return data.available;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Live slug-availability check. Debounces input (300ms), then resolves to
 * {@link SlugStatus.Available} / {@link SlugStatus.Taken}. Returns
 * {@link SlugStatus.Empty} for blank input, {@link SlugStatus.Invalid} when the
 * value breaks the `^[a-z0-9-]+$` pattern, and {@link SlugStatus.Checking} while
 * debouncing or fetching.
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

    if (!slug) return SlugStatus.Empty;
    if (!SLUG_PATTERN.test(slug)) return SlugStatus.Invalid;
    if (slug !== debounced || query.isFetching) return SlugStatus.Checking;
    return query.data === false ? SlugStatus.Taken : SlugStatus.Available;
}
