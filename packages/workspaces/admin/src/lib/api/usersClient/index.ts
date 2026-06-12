import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { DirectoryUser } from '../../types/wizard';

/**
 * The admin client for the user directory (`GET /api/users?q=`, served by the
 * identity plugin). Backs the workspace wizard's member typeahead; the server
 * returns active users matching the query by name or email.
 */
export async function searchUsers(query: string): Promise<DirectoryUser[]> {
    try {
        const { data } = await apiClient.get<DirectoryUser[]>('/users', {
            params: { q: query }
        });
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}
