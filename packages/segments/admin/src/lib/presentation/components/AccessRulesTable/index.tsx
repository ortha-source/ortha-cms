import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
    Badge,
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import {
    canBeDeleted,
    isGlobal,
    restrictsAnyone,
    type AccessRule
} from '../../../domain/types/accessRule';

const messages = defineMessages({
    caption: {
        id: 'segments.rules.caption',
        defaultMessage: 'Access rules available in this workspace.'
    },
    colName: { id: 'segments.rules.colName', defaultMessage: 'Rule' },
    colShape: { id: 'segments.rules.colShape', defaultMessage: 'Admits' },
    colUsage: { id: 'segments.rules.colUsage', defaultMessage: 'Applied' },
    colFallback: {
        id: 'segments.rules.colFallback',
        defaultMessage: 'Refused readers get'
    },
    global: {
        id: 'segments.rules.global',
        defaultMessage: 'Installation-wide'
    },
    open: { id: 'segments.rules.open', defaultMessage: 'Everyone' },
    groups: {
        id: 'segments.rules.groups',
        defaultMessage:
            '{count, plural, one {# group} other {# alternatives}}{excluded, plural, =0 {} other {, # excluded}}'
    },
    windowed: { id: 'segments.rules.windowed', defaultMessage: 'Time-limited' },
    usage: {
        id: 'segments.rules.usage',
        defaultMessage: '{count, plural, one {# place} other {# places}}'
    },
    unused: { id: 'segments.rules.unused', defaultMessage: 'Nowhere yet' },
    hidden: { id: 'segments.rules.hidden', defaultMessage: 'Nothing' },
    teaser: { id: 'segments.rules.teaser', defaultMessage: 'A teaser' },
    paywall: { id: 'segments.rules.paywall', defaultMessage: 'A paywall' },
    menu: { id: 'segments.rules.menu', defaultMessage: 'Actions for {name}' },
    edit: { id: 'segments.rules.edit', defaultMessage: 'Edit…' },
    view: { id: 'segments.rules.view', defaultMessage: 'View…' },
    remove: { id: 'segments.rules.remove', defaultMessage: 'Delete' },
    globalReason: {
        id: 'segments.rules.globalReason',
        defaultMessage: 'Declared above this workspace'
    },
    assignedReason: {
        id: 'segments.rules.assignedReason',
        defaultMessage:
            'Applied in {count, plural, one {# place} other {# places}} — unassign it first'
    },
    confirmTitle: {
        id: 'segments.rules.confirmTitle',
        defaultMessage: 'Delete “{name}”?'
    },
    confirmBody: {
        id: 'segments.rules.confirmBody',
        defaultMessage:
            'Nothing is assigned to it, so no reader’s access changes. The rule itself is gone for good.'
    },
    confirm: { id: 'segments.rules.confirmCta', defaultMessage: 'Delete' },
    cancel: { id: 'segments.rules.cancel', defaultMessage: 'Cancel' }
});

/** Props for {@link AccessRulesTable}. */
type AccessRulesTableProps = {
    /** The rules to render. */
    rules: readonly AccessRule[];
    /** Whether the caller holds `access:manage`. */
    canManage: boolean;
    /** Opens the editor on one rule. */
    onOpen: (rule: AccessRule) => void;
    /** Deletes a rule. */
    onDelete: (rule: AccessRule) => void;
    /** The id whose delete is in flight, if any. */
    deletingId: string | null;
};

/**
 * The rule library.
 *
 * The **Admits** column summarises the rule's shape rather than spelling it
 * out: how many alternatives, how many absolute exclusions, whether a window
 * applies. A rule's full contents do not fit in a cell and would not be read
 * there if they did — the question this table answers is "which of these is the
 * one I mean", and the editor answers the rest.
 *
 * A rule that constrains nobody is labelled **Everyone**, and that is not the
 * same as having no rule: it is a rule someone cleared, and the row is where
 * that becomes visible instead of looking like an omission.
 */
