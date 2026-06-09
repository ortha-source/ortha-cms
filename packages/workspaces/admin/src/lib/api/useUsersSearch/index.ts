import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { DirectoryUser } from '../../types/wizard';
import { searchUsers } from '../usersClient';

/** Result of {@link useUsersSearch}. */
export type UsersSearchResult = {
    /** Matching directory users (empty until a debounced query resolves). */
    users: DirectoryUser[];
    /** Whether a search is currently in flight. */
    loading: boolean;
};

/**
 * Searches the user directory for the member typeahead. Debounces the query
 * (250ms) so each keystroke doesn't fire a request, and only runs once at least
 * one character has been typed.
 *
 * TODO(users-server): back this with `GET /api/users?q=` (see {@link searchUsers}).
 */
export function useUsersSearch(query: string): UsersSearchResult {
    const debounced = useDebouncedValue(query.trim(), 250);
    const enabled = debounced.length > 0;

    const result = useQuery({
        queryKey: ['users', 'search', debounced],
        queryFn: () => searchUsers(debounced),
        enabled,
        staleTime: 30_000
    });

    return {
        users: enabled ? (result.data ?? []) : [],
        loading: enabled && (result.isPending || debounced !== query.trim())
    };
}
