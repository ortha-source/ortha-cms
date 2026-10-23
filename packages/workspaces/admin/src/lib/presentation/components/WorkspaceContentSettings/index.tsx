import { useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Search, Share2, TriangleAlert } from 'lucide-react';
import { useJustCreated } from '@orthacms/utils-admin';
import {
    Badge,
    Button,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Spinner,
    toast
} from '@orthacms/design-system';
import type { SharedSource, Workspace } from '../../../domain/types/workspace';
import type { ContentType } from '../../../domain/types/wizard';
import { isConflict } from '../../../infrastructure/isConflict';
import { useContentTypes } from '../../../application/useContentTypes';
import {
    useAddWorkspaceContent,
    workspaceContentScope
} from '../../../application/useAddWorkspaceContent';
import { useRemoveWorkspaceContent } from '../../../application/useRemoveWorkspaceContent';
import { useSharedSources } from '../../../application/useSharedSources';
import {
    AddContentDialog,
    type ContentGrantChoice,
    type SharedChoiceGroup
} from './AddContentDialog';
import { RemoveContentDialog } from './RemoveContentDialog';
import { RemoveSharedContentDialog } from './RemoveSharedContentDialog';
import { GrantedContentGroup } from './GrantedContentGroup';
import {
    grantKey,
    useGrantLabel,
    type GrantedContent
} from './GrantedContentRow';

const messages = defineMessages({
    ownGroup: {
        id: 'workspaces.settings.content.ownGroup',
        defaultMessage: 'This workspace’s own'
    },
    ownSummary: {
        id: 'workspaces.settings.content.ownSummary',
        defaultMessage:
            '{collections, plural, one {# collection} other {# collections}} · {pages, plural, one {# page} other {# pages}}'
    },
    ownEmpty: {
        id: 'workspaces.settings.content.ownEmpty',
        defaultMessage: 'No content types granted yet.'
    },
    sharedGroup: {
        id: 'workspaces.settings.content.sharedGroup',
        defaultMessage: 'From {workspace}'
    },
    sharedBadge: {
        id: 'workspaces.settings.content.sharedBadge',
        defaultMessage: 'Shared'
    },
    readOnlyHere: {
        id: 'workspaces.settings.content.readOnlyHere',
        defaultMessage: 'Read-only here'
    },
    search: {
        id: 'workspaces.settings.content.search',
        defaultMessage: 'Search content types'
    },
    noMatches: {
        id: 'workspaces.settings.content.noMatches',
        defaultMessage: 'No granted content type matches your search.'
    },
    add: {
        id: 'workspaces.settings.content.add',
        defaultMessage: 'Add content types'
    },
    addBody: {
        id: 'workspaces.settings.content.addBody',
        defaultMessage:
            'Search and select the collections and pages to grant this workspace.'
    },
    removalNote: {
        id: 'workspaces.settings.content.removalNote',
        defaultMessage:
            'Removing a type that still has entries is blocked. Move or delete its entries first — the remove dialog says how many are left.'
    },
    readOnly: {
        id: 'workspaces.settings.content.readOnly',
        defaultMessage:
            'You have read-only access and can’t change content types.'
    },
    loadError: {
        id: 'workspaces.settings.content.loadError',
        defaultMessage: 'Couldn’t load the content-type catalogue.'
    },
    added: {
        id: 'workspaces.settings.content.added',
        defaultMessage:
            '{count, plural, one {Content type added.} other {# content types added.}}'
    },
    addError: {
        id: 'workspaces.settings.content.addError',
        defaultMessage: 'Couldn’t add those content types. Please try again.'
    },
    removed: {
        id: 'workspaces.settings.content.removed',
        defaultMessage: 'Content type removed.'
    },
    sharedRemoved: {
        id: 'workspaces.settings.content.sharedRemoved',
        defaultMessage: '{label} removed.'
    },
    removeError: {
        id: 'workspaces.settings.content.removeError',
        defaultMessage: 'Couldn’t remove that content type. Please try again.'
    },
    notEmpty: {
        id: 'workspaces.settings.content.notEmpty',
        defaultMessage:
            'This content type still has entries in the workspace. Delete them first, then remove it.'
    }
});