export function AccessRulesTable({
    rules,
    canManage,
    onOpen,
    onDelete,
    deletingId
}: AccessRulesTableProps) {
    const intl = useIntl();
    const [pending, setPending] = useState<AccessRule | null>(null);

    const fallbackLabel = (rule: AccessRule) =>
        rule.fallback === 'hidden'
            ? intl.formatMessage(messages.hidden)
            : rule.fallback === 'teaser'
              ? intl.formatMessage(messages.teaser)
              : intl.formatMessage(messages.paywall);

    const shape = (rule: AccessRule) => {
        if (!restrictsAnyone(rule)) {
            return intl.formatMessage(messages.open);
        }
        const excluded = Object.values(rule.exclusions).reduce(
            (total, ids) => total + ids.length,
            0
        );
        return intl.formatMessage(messages.groups, {
            count: rule.groups.length,
            excluded
        });
    };

    return (
        <>
            <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-xs">
                <Table>
                    <caption className="sr-only">
                        {intl.formatMessage(messages.caption)}
                    </caption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                {intl.formatMessage(messages.colName)}
                            </TableHead>
                            <TableHead>
                                {intl.formatMessage(messages.colShape)}
                            </TableHead>
                            <TableHead>
                                {intl.formatMessage(messages.colUsage)}
                            </TableHead>
                            <TableHead>
                                {intl.formatMessage(messages.colFallback)}
                            </TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map((rule) => {
                            const deletable = canBeDeleted(rule);
                            const global = isGlobal(rule);
                            return (
                                <TableRow key={rule.id}>
                                    <TableCell className="font-medium">
                                        <button
                                            type="button"
                                            className="text-left hover:underline"
                                            onClick={() => onOpen(rule)}
                                        >
                                            {rule.label}
                                        </button>
                                        {global ? (
                                            <Badge
                                                variant="outline"
                                                className="ml-2 align-middle"
                                            >
                                                {intl.formatMessage(
                                                    messages.global
                                                )}
                                            </Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {shape(rule)}
                                        {rule.startsAt || rule.endsAt ? (
                                            <Badge
                                                variant="secondary"
                                                className="ml-2 align-middle"
                                            >
                                                {intl.formatMessage(
                                                    messages.windowed
                                                )}
                                            </Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {rule.assignmentCount > 0
                                            ? intl.formatMessage(
                                                  messages.usage,
                                                  {
                                                      count: rule.assignmentCount
                                                  }
                                              )
                                            : intl.formatMessage(
                                                  messages.unused
                                              )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {fallbackLabel(rule)}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="ml-auto"
                                                    disabled={
                                                        deletingId === rule.id
                                                    }
                                                    aria-label={intl.formatMessage(
                                                        messages.menu,
                                                        { name: rule.label }
                                                    )}
                                                >
                                                    <MoreHorizontal
                                                        aria-hidden
                                                    />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        onOpen(rule)
                                                    }
                                                >
                                                    <Pencil aria-hidden />
                                                    {intl.formatMessage(
                                                        canManage && !global
                                                            ? messages.edit
                                                            : messages.view
                                                    )}
                                                </DropdownMenuItem>
                                                {canManage ? (
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        disabled={!deletable.ok}
                                                        title={
                                                            deletable.ok
                                                                ? undefined
                                                                : deletable.reason ===
                                                                    'global'
                                                                  ? intl.formatMessage(
                                                                        messages.globalReason
                                                                    )
                                                                  : intl.formatMessage(
                                                                        messages.assignedReason,
                                                                        {
                                                                            count: rule.assignmentCount
                                                                        }
                                                                    )
                                                        }
                                                        onSelect={() =>
                                                            setPending(rule)
                                                        }
                                                    >
                                                        <Trash2 aria-hidden />
                                                        {intl.formatMessage(
                                                            messages.remove
                                                        )}
                                                    </DropdownMenuItem>
                                                ) : null}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <ConfirmDialog
                open={pending !== null}
                onOpenChange={(open) => {
                    if (!open) setPending(null);
                }}
                busy={pending !== null && deletingId === pending.id}
                title={intl.formatMessage(messages.confirmTitle, {
                    name: pending?.label ?? ''
                })}
                description={intl.formatMessage(messages.confirmBody)}
                confirmLabel={intl.formatMessage(messages.confirm)}
                cancelLabel={intl.formatMessage(messages.cancel)}
                confirmVariant="destructive"
                onConfirm={() => {
                    if (pending) onDelete(pending);
                    setPending(null);
                }}
            />
        </>
    );
}
