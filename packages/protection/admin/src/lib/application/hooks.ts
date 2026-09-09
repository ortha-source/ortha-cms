import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient
} from '@tanstack/react-query';
import { refreshEntryCaches } from '@orthacms/content-admin';
import { type ApiError } from '@orthacms/utils-admin';
import type {
    EntryReview,
    ProtectionRule,
    ProtectionRuleRecord,
    ReviewQueue
} from '../domain/types';
import {
    entryReviewKey,
    queueKey,
    rulesKey
} from '../infrastructure/protectionKeys';
import {
    httpProtectionGateway,
    type BypassPublishInput,
    type EntryRef,
    type RequestReviewInput,
    type ReviewQueueParams,
    type RuleAddress,
    type VoteInput
} from '../infrastructure/protectionGateway';

/** What the entry surfaces need to address and cache one entry's review. */
export type EntryReviewScope = EntryRef & {
    /** The open workspace — part of every key; see `protectionKeys`. */
    workspaceId: string;
    /**
     * The entry's `updatedAt`.
     *
     * It is in the **key**, not a dependency of an invalidation, and that is
     * what keeps this plugin out of content's save path. A save moves the head
     * revision, which changes *which approvals count* — so the answer this
     * query holds is about a version that no longer exists. Content stamps a
     * new `updatedAt` on every save, so the save produces a new key and the
     * panel reads afresh, without protection reaching into a mutation it does
     * not own or content learning that protection exists.
     */
    updatedAt: string;
};

/**
 * The scope for the entry open in the editor, or `null` when there is nothing
 * to review yet.
 *
 * `null` on a create form and on a **non-publishable** type: review guards the
 * `draft → published` transition, so a type that is always live has no
 * transition to hold. Every surface reads this rather than assembling the scope
 * itself, so all three agree on when the feature applies at all.
 */
export function reviewScopeOf(context: {
    schema: { name: string; publishable?: boolean };
    entry?: { id: string; updatedAt: string };
    isCreate: boolean;
    workspaceId: string;
}): EntryReviewScope | null {
    if (context.isCreate || !context.entry || !context.schema.publishable) {
        return null;
    }
    return {
        workspaceId: context.workspaceId,
        typeName: context.schema.name,
        entryId: context.entry.id,
        updatedAt: context.entry.updatedAt
    };
}

/**
 * One entry's review state.
 *
 * Enabled only for a saved entry on a caller who may read content — the create
 * form has no entry to review, and the read is `content:read`-gated server-side
 * anyway. Deliberately **not** gated on `protection:manage`: an ordinary
 * contributor has to see "0 of 2" on their own draft, which is the whole
 * purpose of the panel.
 */
export function useEntryReview(scope: EntryReviewScope | null, enabled = true) {
    // `enabled` already guarantees the query never runs without a scope, but the
    // compiler cannot see through it — the same narrowing gap content's own
    // `useEntryRelations` closes the same way.
    const target = scope as EntryReviewScope;
    return useQuery<EntryReview, ApiError>({
        queryKey: scope
            ? entryReviewKey(scope.workspaceId, scope.typeName, scope.entryId)
            : ['protection', 'entry-review', 'idle'],
        queryFn: () =>
            httpProtectionGateway.getEntryReview({
                typeName: target.typeName,
                entryId: target.entryId
            }),
        enabled: enabled && !!scope
    });
}

/**
 * Refreshes only what a vote changed.
 *
 * A vote moves the review state and nothing else: the entry's own values, its
 * relations, its media and its version timeline are all exactly as they were.
 * Refetching the editor through `refreshEntryCaches` would re-read a record and
 * a whole revision list to learn a number this one query already carries — the
 * over-invalidation the admin-plugin skill warns about, and it is visible as a
 * flicker on a rail the person is looking at.
 */
function refreshReview(
    queryClient: QueryClient,
    { workspaceId, typeName, entryId }: EntryReviewScope
) {
    return queryClient.invalidateQueries({
        queryKey: entryReviewKey(workspaceId, typeName, entryId)
    });
}

/** Opens the ask for review, or updates the one already open. */
export function useRequestReview(scope: EntryReviewScope) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, RequestReviewInput>({
        mutationFn: (input) => httpProtectionGateway.requestReview(input),
        onSuccess: () => refreshReview(queryClient, scope)
    });
}

