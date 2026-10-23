import { defineMessages, useIntl } from 'react-intl';
import { FileText, Layers, TriangleAlert, X } from 'lucide-react';
import { Badge, Button, cn } from '@orthacms/design-system';
import { useWorkspaceContentCount } from '../../../../application/useWorkspaceContentCount';
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
    },
    entries: {
        id: 'workspaces.settings.content.entries',
        defaultMessage: '{count, plural, one {# entry} other {# entries}}'
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
export { grantKey } from '../../../../domain/grantKey';

/** Props for {@link GrantedContentRow}. */
export type GrantedContentRowProps = {
    /** The granted content to render. */
    granted: GrantedContent;
    /** Whether a remove control should be offered. */
    canRemove: boolean;
    /** Called when the remove control is pressed. */
    onRemove: () => void;
    /** The workspace the grant belongs to — whose entries an own row counts. */
    workspaceId: string;
    /** Extra classes for the row (the list's just-granted highlight). */
    className?: string;
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
 * One row in the granted-content list: an icon tile by kind, the type's label
 * over its kind (and, for a grant from a shared workspace, where its records
 * come from), how many entries an **own** grant holds here, and — when the user
 * may manage content — a remove button. The group the row sits in names the
 * source, so the label is the type alone; the remove button still names both,
 * since it is read out of context. An **Unavailable** badge marks a shared
 * grant whose workspace no longer shares.
 */
export function GrantedContentRow({
    granted,
    canRemove,
    onRemove,
    workspaceId,
    className
}: GrantedContentRowProps) {
    const intl = useIntl();
    const grantLabel = useGrantLabel();
    const { type, shared } = granted;
    const label = grantLabel(granted);
    const typeLabel = type?.label ?? type?.name ?? granted.slug;
    const isCollection = shared ? shared.kind !== 'single' : !isPage(type);
    const kind = intl.formatMessage(
        isCollection ? messages.collection : messages.single
    );
    const hint = shared
        ? intl.formatMessage(
              shared.available ? messages.sharedHint : messages.unavailableHint,
              { workspace: shared.sourceWorkspaceName }
          )
        : type?.description;
    // A shared grant's records live at the source; there is nothing to count.
    const count = useWorkspaceContentCount(
        workspaceId,
        granted.slug,
        !shared,
        'summary'
    );

    return (
        <div
            className={cn(
                'flex min-h-[52px] items-center gap-3 px-4 py-2',
                className
            )}
        >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {isCollection ? (
                    <Layers className="size-4" aria-hidden />
                ) : (
                    <FileText className="size-4" aria-hidden />
                )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                        {typeLabel}
                    </span>
                    {shared && !shared.available ? (
                        <Badge variant="warning" size="xs">
                            <TriangleAlert className="size-3" aria-hidden />
                            {intl.formatMessage(messages.unavailableBadge)}
                        </Badge>
                    ) : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {hint ? `${kind} · ${hint}` : kind}
                </span>
            </div>
            {!shared && count.data !== undefined ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {intl.formatMessage(messages.entries, {
                        count: count.data
                    })}
                </span>
            ) : null}
            {canRemove ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRemove}
                    aria-label={intl.formatMessage(messages.remove, { label })}
                >
                    <X className="size-4" aria-hidden />
                </Button>
            ) : null}
        </div>
    );
}
