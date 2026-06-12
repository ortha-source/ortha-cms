import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { ContentType } from '../../types/wizard';

/**
 * The admin client for the content-type catalogue (`GET /api/content-types`,
 * served by the identity plugin's mock registry for now). The wizard's content
 * step splits the result into collections and pages.
 */
export async function listContentTypes(): Promise<ContentType[]> {
    try {
        const { data } = await apiClient.get<ContentType[]>('/content-types');
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}