/**
 * Classifies a content type as a **page** (a standalone `single`) rather than a
 * multi-entry collection. The single source of this rule, shared by the granted
 * rows and the add dialog. An unknown (stale) type is treated as a collection —
 * the default bucket.
 */
export const isPage = (type?: ContentType) => type?.kind === 'single';

/** Whether a granted row is a page — a shared grant carries its own kind. */
const isPageGrant = (granted: GrantedContent) =>
    granted.shared ? granted.shared.kind === 'single' : isPage(granted.type);

/**
 * What each shared workspace still offers: its types minus the
 * ones already granted **from it** (an own grant of the same type doesn't
 * count — that is a different grant). Sources left with nothing drop out.
 */
function sharedChoices(
    sources: readonly SharedSource[],
    workspace: Workspace,
    labelOf: (slug: string) => string
): SharedChoiceGroup[] {
    const granted = new Set(
        workspace.sharedContent.map((grant) =>
            grantKey(grant.slug, grant.sourceWorkspaceId)
        )
    );
    return sources
        .filter((source) => source.workspaceId !== workspace.id)
        .map((source) => ({
            workspaceId: source.workspaceId,
            workspaceName: source.workspaceName,
            items: source.content
                .filter(
                    (type) =>
                        !granted.has(grantKey(type.slug, source.workspaceId))
                )
                .map((type) => ({
                    slug: type.slug,
                    kind: type.kind,
                    label: labelOf(type.slug)
                }))
        }))
        .filter((group) => group.items.length > 0);
}

/** Props for {@link WorkspaceContentSettings}. */
export type WorkspaceContentSettingsProps = {
    /** The workspace whose content grants are managed. */
    workspace: Workspace;
    /** Whether the current user may manage content (holds `workspaces:update`). */
    canUpdate: boolean;
};

/** One source's grants, in the order the list draws them. */
type GrantGroup = {
    /** `own`, or the source workspace's id. */
    key: string;
    /** The source workspace's name; absent for the own group. */
    sourceName?: string;
    items: GrantedContent[];
};

/**
 * The Content types settings section: every grant in **one list**, grouped by
 * where its records come from — this workspace's own first (collections, then
 * pages), then one group per shared workspace — with a search over them, one
 * **Add content types** dialog for both kinds, and a remove that **blocks**
 * while an own type still holds entries. Each own row says how many it holds.
 * Gated on `workspaces:update`.
 *
 * Grants are **per source**: a type granted as this workspace's own ("Tags")
 * and from a shared workspace ("Tags" under "From Travel Library") are two
 * rows, added and removed independently — the shared one carries an
 * Unavailable badge while its source no longer shares.
 */
