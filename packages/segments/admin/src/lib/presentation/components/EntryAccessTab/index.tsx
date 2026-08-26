import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import type { EntryTabContext } from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Spinner,
    toast
} from '@orthacms/design-system';
import { useEntryAccess } from '../../../application/useEntryAccess';
import { useAccessRules } from '../../../application/useAccessRules';
import {
    useAssignRule,
    useUnassignRule
} from '../../../application/useAssignmentMutations';
import { EntryAccessChain } from '../EntryAccessChain';
import { ExplainPanel } from './ExplainPanel';

const messages = defineMessages({
    heading: {
        id: 'segments.entryTab.heading',
        defaultMessage: 'Who reads this'
    },
    body: {
        id: 'segments.entryTab.body',
        defaultMessage:
            'Rules from this workspace and this collection already apply. Setting one here narrows it further — the levels merge, they do not replace each other.'
    },
    ownRule: {
        id: 'segments.entryTab.ownRule',
        defaultMessage: 'This entry’s own rule'
    },
    none: { id: 'segments.entryTab.none', defaultMessage: 'None' },
    pick: {
        id: 'segments.entryTab.pick',
        defaultMessage: 'Choose a rule…'
    },
    unpublished: {
        id: 'segments.entryTab.unpublished',
        defaultMessage:
            'Save the entry first — a rule attaches to an entry that exists.'
    },
    manage: {
        id: 'segments.entryTab.manage',
        defaultMessage: 'Manage rules'
    },
    notConfigured: {
        id: 'segments.entryTab.notConfigured',
        defaultMessage:
            'Nothing is segmented in this installation, so every published entry is readable by everyone.'
    },
    readOnly: {
        id: 'segments.entryTab.readOnly',
        defaultMessage:
            'You can see what applies here, but changing it needs the “access:manage” permission.'
    },
    assigned: {
        id: 'segments.entryTab.assigned',
        defaultMessage:
            'Applied — readers are already being served the new answer'
    },
    cleared: {
        id: 'segments.entryTab.cleared',
        defaultMessage:
            'Removed — this entry now inherits only the levels above'
    },
    error: {
        id: 'segments.entryTab.error',
        defaultMessage: 'Couldn’t save that. Please try again.'
    }
});

/** The sentinel `Select` value for "no rule of its own". */
const NO_RULE = '__none__';

/**
 * The entry editor's **Access** tab.
 *
 * A tab rather than another block in the properties rail, and the mockups are
 * what settled it: access is a workbench, not a property. It carries a rule
 * picker, the inheritance chain, and a simulator — and the rail is a column of
 * one-line facts that a three-part surface turns into a scrolling column nobody
 * can scan. The rail keeps the *chip*; the work happens here.
 *
 * Assigning replaces whatever rule was on this entry rather than adding to it:
 * one rule governs a level, and two would make "which applies here" an ordering
 * question no editor could predict. The workspace and collection levels are
 * untouched by anything on this tab — they are shown so it is clear what this
 * choice is being added *to*.
 */
export function EntryAccessTab({
    workspaceId,
    schema,
    entry,
    readOnly
}: EntryTabContext) {
    const intl = useIntl();
    // Two gates, and they are not the same one. `readOnly` says the caller may
    // not edit this entry's *values*; `access:manage` says they may not change
    // who reads it. An editor with `content:update` and no `access:manage` can
    // rewrite the article and must not be able to publish it to a different
    // audience.
    const canManage = useHasPermission('access:manage');
    const { access, configured, isPending, canRead } = useEntryAccess({
        workspaceId,
        typeSlug: schema.name,
        entryId: entry?.id
    });
    const rules = useAccessRules(workspaceId, canRead);
    const assign = useAssignRule(workspaceId);
    const unassign = useUnassignRule(workspaceId);

    if (!canRead) {
        return null;
    }

    if (isPending || !access) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (!configured) {
        return (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.notConfigured)}
            </p>
        );
    }

    const busy = assign.isPending || unassign.isPending;
    const currentRuleId = access.own?.assignment.ruleId ?? NO_RULE;
    const failed = () => toast.error(intl.formatMessage(messages.error));

    const change = (value: string) => {
        if (!entry) return;
        if (value === NO_RULE) {
            if (!access.own) return;
            unassign.mutate(access.own.assignment.id, {
                onSuccess: () =>
                    toast.success(intl.formatMessage(messages.cleared)),
                onError: failed
            });
            return;
        }
        assign.mutate(
            {
                ruleId: value,
                target: {
                    kind: 'entry',
                    typeSlug: schema.name,
                    entryId: entry.id
                }
            },
            {
                onSuccess: () =>
                    toast.success(intl.formatMessage(messages.assigned)),
                onError: failed
            }
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <section>
                <h3 className="text-sm font-semibold">
                    {intl.formatMessage(messages.heading)}
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                    {intl.formatMessage(messages.body)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="entry-access-rule"
                            className="text-sm font-medium"
                        >
                            {intl.formatMessage(messages.ownRule)}
                        </label>
                        <Select
                            value={currentRuleId}
                            disabled={readOnly || !canManage || busy || !entry}
                            onValueChange={change}
                        >
                            <SelectTrigger
                                id="entry-access-rule"
                                className="w-72"
                            >
                                <SelectValue
                                    placeholder={intl.formatMessage(
                                        messages.pick
                                    )}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_RULE}>
                                    {intl.formatMessage(messages.none)}
                                </SelectItem>
                                {(rules.data ?? []).map((rule) => (
                                    <SelectItem key={rule.id} value={rule.id}>
                                        {rule.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {busy ? <Spinner /> : null}
                    <Button variant="ghost" size="sm" asChild>
                        <Link to={`/workspaces/${workspaceId}/access`}>
                            <ShieldCheck aria-hidden />
                            {intl.formatMessage(messages.manage)}
                        </Link>
                    </Button>
                </div>

                {!entry ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.unpublished)}
                    </p>
                ) : !canManage ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.readOnly)}
                    </p>
                ) : null}
            </section>

            {access.levels.length > 0 ? (
                <section className="rounded-xl border bg-card p-4 shadow-xs">
                    <EntryAccessChain access={access} />
                </section>
            ) : null}

            {entry ? (
                <ExplainPanel typeSlug={schema.name} entryId={entry.id} />
            ) : null}
        </div>
    );
}
