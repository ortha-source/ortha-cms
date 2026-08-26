import { apiClient, toApiError } from '@orthacms/utils-admin';
import type { EntryAccess, Segment } from '../domain/types';

/** What the create dialog submits. */
export type CreateSegmentInput = {
    key: string;
    label: string;
    /** Reader tags; the server defaults to the key. */
    tags?: string[];
};

/** A partial segment edit. The key is immutable. */
export type UpdateSegmentInput = {
    id: string;
    label?: string;
    tags?: string[];
};

/** Replace one entry's lists. Both travel whole — see the port note. */
export type SetEntryAccessInput = {
    entryId: string;
    typeSlug: string;
    allow: string[];
    deny: string[];
};

/**
 * The port over the segments API — the one seam this plugin talks to instead of
 * `apiClient` directly.
 *
 * Two halves with different scopes, deliberately. The segment directory is
 * installation-wide, like a content type. One entry's access is
 * workspace-scoped and reaches the server through `apiClient`'s ambient
 * `X-Workspace-Id` header, which is why those cache keys carry the workspace id
 * explicitly — the header is not sent on a cache hit, so without it one
 * workspace would read another's answer.
 *
 * `setEntryAccess` is a **replace**, matching the `PUT` behind it: the editor
 * submits the whole state of both lists, which is the only shape that can
 * express a removal.
 */
export type SegmentsGateway = {
    /** Every segment, optionally narrowed by a search term. */
    listSegments(query?: string): Promise<Segment[]>;
    /** Create a segment. */
    createSegment(input: CreateSegmentInput): Promise<Segment>;
    /** Rename a segment, or change the tags it answers to. */
    updateSegment(input: UpdateSegmentInput): Promise<Segment>;
    /** Delete a segment and drop it from every entry that named it. */
    deleteSegment(id: string): Promise<void>;

    /** One entry's lists. Two empty ones mean everyone. */
    getEntryAccess(entryId: string): Promise<EntryAccess>;
    /** Replace one entry's lists. */
    setEntryAccess(input: SetEntryAccessInput): Promise<EntryAccess>;
};

/** A segment as the wire returns it. */
type SegmentResponse = {
    id: string;
    key: string;
    label: string;
    tags: string[];
    usageCount: number;
};

/** Maps a segment from the wire. Nothing to enrich — the shapes agree. */
function toSegment(dto: SegmentResponse): Segment {
    return {
        id: dto.id,
        key: dto.key,
        label: dto.label,
        tags: dto.tags ?? [],
        usageCount: dto.usageCount ?? 0
    };
}

/**
 * HTTP implementation of {@link SegmentsGateway} over the shared `apiClient`
 * (axios, same-origin, cookie-authed; paths omit the `/api` dev-proxy prefix).
 * Every failure is normalised with `toApiError`, so callers see `ApiError`
 * rather than axios internals. The single place `apiClient` is used here.
 */
export const httpSegmentsGateway: SegmentsGateway = {
    async listSegments(query?: string): Promise<Segment[]> {
        try {
            const { data } = await apiClient.get<SegmentResponse[]>(
                '/segments',
                { params: query ? { q: query } : undefined }
            );
            return data.map(toSegment);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async createSegment(input: CreateSegmentInput): Promise<Segment> {
        try {
            const { data } = await apiClient.post<SegmentResponse>(
                '/segments',
                input
            );
            return toSegment(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async updateSegment({ id, ...body }: UpdateSegmentInput): Promise<Segment> {
        try {
            const { data } = await apiClient.patch<SegmentResponse>(
                `/segments/${id}`,
                body
            );
            return toSegment(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async deleteSegment(id: string): Promise<void> {
        try {
            await apiClient.delete(`/segments/${id}`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async getEntryAccess(entryId: string): Promise<EntryAccess> {
        try {
            const { data } = await apiClient.get<EntryAccess>(
                `/segments/entries/${entryId}`
            );
            return { allow: data.allow ?? [], deny: data.deny ?? [] };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async setEntryAccess({
        entryId,
        ...body
    }: SetEntryAccessInput): Promise<EntryAccess> {
        try {
            const { data } = await apiClient.put<EntryAccess>(
                `/segments/entries/${entryId}`,
                body
            );
            return { allow: data.allow ?? [], deny: data.deny ?? [] };
        } catch (error) {
            throw toApiError(error);
        }
    }
};

/**
 * Query keys.
 *
 * The catalogue and one entry's access are rooted apart: the catalogue is
 * installation-wide and changes when an administrator edits an audience, while
 * an entry's lists change every time an editor touches one. Rooting them
 * together would make a segment rename drop every open entry's answer from
 * cache for no reason a reader could see.
 */
export const segmentsKeys = {
    /** Root covering the installation-wide directory. */
    catalogue: ['segments'] as const,
    /** The directory, for one search term. */
    list: (query?: string) => ['segments', 'list', query ?? ''] as const,
    /**
     * One entry's lists. The workspace is in the key because it reaches the
     * server only as an ambient header, which is never sent on a cache hit.
     */
    entry: (workspaceId: string, entryId: string) =>
        ['segments', 'entry', workspaceId, entryId] as const
};
