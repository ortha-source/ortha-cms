import { useMemo, useRef, useState } from 'react';
import { FileText, Table2 } from 'lucide-react';
import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@orthacms/identity-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useContentTypes } from '@orthacms/content-admin';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    SkeletonRegion,
    Skeleton
} from '@orthacms/design-system';
import { protectedTypeRows } from '../../../domain/protectedTypeRows';
import type { ProtectedTypeRow, ProtectionRule } from '../../../domain/types';
import { readRule } from '../../../domain/ruleSummary';
import { useProtectionRules } from '../../../application/hooks';
import { RuleEditorDialog } from './RuleEditorDialog';

const messages = defineMessages({
    loading: {
        id: 'protection.settings.loading',
        defaultMessage: 'Loading protection rules'
    },
    deniedTitle: {
        id: 'protection.settings.deniedTitle',
        defaultMessage: 'You cannot manage protection'
    },
    deniedBody: {
        id: 'protection.settings.deniedBody',
        defaultMessage:
            'Managing protection rules is an administrator’s job. You can still see whether an entry needs review from the entry itself.'
    },
    errorTitle: {
        id: 'protection.settings.errorTitle',
        defaultMessage: 'Protection rules could not be loaded'
    },
    errorBody: {
        id: 'protection.settings.errorBody',
        defaultMessage:
            'This is not the same as “nothing is protected” — try again in a moment.'
    },
    emptyTitle: {
        id: 'protection.settings.emptyTitle',
        defaultMessage: 'No publishable content types'
    },
    emptyBody: {
        id: 'protection.settings.emptyBody',
        defaultMessage:
            'Protection guards the step from draft to published, so it applies only to types that have one. Grant this workspace a publishable type on the Content tab.'
    },
    unprotected: {
        id: 'protection.settings.unprotected',
        defaultMessage: 'Not protected'
    },
    off: { id: 'protection.settings.off', defaultMessage: 'Switched off' },
    approvals: {
        id: 'protection.settings.approvals',
        defaultMessage: '{count, plural, one {# approval} other {# approvals}}'
    },
    configure: {
        id: 'protection.settings.configure',
        defaultMessage: 'Configure'
    },
    configureFor: {
        id: 'protection.settings.configureFor',
        defaultMessage: 'Configure protection for {label}'
    },
    orphanTitle: {
        id: 'protection.settings.orphanTitle',
        defaultMessage: 'Rules on types this workspace no longer has'
    },
    listHeading: {
        id: 'protection.settings.listHeading',
        defaultMessage: 'Publishable types'
    },
    protectedBadge: {
        id: 'protection.settings.protectedBadge',
        defaultMessage: 'Protected'
    },
    none: {
        id: 'protection.settings.none',
        defaultMessage: '—'
    },
    authorMayApprove: {
        id: 'protection.settings.summary.authorMayApprove',
        defaultMessage: 'authors may approve their own'
    },
    keepsAcrossSaves: {
        id: 'protection.settings.summary.keepsAcrossSaves',
        defaultMessage: 'approvals kept across saves'
    },
    adminsOverride: {
        id: 'protection.settings.summary.adminBypass',
        defaultMessage: 'admins may bypass'
    },
    tokensPublish: {
        id: 'protection.settings.summary.tokenPublish',
        defaultMessage: 'API tokens may publish'
    },
    orphanBody: {
        id: 'protection.settings.orphanBody',
        defaultMessage:
            'These rules protect content types the workspace was granted once. They do nothing now, and removing the grant did not remove them.'
    }
});

/**
 * The workspace settings **Publishing** section: every publishable type the
 * workspace holds in one framed list — its name, its rule in a few words (the
 * count, then each way it is loosened; "—" when none is in force), a Protected
 * / Not protected / Switched off badge, and Configure — then any rule left on a
 * type the workspace no longer has. The settings page draws the `<h1>` and
 * description from the slot item.
 *
 * **The list is the workspace's content grants, not its rules.** A rule is
 * addressed by `(workspace, kind, slug)` — the same pair `workspace_content`
 * grants — so there is no type picker here and nothing to keep in step: a type
 * appears because the workspace may work with it, and its rule is a property of
 * the row rather than the reason for it.
 *
 * Everything is `protection:manage`, administrator-only, and that includes the
 * **read**: the list route is gated the same way the writes are, because nobody
 * but an administrator needs the rule table. A member without it is told so
 * rather than shown an empty list they would read as "nothing is protected".
 */