/** Withdraws the open ask. Only its author or an administrator may. */
export function useWithdrawRequest(scope: EntryReviewScope) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, EntryRef>({
        mutationFn: (ref) => httpProtectionGateway.withdrawRequest(ref),
        onSuccess: () => refreshReview(queryClient, scope)
    });
}

/** Approves the head revision. */
export function useApprove(scope: EntryReviewScope) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, VoteInput>({
        mutationFn: (input) => httpProtectionGateway.approve(input),
        onSuccess: () => refreshReview(queryClient, scope)
    });
}

/** Asks for changes on the head revision. */
export function useRequestChanges(scope: EntryReviewScope) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, VoteInput>({
        mutationFn: (input) => httpProtectionGateway.requestChanges(input),
        onSuccess: () => refreshReview(queryClient, scope)
    });
}

/** Withdraws this person's own vote. */
export function useWithdrawVote(scope: EntryReviewScope) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, EntryRef>({
        mutationFn: (ref) => httpProtectionGateway.withdrawVote(ref),
        onSuccess: () => refreshReview(queryClient, scope)
    });
}

/**
 * Publishes past the rule, with a mandatory reason.
 *
 * The one mutation here that **does** refresh content's caches, because it is
 * the one that writes the entry: the record's status moves to published, its
 * revision timeline gains a live version, and the records list behind the
 * editor is now wrong. `refreshEntryCaches` is content's own single pass over
 * that set, exported for exactly this — hand-rolling it silently no-ops, since
 * the cache roots are `content-entries` / `content-entry` rather than
 * `content`.
 *
 * The review read is invalidated too: publishing resolves the open request.
 */
export function useBypassPublish(scope: EntryReviewScope) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, BypassPublishInput>({
        mutationFn: (input) => httpProtectionGateway.bypassPublish(input),
        onSuccess: async () => {
            await refreshEntryCaches(
                queryClient,
                scope.workspaceId,
                scope.typeName
            );
            await refreshReview(queryClient, scope);
        }
    });
}

/**
 * Every rule the open workspace holds.
 *
 * Gated by the caller rather than here: the list route is `protection:manage`,
 * administrator-only, so a member without it would spend a request to be told
 * 403 and the settings section shows them why instead.
 */
export function useProtectionRules(workspaceId: string, enabled = true) {
    return useQuery<ProtectionRuleRecord[], ApiError>({
        queryKey: rulesKey(workspaceId),
        queryFn: () => httpProtectionGateway.listRules(),
        enabled
    });
}

/** What a rule save needs: where it goes, and all six fields. */
export type SaveRuleInput = RuleAddress & { rule: ProtectionRule };

/**
 * Writes one rule.
 *
 * Invalidates **only** the rules key. A rule changes which entries are held,
 * but every entry panel reads its own `entryReviewKey`, and those are keyed by
 * the entry's `updatedAt` rather than by anything this write moves — so
 * clearing them would refetch every open editor to learn a number none of them
 * is showing. An editor opened after the change reads the new rule on its first
 * request, which is the only moment it can matter.
 */
export function useSaveProtectionRule(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, SaveRuleInput>({
        mutationFn: ({ kind, slug, rule }) =>
            httpProtectionGateway.saveRule({ kind, slug }, rule),
        onSuccess: () => invalidateRules(queryClient, workspaceId)
    });
}

/** Removes one rule, leaving no row. */
export function useDeleteProtectionRule(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, RuleAddress>({
        mutationFn: (address) => httpProtectionGateway.deleteRule(address),
        onSuccess: () => invalidateRules(queryClient, workspaceId)
    });
}

/** Refreshes the workspace's rule list after a write. */
function invalidateRules(queryClient: QueryClient, workspaceId: string) {
    return queryClient.invalidateQueries({ queryKey: rulesKey(workspaceId) });
}

/**
 * One page of the workspace's open review requests.
 *
 * `keepPreviousData` because the page splits one window into two tabs: without
 * it, switching tabs during a refetch would empty the table under the person's
 * cursor even though the rows it needs are already cached.
 *
 * Gated by the caller rather than here — the route is `content:read`, which
 * anybody who can open the Content Library already holds.
 */
export function useReviewQueue(
    workspaceId: string,
    params: ReviewQueueParams = {},
    enabled = true
) {
    return useQuery<ReviewQueue, ApiError>({
        queryKey: queueKey(workspaceId, params),
        queryFn: () => httpProtectionGateway.listQueue(params),
        placeholderData: keepPreviousData,
        enabled
    });
}
