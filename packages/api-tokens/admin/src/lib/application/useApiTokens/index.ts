import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { httpApiTokenGateway } from '../../infrastructure/httpApiTokenGateway';
import {
    apiTokensKeys,
    type ApiTokensListParams
} from '../../infrastructure/apiTokensKeys';

/**
 * Page size the server applies when none is requested. Mirrors the server's
 * `API_TOKENS_DEFAULT_PAGE_SIZE`; used only as a fallback for the page-count
 * math before the first response lands.
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Fetches one page of API tokens via the gateway. `keepPreviousData` holds the
 * current rows while a new page resolves. Disabled until the caller confirms
 * `tokens:read` (the server would refuse otherwise).
 */
export function useApiTokens(params: ApiTokensListParams, enabled = true) {
    return useQuery({
        queryKey: apiTokensKeys.list(params),
        queryFn: () => httpApiTokenGateway.list(params),
        placeholderData: keepPreviousData,
        enabled
    });
}
