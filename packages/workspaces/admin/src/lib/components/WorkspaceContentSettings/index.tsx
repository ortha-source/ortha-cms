import { Fragment, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    ConfirmDialog,
    Separator,
    Spinner,
    toast
} from '@ortha-cms/design-system';
import { ApiError } from '@ortha-cms/utils-admin';
import type { Workspace } from '../../types/workspace';
import type { ContentType } from '../../types/wizard';
import { useContentTypes } from '../../api/useContentTypes';
import { useAddWorkspaceContent } from '../../api/useAddWorkspaceContent';
import { useRemoveWorkspaceContent } from '../../api/useRemoveWorkspaceContent';
import { ContentTypePicker } from './ContentTypePicker';
import { GrantedContentRow, type GrantedContent } from './GrantedContentRow';

/** HTTP 409 — the server's "content type still has entries" response. */
const CONFLICT = 409;

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
    empty: {
        id: 'workspaces.settings.content.empty',
        defaultMessage:
            'No content types yet. Add one so the Content Library has something to show.'
    },
    listLabel: {
        id: 'workspaces.settings.content.listLabel',
        defaultMessage: '{count, plural, one {# content type} other {# content types}}'
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
        defaultMessage: 'Content type added.'
    },
    addError: {
        id: 'workspaces.settings.content.addError',
        defaultMessage: 'Couldn’t add that content type. Please try again.'
    },
    removed: {
        id: 'workspaces.settings.content.removed',
        defaultMessage: 'Content type removed.'
    },
    removeError: {
        id: 'workspaces.settings.content.removeError',
        defaultMessage: 'Couldn’t remove that content type. Please try again.'
    },
    notEmpty: {
        id: 'workspaces.settings.content.notEmpty',
        defaultMessage:
            'This content type still has entries in the workspace. Delete them first, then remove it.'
    },
    confirmTitle: {
        id: 'workspaces.settings.content.confirmTitle',
        defaultMessage: 'Remove content type?'
    },
    confirmBody: {
        id: 'workspaces.settings.content.confirmBody',
        defaultMessage:
            'The workspace will lose access to “{label}”. This is only allowed while it has no entries here; existing records elsewhere are untouched.'
    },
    confirmAction: {
        id: 'workspaces.settings.content.confirmAction',
        defaultMessage: 'Remove'
    }
});

/** Props for {@link WorkspaceContentSettings}. */
export type WorkspaceContentSettingsProps = {
    /** The workspace whose content grants are managed. */
    workspace: Workspace;
    /** Whether the current user may manage content (holds `workspaces:update`). */
    canUpdate: boolean;
};

/**
 * The Content-types settings tab: grant a workspace access to code-defined
 * collections/pages and revoke access. A revoke is only allowed when the type
 * holds no entries in the workspace — the server enforces it (409), surfaced
 * here as a clear message. Gated on `workspaces:update`.
 */
export function WorkspaceContentSettings({
    workspace,
    canUpdate
}: WorkspaceContentSettingsProps) {
    const intl = useIntl();
    const catalog = useContentTypes();
    const addContent = useAddWorkspaceContent();
    const removeContent = useRemoveWorkspaceContent();
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
    const granted: GrantedContent[] = workspace.content.map((slug) => ({
        slug,
        type: byName.get(slug)
    }));
    const available = types.filter((type) => !grantedSet.has(type.name));

    const onAdd = async (slug: string) => {
        try {
            await addContent.mutateAsync({ workspaceId: workspace.id, slug });
            toast(intl.formatMessage(messages.added));
        } catch {
            toast(intl.formatMessage(messages.addError));
        }
    };

    const confirmRemoval = async () => {
        if (!pendingRemoval) return;
        const { slug } = pendingRemoval;
        try {
            await removeContent.mutateAsync({
                workspaceId: workspace.id,
                slug
            });
            toast(intl.formatMessage(messages.removed));
        } catch (error) {
            // A 409 means the type still has entries in the workspace — an
            // expected outcome with its own message; anything else is a failure.
            toast(
                intl.formatMessage(
                    error instanceof ApiError && error.status === CONFLICT
                        ? messages.notEmpty
                        : messages.removeError
                )
            );
        } finally {
            setPendingRemoval(null);
        }
    };

    const removalLabel =
        pendingRemoval?.type?.label ??
        pendingRemoval?.type?.name ??
        pendingRemoval?.slug ??
        '';

    return (
        <Card>
            <CardHeader>
                <CardTitle>{intl.formatMessage(messages.title)}</CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {catalog.isError ? (
                    <p className="text-sm text-destructive">
                        {intl.formatMessage(messages.loadError)}
                    </p>
                ) : null}

                {canUpdate ? (
                    <div>
                        <ContentTypePicker
                            available={available}
                            onAdd={onAdd}
                            busy={addContent.isPending || catalog.isPending}
                        />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.readOnly)}
                    </p>
                )}

                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                        {intl.formatMessage(messages.listLabel, {
                            count: granted.length
                        })}
                    </span>
                    {catalog.isPending && granted.length === 0 ? (
                        <p className="flex items-center gap-2 rounded-xl border px-3 py-4 text-sm text-muted-foreground">
                            <Spinner className="size-4" />
                        </p>
                    ) : granted.length === 0 ? (
                        <p className="rounded-xl border px-3 py-4 text-sm text-muted-foreground">
                            {intl.formatMessage(messages.empty)}
                        </p>
                    ) : (
                        <div className="rounded-xl border">
                            {granted.map((item, index) => (
                                <Fragment key={item.slug}>
                                    {index > 0 ? <Separator /> : null}
                                    <GrantedContentRow
                                        granted={item}
                                        canRemove={canUpdate}
                                        onRemove={() => setPendingRemoval(item)}
                                    />
                                </Fragment>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>

            <ConfirmDialog
                open={pendingRemoval !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingRemoval(null);
                }}
                title={intl.formatMessage(messages.confirmTitle)}
                description={intl.formatMessage(messages.confirmBody, {
                    label: removalLabel
                })}
                confirmLabel={intl.formatMessage(messages.confirmAction)}
                confirmVariant="destructive"
                busy={removeContent.isPending}
                onConfirm={confirmRemoval}
            />
        </Card>
    );
}
