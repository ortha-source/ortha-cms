import { apiClient, toApiError } from '@orthacms/utils-admin';
import type { SegmentType } from '../../domain/types/segmentType';
import type { Segment } from '../../domain/types/segment';
import type { AccessRule } from '../../domain/types/accessRule';
import type { Assignment, Grant } from '../../domain/types/accessTarget';
import type { ExplainResult } from '../../domain/types/explain';
import {
    toAccessRule,
    toAssignment,
    toGrant,
    toSegment,
    toSegmentType,
    type AccessRuleResponse,
    type AssignmentResponse,
    type GrantResponse,
    type SegmentResponse,
    type SegmentTypeResponse
} from '../segmentsMapper';
import type { SegmentsListParams } from '../segmentsKeys';
import type {
    AssignRuleInput,
    CreateSegmentInput,
    CreateSegmentTypeInput,
    DeleteSegmentInput,
    ExplainAccessInput,
    GrantAccessInput,
    SaveAccessRuleInput,
    SegmentsGateway,
    UpdateAccessRuleInput,
    UpdateSegmentInput,
    UpdateSegmentTypeInput
} from '../segmentsGateway';

/** The catalogue's base path; the segments routes nest under a type key. */
const TYPES = '/access/segment-types';

/**
 * The body the rule endpoints accept. Dates travel as ISO strings and the
 * groups keep the wire's `{ conditions }` wrapper — the shape a caller sends is
 * the shape it reads back.
 */
type SaveRuleBody = Omit<SaveAccessRuleInput, 'groups'> & {
    groups?: {
        conditions: Record<string, { mode: string; segmentIds: string[] }>;
    }[];
};

/**
 * Serialises the editor's rule into the request body.
 *
 * The one transformation worth naming: a condition whose mode is `all` still
 * travels. Dropping it would be indistinguishable from never having authored
 * it — and while both resolve the same way *today*, an absent type inherits
 * from the level above while an explicit `all` does not. Silently turning "this
 * level opens the axis" into "this level says nothing about the axis" is the
 * kind of edit that reopens content a workspace rule had closed.
 */
function toSaveRuleBody(input: SaveAccessRuleInput): SaveRuleBody {
    return {
        ...input,
        groups: input.groups?.map((group) => ({
            conditions: Object.fromEntries(
                Object.entries(group.conditions).map(([typeKey, condition]) => [
                    typeKey,
                    { mode: condition.mode, segmentIds: condition.segmentIds }
                ])
            )
        }))
    };
}

/**
 * HTTP implementation of {@link SegmentsGateway} over the shared `apiClient`
 * (axios, same-origin, cookie-authed; paths omit the `/api` dev-proxy prefix).
 * Every response runs through a mapper and every failure is normalised with
 * `toApiError`, so callers see the admin's models and `ApiError`, never axios
 * internals. The single place `apiClient` is used in this plugin.
 *
 * The workspace-scoped half sends no workspace of its own: `apiClient` attaches
 * the open workspace as `X-Workspace-Id` on every request, which is what the
 * server's `WorkspaceGuard` reads.
 */
export const httpSegmentsGateway: SegmentsGateway = {
    async listTypes(): Promise<SegmentType[]> {
        try {
            const { data } = await apiClient.get<SegmentTypeResponse[]>(TYPES);
            return data.map(toSegmentType);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async createType(input: CreateSegmentTypeInput): Promise<SegmentType> {
        try {
            const { data } = await apiClient.post<SegmentTypeResponse>(
                TYPES,
                input
            );
            return toSegmentType(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async updateType({
        id,
        ...body
    }: UpdateSegmentTypeInput): Promise<SegmentType> {
        try {
            const { data } = await apiClient.patch<SegmentTypeResponse>(
                `${TYPES}/${id}`,
                body
            );
            return toSegmentType(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async retireType(id: string): Promise<SegmentType> {
        try {
            const { data } = await apiClient.delete<SegmentTypeResponse>(
                `${TYPES}/${id}`
            );
            return toSegmentType(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listSegments(
        typeKey: string,
        params: SegmentsListParams = {}
    ): Promise<Segment[]> {
        try {
            const { data } = await apiClient.get<SegmentResponse[]>(
                `${TYPES}/${encodeURIComponent(typeKey)}/segments`,
                { params }
            );
            return data.map(toSegment);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async createSegment({
        typeKey,
        ...body
    }: CreateSegmentInput): Promise<Segment> {
        try {
            const { data } = await apiClient.post<SegmentResponse>(
                `${TYPES}/${encodeURIComponent(typeKey)}/segments`,
                body
            );
            return toSegment(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async updateSegment({
        typeKey,
        id,
        ...body
    }: UpdateSegmentInput): Promise<Segment> {
        try {
            const { data } = await apiClient.patch<SegmentResponse>(
                `${TYPES}/${encodeURIComponent(typeKey)}/segments/${id}`,
                body
            );
            return toSegment(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async deleteSegment({ typeKey, id }: DeleteSegmentInput): Promise<void> {
        try {
            await apiClient.delete(
                `${TYPES}/${encodeURIComponent(typeKey)}/segments/${id}`
            );
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listRules(): Promise<AccessRule[]> {
        try {
            const { data } =
                await apiClient.get<AccessRuleResponse[]>('/access/rules');
            return data.map(toAccessRule);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async createRule(input: SaveAccessRuleInput): Promise<AccessRule> {
        try {
            const { data } = await apiClient.post<AccessRuleResponse>(
                '/access/rules',
                toSaveRuleBody(input)
            );
            return toAccessRule(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async updateRule({
        id,
        ...input
    }: UpdateAccessRuleInput): Promise<AccessRule> {
        try {
            const { data } = await apiClient.patch<AccessRuleResponse>(
                `/access/rules/${id}`,
                toSaveRuleBody(input)
            );
            return toAccessRule(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async deleteRule(id: string): Promise<void> {
        try {
            await apiClient.delete(`/access/rules/${id}`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listAssignments(): Promise<Assignment[]> {
        try {
            const { data } = await apiClient.get<AssignmentResponse[]>(
                '/access/assignments'
            );
            return data.map(toAssignment);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async assign(input: AssignRuleInput): Promise<Assignment> {
        try {
            const { data } = await apiClient.post<AssignmentResponse>(
                '/access/assignments',
                input
            );
            return toAssignment(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async unassign(id: string): Promise<void> {
        try {
            await apiClient.delete(`/access/assignments/${id}`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listGrants(segmentId: string): Promise<Grant[]> {
        try {
            const { data } = await apiClient.get<GrantResponse[]>(
                `/access/grants/segment/${segmentId}`
            );
            return data.map(toGrant);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async grant(input: GrantAccessInput): Promise<Grant> {
        try {
            const { data } = await apiClient.post<GrantResponse>(
                '/access/grants',
                input
            );
            return toGrant(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async revokeGrant(id: string): Promise<void> {
        try {
            await apiClient.delete(`/access/grants/${id}`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async explain(input: ExplainAccessInput): Promise<ExplainResult> {
        try {
            // A POST for a read: the reader's tags are the input, and a list of
            // them does not belong in a URL — it would land in access logs and
            // in browser history, and it describes a person.
            const { data } = await apiClient.post<ExplainResult>(
                '/access/explain',
                input
            );
            return data;
        } catch (error) {
            throw toApiError(error);
        }
    }
};
