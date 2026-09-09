import { apiClient, toApiError } from '@orthacms/utils-admin';
import type {
    EntryReview,
    ProtectionRule,
    ProtectionRuleRecord,
    ReviewApproval
} from '../domain/types';

/** Addresses one entry's review state. */
export type EntryRef = {
    /** The content type's code-defined name. */
    typeName: string;
    /** The entry row — one per locale, which is why approvals are per-locale. */
    entryId: string;
};

/** Opening or updating the ask for review. */
export type RequestReviewInput = EntryRef & {
    /** What the author wants looked at. */
    note?: string;
};

/** Casting or changing a vote. */
export type VoteInput = EntryRef & {
    /** Why. Required in practice for a change request; the API does not force it. */
    note?: string;
};

/** Publishing past a rule that would refuse it. */
export type BypassPublishInput = EntryRef & {
    /**
     * Why this publish should proceed anyway. Non-empty — the dialog will not
     * submit a blank one, and the server records it with the actor and the rule.
     */
    bypassReason: string;
};

/**
 * The port over the protection API — the one seam this plugin talks to instead
 * of `apiClient` directly.
 *
 * Everything here is **workspace-scoped** and reaches the server through
 * `apiClient`'s ambient `X-Workspace-Id` header. The cache keys therefore carry
 * the workspace id explicitly: the header is not sent on a cache hit, so
 * without it one workspace would read another's answer.
 *
 * `bypassPublish` is the odd one out — it posts to **content's** publish route,
 * not to `/protection`. That is not a layering slip: a bypass is an ordinary
 * publish carrying a reason, content-server's own `PublishEntryDto` says so,
 * and routing it through a protection endpoint would make protection a second
 * way to publish. What protection owns is the ceremony in front of it.
 */
export type ProtectionGateway = {
    /**
     * One entry's review state — the requirement, the votes with their
     * staleness, and the open ask. Readable by anyone holding `content:read`,
     * because an ordinary contributor has to see "0 of 2" on their own draft.
     */
    getEntryReview(ref: EntryRef): Promise<EntryReview>;
    /** Open the ask, or update the one already open. */
    requestReview(input: RequestReviewInput): Promise<void>;
    /** Withdraw it. Only the requester or an administrator. */
    withdrawRequest(ref: EntryRef): Promise<void>;
    /** Approve the head revision. */
    approve(input: VoteInput): Promise<void>;
    /** Ask for changes on the head revision. */
    requestChanges(input: VoteInput): Promise<void>;
    /** Withdraw this person's own vote. */
    withdrawVote(ref: EntryRef): Promise<void>;
    /** Publish past the rule, with a reason bound for the activity log. */
    bypassPublish(input: BypassPublishInput): Promise<void>;
    /**
     * Every rule the open workspace holds, including any addressed at a type it
     * is no longer granted — those are the rows an administrator needs in order
     * to remove them. `protection:manage`, administrator-only.
     */
    listRules(): Promise<ProtectionRuleRecord[]>;
    /**
     * Writes the rule for one content type. A **replacement**: the six fields
     * travel whole, so the stored rule is what the form says and nothing
     * carried over.
     */
    saveRule(address: RuleAddress, rule: ProtectionRule): Promise<void>;
    /**
     * Removes the rule. Not the same as `enabled: false`, which keeps the
     * numbers the workspace had chosen. Idempotent.
     */
    deleteRule(address: RuleAddress): Promise<void>;
};

/** Addresses one rule — the pair `workspace_content` already grants. */
export type RuleAddress = {
    /** `collection` or `single`. */
    kind: string;
    /** The code-defined content type name. */
    slug: string;
};

/** One vote as the wire returns it. */
type ApprovalResponse = {
    userId: string;
    decision: string;
    note: string | null;
    revisionId: string;
    revisionNumber: number | null;
    isStale: boolean;
    createdAt: string;
};

/** One entry's review state as the wire returns it. */
type EntryReviewResponse = {
    protected: boolean;
    required: number;
    given: number;
    stale: number;
    changesRequested: number;
    blocked: boolean;
    bypassable: boolean;
    headRevisionId: string;
    headRevisionNumber: number;
    callerWroteHead: boolean;
    approvals: ApprovalResponse[];
    request: {
        id: string;
        requestedBy: string;
        note: string | null;
        revisionId: string;
        createdAt: string;
    } | null;
};

/**
 * Maps one vote from the wire.
 *
 * `decision` is narrowed rather than defaulted: anything but the two known
 * values is dropped by the caller, because a vote the panel cannot name is one
 * it must not render as an approval. A mapper fallback here would silently
 * promote an unknown decision into the count the person reads.
 */
function toApproval(dto: ApprovalResponse): ReviewApproval | null {
    const decision =
        dto.decision === 'approved' || dto.decision === 'changes_requested'
            ? dto.decision
            : null;
    if (!decision) return null;
    return {
        userId: dto.userId,
        decision,
        note: dto.note,
        revisionId: dto.revisionId,
        revisionNumber: dto.revisionNumber,
        isStale: dto.isStale,
        createdAt: dto.createdAt
    };
}

