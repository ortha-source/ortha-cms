import { useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Spinner,
    toast
} from '@orthacms/design-system';
import type { SharedSource, Workspace } from '../../../domain/types/workspace';
import type { ContentType } from '../../../domain/types/wizard';
import { isConflict } from '../../../infrastructure/isConflict';
import { useContentTypes } from '../../../application/useContentTypes';
import { useAddWorkspaceContent } from '../../../application/useAddWorkspaceContent';
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
    title: {
        id: 'workspaces.settings.content.title',
        defaultMessage: 'Content types'
    },
    description: {
        id: 'workspaces.settings.content.description',
        defaultMessage:
            'The collections and pages this workspace can work with. Its Content Library is scoped to these.'
    },
    collections: {
        id: 'workspaces.settings.content.collections',
        defaultMessage: 'Collections'
    },
    pages: {
        id: 'workspaces.settings.content.pages',
        defaultMessage: 'Pages'
    },
    collectionsEmpty: {
        id: 'workspaces.settings.content.collectionsEmpty',
        defaultMessage: 'No collections granted yet.'
    },
    pagesEmpty: {
        id: 'workspaces.settings.content.pagesEmpty',
        defaultMessage: 'No pages granted yet.'
    },
    addCollections: {
        id: 'workspaces.settings.content.addCollections',
        defaultMessage: 'Add collections'
    },
    addPages: {
        id: 'workspaces.settings.content.addPages',
        defaultMessage: 'Add pages'
    },
    addCollectionsBody: {
        id: 'workspaces.settings.content.addCollectionsBody',
        defaultMessage:
            'Search and select the multi-entry collections to grant this workspace.'
    },
    addPagesBody: {
        id: 'workspaces.settings.content.addPagesBody',
        defaultMessage:
            'Search and select the standalone pages to grant this workspace.'
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
 * What each shared workspace still offers of one kind: its types minus the
 * ones already granted **from it** (an own grant of the same type doesn't
 * count — that is a different grant). Sources left with nothing drop out.
 */
function sharedChoices(
    sources: readonly SharedSource[],
    workspace: Workspace,
    kind: 'collection' | 'single',
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
                        type.kind === kind &&
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

/**
 * The Content-types settings tab: the granted collections and pages shown as
 * two titled groups (each row with its title + description), granted through a
 * **separate search + multi-select dialog per kind** (Add collections / Add
 * pages), and revoked through a dialog that **blocks** the action while the type
 * still holds entries. Gated on `workspaces:update`.
 *
 * Grants are **per source**: a type granted as this workspace's own ("Tags")
 * and from a shared workspace ("Tags · Travel Library") are two rows, added and
 * removed independently — the shared one carries a Shared badge, plus an
 * Unavailable one while its source no longer shares.
 */
export function WorkspaceContentSettings({
    workspace,
    canUpdate
}: WorkspaceContentSettingsProps) {
    const intl = useIntl();
    const grantLabel = useGrantLabel();
    const catalog = useContentTypes();
    // Only someone who can grant ever opens the dialogs that list sources.
    const sources = useSharedSources(workspace.id, canUpdate);
    const addContent = useAddWorkspaceContent();
    const removeContent = useRemoveWorkspaceContent();
    const headingRef = useRef<HTMLHeadingElement>(null);
    // Set once a revoke lands: the row whose X opened the dialog is gone, so
    // Radix's focus restore would drop to `<body>`.
    const removedRef = useRef(false);
    const [addCollectionsOpen, setAddCollectionsOpen] = useState(false);
    const [addPagesOpen, setAddPagesOpen] = useState(false);
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
    const granted: GrantedContent[] = [
        ...workspace.content.map((slug) => ({
            key: grantKey(slug),
            slug,
            type: byName.get(slug)
        })),
        // Each grant from a shared workspace is its own row, after the own
        // ones, labelled "{Type} · {Workspace}".
        ...workspace.sharedContent.map((shared) => ({
            key: grantKey(shared.slug, shared.sourceWorkspaceId),
            slug: shared.slug,
            type: byName.get(shared.slug),
            shared
        }))
    ];
    // An unknown (stale) slug can't be classed by kind — it falls under
    // Collections, the default bucket.
    const grantedCollections = granted.filter((g) => !isPageGrant(g));
    const grantedPages = granted.filter((g) => isPageGrant(g));
    const availableCollections = types.filter(
        (type) => !isPage(type) && !grantedSet.has(type.name)
    );
    const availablePages = types.filter(
        (type) => isPage(type) && !grantedSet.has(type.name)
    );
    const labelOf = (slug: string) =>
        byName.get(slug)?.label ?? byName.get(slug)?.name ?? slug;
    const sourceList = sources.data ?? [];
    const sharedCollections = sharedChoices(
        sourceList,
        workspace,
        'collection',
        labelOf
    );
    const sharedPages = sharedChoices(sourceList, workspace, 'single', labelOf);

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

    // The removed row took its X with it; land on the card heading instead of
    // `<body>`. A cancelled dialog keeps Radix's own restore to the X.
    const onRemovalCloseAutoFocus = (event: Event) => {
        if (!removedRef.current) return;
        removedRef.current = false;
        event.preventDefault();
        headingRef.current?.focus();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle asChild>
                    <h2
                        ref={headingRef}
                        tabIndex={-1}
                        className="focus-visible:outline-none"
                    >
                        {intl.formatMessage(messages.title)}
                    </h2>
                </CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {catalog.isError ? (
                    <p className="text-sm text-destructive">
                        {intl.formatMessage(messages.loadError)}
                    </p>
                ) : null}

                {canUpdate ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setAddCollectionsOpen(true)}
                            disabled={catalog.isPending || catalog.isError}
                        >
                            <Plus className="size-4" />
                            {intl.formatMessage(messages.addCollections)}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setAddPagesOpen(true)}
                            disabled={catalog.isPending || catalog.isError}
                        >
                            <Plus className="size-4" />
                            {intl.formatMessage(messages.addPages)}
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.readOnly)}
                    </p>
                )}

                {catalog.isPending && granted.length === 0 ? (
                    <p className="flex items-center gap-2 rounded-xl border px-3 py-4 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
                    </p>
                ) : (
                    <>
                        <GrantedContentGroup
                            heading={intl.formatMessage(messages.collections)}
                            items={grantedCollections}
                            emptyLabel={intl.formatMessage(
                                messages.collectionsEmpty
                            )}
                            canRemove={canUpdate}
                            onRemove={setPendingRemoval}
                        />
                        <GrantedContentGroup
                            heading={intl.formatMessage(messages.pages)}
                            items={grantedPages}
                            emptyLabel={intl.formatMessage(messages.pagesEmpty)}
                            canRemove={canUpdate}
                            onRemove={setPendingRemoval}
                        />
                    </>
                )}
            </CardContent>

            <AddContentDialog
                open={addCollectionsOpen}
                onOpenChange={setAddCollectionsOpen}
                title={intl.formatMessage(messages.addCollections)}
                description={intl.formatMessage(messages.addCollectionsBody)}
                available={availableCollections}
                sharedGroups={sharedCollections}
                sharedError={sources.isError}
                onConfirm={async (choices) => {
                    if (await grant(choices)) setAddCollectionsOpen(false);
                }}
                busy={addContent.isPending}
            />

            <AddContentDialog
                open={addPagesOpen}
                onOpenChange={setAddPagesOpen}
                title={intl.formatMessage(messages.addPages)}
                description={intl.formatMessage(messages.addPagesBody)}
                available={availablePages}
                sharedGroups={sharedPages}
                sharedError={sources.isError}
                onConfirm={async (choices) => {
                    if (await grant(choices)) setAddPagesOpen(false);
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
        </Card>
    );
}