export function WorkspaceContentSettings({
    workspace,
    canUpdate
}: WorkspaceContentSettingsProps) {
    const intl = useIntl();
    const grantLabel = useGrantLabel();
    const catalog = useContentTypes();
    // Only someone who can grant ever opens the dialog that lists sources.
    const sources = useSharedSources(workspace.id, canUpdate);
    const addContent = useAddWorkspaceContent();
    const removeContent = useRemoveWorkspaceContent();
    const isJustGranted = useJustCreated(workspaceContentScope(workspace.id));
    const searchRef = useRef<HTMLInputElement>(null);
    // Set once a revoke lands: the row whose X opened the dialog is gone, so
    // Radix's focus restore would drop to `<body>`.
    const removedRef = useRef(false);
    const [addOpen, setAddOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [pendingRemoval, setPendingRemoval] = useState<GrantedContent | null>(
        null
    );

    const types = useMemo(() => catalog.data ?? [], [catalog.data]);
    const byName = useMemo(() => {
        const map = new Map<string, ContentType>();
        for (const type of types) map.set(type.name, type);
        return map;
    }, [types]);

    const grantedSet = new Set(workspace.content);
    const own: GrantedContent[] = workspace.content.map((slug) => ({
        key: grantKey(slug),
        slug,
        type: byName.get(slug)
    }));
    // Collections first, then pages; an unknown (stale) slug can't be classed
    // by kind and falls with the collections, the default bucket.
    const ownSorted = [
        ...own.filter((g) => !isPageGrant(g)),
        ...own.filter((g) => isPageGrant(g))
    ];
    const ownPages = own.filter((g) => isPageGrant(g)).length;

    const q = query.trim().toLowerCase();
    const matches = (granted: GrantedContent) =>
        !q ||
        [
            granted.type?.label,
            granted.type?.name,
            granted.slug,
            granted.shared?.sourceWorkspaceName
        ].some((field) => field?.toLowerCase().includes(q));

    const sharedGroups = new Map<string, GrantGroup>();
    for (const shared of workspace.sharedContent) {
        const group = sharedGroups.get(shared.sourceWorkspaceId) ?? {
            key: shared.sourceWorkspaceId,
            sourceName: shared.sourceWorkspaceName,
            items: []
        };
        group.items.push({
            key: grantKey(shared.slug, shared.sourceWorkspaceId),
            slug: shared.slug,
            type: byName.get(shared.slug),
            shared
        });
        sharedGroups.set(shared.sourceWorkspaceId, group);
    }
    const groups: GrantGroup[] = [
        { key: 'own', items: ownSorted.filter(matches) },
        ...[...sharedGroups.values()]
            .map((group) => ({ ...group, items: group.items.filter(matches) }))
            .filter((group) => group.items.length > 0)
    ];
    const nothingMatches =
        q !== '' && groups.every((group) => group.items.length === 0);

    const available = types.filter((type) => !grantedSet.has(type.name));
    const labelOf = (slug: string) =>
        byName.get(slug)?.label ?? byName.get(slug)?.name ?? slug;
    const sharedChoiceGroups = sharedChoices(
        sources.data ?? [],
        workspace,
        labelOf
    );

    /** Grants the chosen types; returns whether it succeeded (to close on ok). */
    const grant = async (choices: ContentGrantChoice[]): Promise<boolean> => {
        // The grant endpoint is per-slug; fan out and reconcile once. Use
        // allSettled so one failure doesn't discard the grants that did land —
        // report how many succeeded and only flag the rest as failed.
        const results = await Promise.allSettled(
            choices.map(({ slug, sourceWorkspaceId }) =>
                addContent.mutateAsync({
                    workspaceId: workspace.id,
                    slug,
                    ...(sourceWorkspaceId ? { sourceWorkspaceId } : {})
                })
            )
        );
        const succeeded = results.filter(
            (result) => result.status === 'fulfilled'
        ).length;
        const failed = choices.length - succeeded;

        if (succeeded > 0) {
            toast.success(
                intl.formatMessage(messages.added, { count: succeeded })
            );
        }
        if (failed > 0) {
            toast.error(intl.formatMessage(messages.addError));
        }
        // Close only when everything landed; on a partial failure the dialog
        // stays open so the still-ungranted types (the list refetched them out)
        // remain visible for a retry.
        return failed === 0;
    };

    const confirmRemoval = async () => {
        if (!pendingRemoval) return;
        const { slug, shared } = pendingRemoval;
        try {
            await removeContent.mutateAsync({
                workspaceId: workspace.id,
                slug,
                // A shared grant is revoked by its source; without one the
                // server drops the **own** grant, which must never happen here.
                ...(shared
                    ? { sourceWorkspaceId: shared.sourceWorkspaceId }
                    : {})
            });
            removedRef.current = true;
            toast.success(
                shared
                    ? intl.formatMessage(messages.sharedRemoved, {
                          label: grantLabel(pendingRemoval)
                      })
                    : intl.formatMessage(messages.removed)
            );
        } catch (error) {
            // The dialog blocks a non-empty revoke up front; this 409 is only a
            // safety net for an entry created between the check and the confirm.
            (isConflict(error) ? toast.warning : toast.error)(
                intl.formatMessage(
                    isConflict(error) ? messages.notEmpty : messages.removeError
                )
            );
        } finally {
            setPendingRemoval(null);
        }
    };

    const removalLabel = pendingRemoval ? grantLabel(pendingRemoval) : '';

    // The removed row took its X with it; land on the search box above the
    // list instead of `<body>`. A cancelled dialog keeps Radix's own restore
    // to the X.
    const onRemovalCloseAutoFocus = (event: Event) => {
        if (!removedRef.current) return;
        removedRef.current = false;
        event.preventDefault();
        searchRef.current?.focus();
    };

    return (
        <>
            {catalog.isError ? (
                <p className="text-sm text-destructive">
                    {intl.formatMessage(messages.loadError)}
                </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
                <InputGroup className="w-full sm:max-w-[320px]">
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={intl.formatMessage(messages.search)}
                        aria-label={intl.formatMessage(messages.search)}
                        autoComplete="off"
                    />
                </InputGroup>
                {canUpdate ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => setAddOpen(true)}
                        disabled={catalog.isPending || catalog.isError}
                    >
                        <Plus className="size-4" />
                        {intl.formatMessage(messages.add)}
                    </Button>
                ) : null}
            </div>

            {canUpdate ? null : (
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.readOnly)}
                </p>
            )}

            {catalog.isPending && own.length + sharedGroups.size === 0 ? (
                <p className="flex items-center gap-2 rounded-xl border px-3 py-4 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                </p>
            ) : nothingMatches ? (
                <p className="rounded-xl border px-4 py-6 text-center text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noMatches)}
                </p>
            ) : (
                groups.map((group) =>
                    group.sourceName === undefined ? (
                        group.items.length > 0 || !q ? (
                            <GrantedContentGroup
                                key={group.key}
                                label={intl.formatMessage(messages.ownGroup)}
                                heading={intl.formatMessage(messages.ownGroup)}
                                aside={intl.formatMessage(messages.ownSummary, {
                                    collections: own.length - ownPages,
                                    pages: ownPages
                                })}
                                items={group.items}
                                emptyLabel={intl.formatMessage(
                                    messages.ownEmpty
                                )}
                                workspaceId={workspace.id}
                                canRemove={canUpdate}
                                onRemove={setPendingRemoval}
                                isJustGranted={isJustGranted}
                            />
                        ) : null
                    ) : (
                        <GrantedContentGroup
                            key={group.key}
                            label={intl.formatMessage(messages.sharedGroup, {
                                workspace: group.sourceName
                            })}
                            heading={
                                <>
                                    {intl.formatMessage(messages.sharedGroup, {
                                        workspace: group.sourceName
                                    })}
                                    <Badge variant="info" size="xs">
                                        <Share2
                                            className="size-3"
                                            aria-hidden
                                        />
                                        {intl.formatMessage(
                                            messages.sharedBadge
                                        )}
                                    </Badge>
                                </>
                            }
                            aside={intl.formatMessage(messages.readOnlyHere)}
                            items={group.items}
                            workspaceId={workspace.id}
                            canRemove={canUpdate}
                            onRemove={setPendingRemoval}
                            isJustGranted={isJustGranted}
                        />
                    )
                )
            )}

            {canUpdate ? (
                <p className="flex gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5 text-[13px] text-warning-soft-foreground">
                    <TriangleAlert
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                    />
                    {intl.formatMessage(messages.removalNote)}
                </p>
            ) : null}

            <AddContentDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                title={intl.formatMessage(messages.add)}
                description={intl.formatMessage(messages.addBody)}
                available={available}
                sharedGroups={sharedChoiceGroups}
                sharedError={sources.isError}
                onConfirm={async (choices) => {
                    if (await grant(choices)) setAddOpen(false);
                }}
                busy={addContent.isPending}
            />

            {/* An own grant is blocked while the workspace holds entries of
                the type; a shared grant holds none here, so it only confirms. */}
            <RemoveContentDialog
                workspaceId={workspace.id}
                slug={
                    pendingRemoval && !pendingRemoval.shared
                        ? pendingRemoval.slug
                        : null
                }
                label={removalLabel}
                onClose={() => setPendingRemoval(null)}
                onConfirm={confirmRemoval}
                busy={removeContent.isPending}
            />
            <RemoveSharedContentDialog
                open={Boolean(pendingRemoval?.shared)}
                label={removalLabel}
                workspaceName={
                    pendingRemoval?.shared?.sourceWorkspaceName ?? ''
                }
                onClose={() => setPendingRemoval(null)}
                onConfirm={confirmRemoval}
                onCloseAutoFocus={onRemovalCloseAutoFocus}
                busy={removeContent.isPending}
            />
        </>
    );
}
