import { useQuery } from '@tanstack/react-query';
import {
    apiClient,
    toApiError,
    useDebouncedValue
} from '@ortha-cms/utils-admin';
import type { DirectoryUser } from '../../types/wizard';

/** Result of {@link useUsersSearch}. */
export type UsersSearchResult = {
    /** Matching directory users (empty until a debounced query resolves). */
    users: DirectoryUser[];
    /** Whether a search is currently in flight. */
    loading: boolean;
};

/** A page of members from `GET /api/users` — only the fields the typeahead needs. */
type MembersPage = {
    items: {
        id: string;
        name: string | null;
        email: string;
        status: 'pending' | 'active' | 'disabled';
    }[];
};

/** How many matches the typeahead asks for per query. */
const TYPEAHEAD_PAGE_SIZE = 10;

/**
 * Searches the user directory via the shared `GET /api/users` (users plugin):
 * a `?search=` filter returning a paginated envelope. Includes `active` **and**
 * `pending` accounts — an invited member who hasn't accepted yet can still be
 * added to a workspace — but drops `disabled` accounts (not assignable). Maps
 * each member to the lightweight {@link DirectoryUser} the typeahead renders.
 */
async function searchUsers(query: string): Promise<DirectoryUser[]> {
    try {
        const { data } = await apiClient.get<MembersPage>('/users', {
            params: {
                search: query,
                pageSize: TYPEAHEAD_PAGE_SIZE
            }
        });
        return data.items
            .filter((member) => member.status !== 'disabled')
            .map((member) => ({
                id: member.id,
                name: member.name ?? member.email,
                email: member.email
            }));
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Searches the user directory for the member typeahead. Debounces the query
 * (250ms) so each keystroke doesn't fire a request, and only runs once at least
 * one character has been typed.
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