/** Maps one entry's review state from the wire. The counts travel as given. */
function toEntryReview(dto: EntryReviewResponse): EntryReview {
    return {
        protected: dto.protected,
        required: dto.required,
        given: dto.given,
        stale: dto.stale,
        changesRequested: dto.changesRequested,
        blocked: dto.blocked,
        bypassable: dto.bypassable,
        headRevisionId: dto.headRevisionId,
        headRevisionNumber: dto.headRevisionNumber,
        callerWroteHead: dto.callerWroteHead,
        approvals: (dto.approvals ?? [])
            .map(toApproval)
            .filter((vote): vote is NonNullable<typeof vote> => vote !== null),
        request: dto.request
    };
}

/** One stored rule as the wire returns it. */
type ProtectionRuleResponse = {
    id: string;
    kind: string;
    slug: string;
    enabled: boolean;
    requiredApprovals: number;
    requireOtherPerson: boolean;
    countStaleApprovals: boolean;
    adminBypass: boolean;
    allowTokenPublish: boolean;
};

/**
 * Maps one rule from the wire.
 *
 * Booleans are coerced rather than defaulted, and the count is taken as given:
 * a mapper that quietly substituted a default here would show a rule the
 * workspace does not have, and the form would then **save** that invention on
 * the next press of Save.
 */
function toRule(dto: ProtectionRuleResponse): ProtectionRuleRecord {
    return {
        id: dto.id,
        kind: dto.kind,
        slug: dto.slug,
        enabled: !!dto.enabled,
        requiredApprovals: dto.requiredApprovals,
        requireOtherPerson: !!dto.requireOtherPerson,
        countStaleApprovals: !!dto.countStaleApprovals,
        adminBypass: !!dto.adminBypass,
        allowTokenPublish: !!dto.allowTokenPublish
    };
}

/** `/protection/rules/:kind/:slug`. */
const rulePath = ({ kind, slug }: RuleAddress) =>
    `/protection/rules/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}`;

/** `/protection/entries/:type/:id`, the prefix every entry route shares. */
const entryPath = ({ typeName, entryId }: EntryRef) =>
    `/protection/entries/${encodeURIComponent(typeName)}/${encodeURIComponent(entryId)}`;

/**
 * HTTP implementation of {@link ProtectionGateway} over the shared `apiClient`
 * (axios, same-origin, cookie-authed; paths omit the `/api` dev-proxy prefix).
 * Every failure is normalised with `toApiError`, so callers see `ApiError`
 * rather than axios internals. The single place `apiClient` is used here.
 */
export const httpProtectionGateway: ProtectionGateway = {
    async getEntryReview(ref: EntryRef): Promise<EntryReview> {
        try {
            const { data } = await apiClient.get<EntryReviewResponse>(
                entryPath(ref)
            );
            return toEntryReview(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async requestReview({ note, ...ref }: RequestReviewInput): Promise<void> {
        try {
            await apiClient.post(`${entryPath(ref)}/request`, { note });
        } catch (error) {
            throw toApiError(error);
        }
    },

    async withdrawRequest(ref: EntryRef): Promise<void> {
        try {
            await apiClient.delete(`${entryPath(ref)}/request`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async approve({ note, ...ref }: VoteInput): Promise<void> {
        try {
            await apiClient.post(`${entryPath(ref)}/approve`, { note });
        } catch (error) {
            throw toApiError(error);
        }
    },

    async requestChanges({ note, ...ref }: VoteInput): Promise<void> {
        try {
            await apiClient.post(`${entryPath(ref)}/changes`, { note });
        } catch (error) {
            throw toApiError(error);
        }
    },

    async withdrawVote(ref: EntryRef): Promise<void> {
        try {
            await apiClient.delete(`${entryPath(ref)}/approve`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async bypassPublish({
        typeName,
        entryId,
        bypassReason
    }: BypassPublishInput): Promise<void> {
        try {
            await apiClient.post(
                `/content/${encodeURIComponent(typeName)}/${encodeURIComponent(entryId)}/publish`,
                { bypassReason }
            );
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listRules(): Promise<ProtectionRuleRecord[]> {
        try {
            const { data } =
                await apiClient.get<ProtectionRuleResponse[]>(
                    '/protection/rules'
                );
            return (data ?? []).map(toRule);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async saveRule(address: RuleAddress, rule: ProtectionRule): Promise<void> {
        try {
            // All six, always — the API replaces rather than patches.
            await apiClient.put(rulePath(address), rule);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async deleteRule(address: RuleAddress): Promise<void> {
        try {
            await apiClient.delete(rulePath(address));
        } catch (error) {
            throw toApiError(error);
        }
    }
};