export function ProtectionSettings() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canManage = useHasPermission('protection:manage');
    const rules = useProtectionRules(workspace.id, canManage);
    const types = useContentTypes();
    const [editing, setEditing] = useState<ProtectedTypeRow | null>(null);
    // Captured on the click rather than read off Radix: the dialog unmounts
    // with `editing`, so its own restore never runs.
    const trigger = useRef<HTMLElement | null>(null);

    const { rows, orphans } = useMemo(
        () =>
            protectedTypeRows(
                workspace.content,
                types.data ?? [],
                rules.data ?? []
            ),
        [workspace.content, types.data, rules.data]
    );

    if (!canManage) {
        return (
            <Alert>
                <AlertTitle>
                    {intl.formatMessage(messages.deniedTitle)}
                </AlertTitle>
                <AlertDescription>
                    {intl.formatMessage(messages.deniedBody)}
                </AlertDescription>
            </Alert>
        );
    }

    if (rules.isPending || types.isPending) {
        return (
            <SkeletonRegion label={intl.formatMessage(messages.loading)}>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="mt-2 h-24 w-full" />
            </SkeletonRegion>
        );
    }

    // A failed read is not an empty one: "nothing is protected" is a claim
    // about the workspace, and making it when the truth is "we could not ask"
    // is how somebody concludes a rule they set is gone.
    if (rules.isError || types.isError) {
        return (
            <Alert variant="destructive">
                <AlertTitle>
                    {intl.formatMessage(messages.errorTitle)}
                </AlertTitle>
                <AlertDescription>
                    {intl.formatMessage(messages.errorBody)}
                </AlertDescription>
            </Alert>
        );
    }

    /**
     * The rule in one line: the count, then each way it is loosened — the same
     * reading as the editor's "In short" sentence, cut to fit a row. A type
     * with no rule in force says nothing ("—"), the badge beside it saying why.
     */
    const summarize = (rule: ProtectionRule | null) => {
        const reading = readRule(rule);
        if (reading.kind === 'off') return intl.formatMessage(messages.none);
        return [
            intl.formatMessage(messages.approvals, { count: reading.count }),
            ...reading.exceptions.map((exception) =>
                intl.formatMessage(messages[exception])
            )
        ].join(' · ');
    };

    return (
        <>
            <div className="overflow-hidden rounded-xl border bg-card">
                {rows.length === 0 ? (
                    <div className="px-4 py-5">
                        <p className="text-sm font-medium">
                            {intl.formatMessage(messages.emptyTitle)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {intl.formatMessage(messages.emptyBody)}
                        </p>
                    </div>
                ) : (
                    <ul
                        aria-label={intl.formatMessage(messages.listHeading)}
                        className="divide-y"
                    >
                        {rows.map((row) => (
                            <li
                                key={row.slug}
                                className="flex min-h-12 items-center gap-3 px-4 py-2"
                            >
                                {row.kind === 'single' ? (
                                    <FileText
                                        className="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                ) : (
                                    <Table2
                                        className="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                )}
                                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
                                    <span className="truncate text-sm font-medium">
                                        {row.label}
                                    </span>
                                    <span className="truncate text-[13px] text-muted-foreground">
                                        {summarize(row.rule)}
                                    </span>
                                </div>
                                {/* Text, never colour alone. */}
                                <Badge
                                    size="xs"
                                    variant={
                                        row.rule?.enabled ? 'success' : 'muted'
                                    }
                                >
                                    {intl.formatMessage(
                                        row.rule?.enabled
                                            ? messages.protectedBadge
                                            : row.rule
                                              ? messages.off
                                              : messages.unprotected
                                    )}
                                </Badge>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(event) => {
                                        trigger.current = event.currentTarget;
                                        setEditing(row);
                                    }}
                                    aria-label={intl.formatMessage(
                                        messages.configureFor,
                                        { label: row.label }
                                    )}
                                >
                                    {intl.formatMessage(messages.configure)}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {orphans.length > 0 ? (
                <div className="overflow-hidden rounded-xl border bg-card">
                    <div className="flex flex-col gap-0.5 border-b bg-muted/40 px-4 py-2">
                        <span className="text-xs font-medium text-muted-foreground">
                            {intl.formatMessage(messages.orphanTitle)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.orphanBody)}
                        </span>
                    </div>
                    <ul
                        aria-label={intl.formatMessage(messages.orphanTitle)}
                        className="divide-y"
                    >
                        {orphans.map((rule) => (
                            <li
                                key={rule.id}
                                className="flex min-h-[52px] items-center gap-3 px-4 py-2"
                            >
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-mono text-sm">
                                        {rule.slug}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {rule.kind} ·{' '}
                                        {rule.enabled
                                            ? summarize(rule)
                                            : intl.formatMessage(messages.off)}
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(event) => {
                                        trigger.current = event.currentTarget;
                                        setEditing({
                                            slug: rule.slug,
                                            kind: rule.kind,
                                            label: rule.slug,
                                            rule
                                        });
                                    }}
                                >
                                    {intl.formatMessage(messages.configure)}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {editing ? (
                <RuleEditorDialog
                    open
                    onOpenChange={(next) => !next && setEditing(null)}
                    row={editing}
                    workspaceId={workspace.id}
                    memberCount={workspace.members.length}
                    canManage={canManage}
                    returnFocusTo={trigger}
                />
            ) : null}
        </>
    );
}
