import { defineMessages, useIntl } from 'react-intl';
import { FileText, Layers, Share2, TriangleAlert, X } from 'lucide-react';
import { Badge, Button } from '@orthacms/design-system';
import type { ContentType } from '../../../../domain/types/wizard';
import type { SharedContentGrant } from '../../../../domain/types/workspace';
import { isPage } from '..';

const messages = defineMessages({
    collection: {
        id: 'workspaces.settings.content.kindCollection',
        defaultMessage: 'Collection'
    },
    single: {
        id: 'workspaces.settings.content.kindSingle',
        defaultMessage: 'Page'
    },
    remove: {
        id: 'workspaces.settings.content.remove',
        defaultMessage: 'Remove {label}'
    },
    sharedLabel: {
        id: 'workspaces.settings.content.sharedLabel',
        defaultMessage: '{type} · {workspace}'
    },
    sharedBadge: {
        id: 'workspaces.settings.content.sharedBadge',
        defaultMessage: 'Shared'
    },
    unavailableBadge: {
        id: 'workspaces.settings.content.unavailableBadge',
        defaultMessage: 'Unavailable'
    },
    unavailableHint: {
        id: 'workspaces.settings.content.unavailableHint',
        defaultMessage:
            '{workspace} no longer shares its content, so these records aren’t reachable right now.'
    },
    sharedHint: {
        id: 'workspaces.settings.content.sharedHint',
        defaultMessage: 'Read-only records from {workspace}.'
    }
});

/**
 * A granted content type resolved for display: the grant plus its catalogue
 * entry. An **own** grant has no `shared`; a grant from a shared workspace
 * carries it, and is a separate row from the own grant of the same type.
 */
export type GrantedContent = {
    /**
     * Stable identity of the grant — the slug for an own grant, the slug and
     * source for a shared one (the same type can be granted from both).
     */
    key: string;
    /** The stored grant slug. */
    slug: string;
    /** The matching catalogue type, or `undefined` for a stale/unknown slug. */
    type?: ContentType;
    /** The shared grant, when the records come from another workspace. */
    shared?: SharedContentGrant;
};

/** The `key` of a {@link GrantedContent} — one rule for rows and dialogs. */
export function grantKey(slug: string, sourceWorkspaceId?: string): string {
    return sourceWorkspaceId ? `${slug}@${sourceWorkspaceId}` : slug;
}

/** Props for {@link GrantedContentRow}. */
export type GrantedContentRowProps = {
    /** The granted content to render. */
    granted: GrantedContent;
    /** Whether a remove control should be offered. */
    canRemove: boolean;
    /** Called when the remove control is pressed. */
    onRemove: () => void;
    /** Show the kind badge; off under a Collections/Pages group heading. */
    showKind?: boolean;
};

/**
 * The label a grant is spoken and shown by: the type's label (falling back to
 * the raw slug for an unknown type), plus " · {workspace}" for a shared grant.
 */
export function useGrantLabel(): (granted: GrantedContent) => string {
    const intl = useIntl();
    return ({ slug, type, shared }) => {
        const typeLabel = type?.label ?? type?.name ?? slug;
        return shared
            ? intl.formatMessage(messages.sharedLabel, {
                  type: typeLabel,
                  workspace: shared.sourceWorkspaceName
              })
            : typeLabel;
    };
}

/**
 * One row in the granted-content list: an icon by kind, the grant's label, a
 * kind badge, and — when the user may manage content — a remove button. A
 * grant from a shared workspace reads "{Type} · {Workspace}" with a **Shared**
 * badge, and an **Unavailable** one while that workspace no longer shares.
 */
export function GrantedContentRow({
    granted,
    canRemove,
    onRemove,
    showKind = true
}: GrantedContentRowProps) {
    const intl = useIntl();
    const grantLabel = useGrantLabel();
    const { type, shared } = granted;
    const label = grantLabel(granted);
    const isCollection = shared ? shared.kind !== 'single' : !isPage(type);
    const hint = shared
        ? intl.formatMessage(
              shared.available ? messages.sharedHint : messages.unavailableHint,
              { workspace: shared.sourceWorkspaceName }
          )
        : type?.description;

    return (
        <div className="flex items-center gap-3 px-3 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {isCollection ? (
                    <Layers className="size-4" aria-hidden />
                ) : (
                    <FileText className="size-4" aria-hidden />
                )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{label}</span>
                {hint ? (
                    <span className="truncate text-xs text-muted-foreground">
                        {hint}
                    </span>
                ) : null}
            </div>
            {shared ? (
                <Badge variant="info">
                    <Share2 className="size-3" aria-hidden />
                    {intl.formatMessage(messages.sharedBadge)}
                </Badge>
            ) : null}
            {shared && !shared.available ? (
                <Badge variant="warning">
                    <TriangleAlert className="size-3" aria-hidden />
                    {intl.formatMessage(messages.unavailableBadge)}
                </Badge>
            ) : null}
            {showKind ? (
                <Badge variant="secondary">
                    {intl.formatMessage(
                        isCollection ? messages.collection : messages.single
                    )}
                </Badge>
            ) : null}
            {canRemove ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    aria-label={intl.formatMessage(messages.remove, { label })}
                >
                    <X className="size-4" aria-hidden />
                </Button>
            ) : null}
        </div>
    );
}
