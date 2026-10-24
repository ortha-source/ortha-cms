import { apiClient, toApiError } from '@orthacms/utils-admin';
import type { ActivityList } from '../../types/activityEvent';
import type { ActivityExport } from '../../types/activityExport';
import type { DeadLetterList, RetriedDeadLetter } from '../../types/deadLetter';
import { toActivityEvent, type ActivityEventResponse } from '../activityMapper';
import {
    toDeadLetter,
    toRetriedDeadLetter,
    type DeadLetterListResponse,
    type RetriedDeadLetterResponse
} from '../deadLetterMapper';
import type { ActivityListParams } from '../activityKeys';
import type { ActivityExportParams, ActivityGateway } from '../activityGateway';

/** The few fields of `GET /api/workspaces` the feed needs. */
type WorkspaceNameResponse = { id: string; name: string };

/** Fallback file name when the server's `Content-Disposition` names none. */
const DEFAULT_EXPORT_NAME = 'activity.csv';

/**
 * The file name out of a `Content-Disposition` header, or the default. Only
 * the plain `filename="…"` form the export route writes is read.
 */
export function exportFileName(disposition: unknown): string {
    if (typeof disposition !== 'string') return DEFAULT_EXPORT_NAME;
    const match = /filename="([^"]+)"/.exec(disposition);
    return match?.[1] ?? DEFAULT_EXPORT_NAME;
}

/** The paginated envelope returned by `GET /api/activity`. */
type ActivityListResponse = {
    items: ActivityEventResponse[];
    total: number;
    page: number;
    pageSize: number;
};

/**
 * HTTP implementation of {@link ActivityGateway} over the shared `apiClient`
 * (axios, same-origin, cookie-authed; paths omit the `/api` dev-proxy prefix).
 * Everything it fetches is run through the anti-corruption mappers, and every
 * failure is normalized with `toApiError`, so callers see the admin's view
 * models and `ApiError`, never axios internals. The single place `apiClient` is
 * used in this plugin.
 */
export const httpActivityGateway: ActivityGateway = {
    async list(params: ActivityListParams): Promise<ActivityList> {
        try {
            const { data } = await apiClient.get<ActivityListResponse>(
                '/activity',
                { params }
            );
            return {
                items: data.items.map(toActivityEvent),
                total: data.total,
                page: data.page,
                pageSize: data.pageSize
            };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async exportCsv(params: ActivityExportParams): Promise<ActivityExport> {
        try {
            const { data, headers } = await apiClient.get<Blob>(
                '/activity/export',
                { params, responseType: 'blob' }
            );
            const total = Number(headers['x-total-count']);
            return {
                blob: data,
                fileName: exportFileName(headers['content-disposition']),
                total: Number.isFinite(total) ? total : 0,
                truncated: headers['x-export-truncated'] === 'true'
            };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async workspaceNames(): Promise<ReadonlyMap<string, string>> {
        try {
            const { data } =
                await apiClient.get<WorkspaceNameResponse[]>('/workspaces');
            return new Map(
                (Array.isArray(data) ? data : []).map((workspace) => [
                    workspace.id,
                    workspace.name
                ])
            );
        } catch (error) {
            throw toApiError(error);
        }
    },

    async deadLetters(limit: number): Promise<DeadLetterList> {
        try {
            const { data } = await apiClient.get<DeadLetterListResponse>(
                '/activity/dead-letters',
                { params: { limit } }
            );
            return {
                total: data.total,
                items: data.items.map(toDeadLetter)
            };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async retryDeadLetter(id: string): Promise<RetriedDeadLetter> {
        try {
            // 200, not 201: the row that comes back is the one that was
            // already there, reset in place. It keeps its id, because that id
            // is what every subscriber deduplicates on.
            const { data } = await apiClient.post<RetriedDeadLetterResponse>(
                `/activity/dead-letters/${id}/retry`
            );
            return toRetriedDeadLetter(data);
        } catch (error) {
            throw toApiError(error);
        }
    }
};
