import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Button, Spinner, toast } from '@orthacms/design-system';
import {
    EntrySidebarSection,
    type EntrySlotContext
} from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { BellOff, BellRing } from 'lucide-react';
import { useFindingsByEntry } from '../../../application/useFindingsByEntry';
import {
    useMuteFinding,
    useUnmuteFinding
} from '../../../application/useMuteFinding';
import type { AlarmFinding } from '../../../types/alarm';
import { SeverityBadge } from '../SeverityBadge';

const messages = defineMessages({
    title: { id: 'alarms.widget.title', defaultMessage: 'Checks' },
    counts: {
        id: 'alarms.widget.counts',
        defaultMessage:
            '{open, plural, =0 {Nothing flagged} one {# open} other {# open}}{muted, plural, =0 {} other { · # muted}}'
    },
    clean: {
        id: 'alarms.widget.clean',
        defaultMessage: 'No alarm flags this record.'
    },
    failed: {
        id: 'alarms.widget.failed',
        defaultMessage:
            'Checks could not be loaded, so this record has not been checked.'
    },
    mute: { id: 'alarms.widget.mute', defaultMessage: 'Mute' },
    unmute: { id: 'alarms.widget.unmute', defaultMessage: 'Unmute' },
    muteLabel: {
        id: 'alarms.widget.muteLabel',
        defaultMessage: 'Mute “{title}” on this record'
    },
    unmuteLabel: {
        id: 'alarms.widget.unmuteLabel',
        defaultMessage: 'Unmute “{title}” on this record'
    },
    muted: { id: 'alarms.widget.muted', defaultMessage: 'Muted' },
    mutePrompt: {
        id: 'alarms.widget.mutePrompt',
        defaultMessage: 'Why is this one fine? (optional)'
    },
    mutedToast: {
        id: 'alarms.widget.mutedToast',
        defaultMessage: 'Muted on this record.'
    },
    unmutedToast: {
        id: 'alarms.widget.unmutedToast',
        defaultMessage: 'Unmuted.'
    }
});

/**
 * The entry editor's checks block — findings for the record currently open.
 *
 * This is the surface the whole feature exists for. An editor never has to know
 * a rule exists: they open an article and the problem is sitting beside it, on
 * the page where it gets fixed.
 *
 * Rendered into `ENTRY_SIDEBAR_WIDGET_SLOT`, so `content-admin` needs no
 * knowledge of alarms at all. It draws no chrome of its own —
 * `EntrySidebarSection` is exported for exactly this reason, and a widget with
 * its own card border would be the one floating box in a flat rail.
 */
export function EntryAlarmsWidget({ entry, isCreate }: EntrySlotContext) {
    const intl = useIntl();
    const canRead = useHasPermission('alarms:read');
    const canManage = useHasPermission('alarms:manage');

    // A record being created has no id yet, so there is nothing to have found —
    // and no request worth making.
    const entryIds = useMemo(
        () => (entry?.id && !isCreate ? [entry.id] : []),
        [entry?.id, isCreate]
    );
    const { data, isPending, isError } = useFindingsByEntry(
        entryIds,
        canRead && entryIds.length > 0
    );
    const mute = useMuteFinding();
    const unmute = useUnmuteFinding();

    const findings = useMemo<AlarmFinding[]>(
        () => (entry?.id ? (data?.[entry.id] ?? []) : []),
        [data, entry?.id]
    );

    if (!canRead || entryIds.length === 0) return null;

    const open = findings.filter((finding) => finding.state === 'open');
    const muted = findings.filter((finding) => finding.state === 'muted');

    const onMute = (finding: AlarmFinding) => {
        // `window.prompt` rather than a dialog: the reason is one short line,
        // the rail is narrow, and a modal over the editor to type a sentence is
        // more interruption than the action is worth. A richer editor for it
        // belongs on the alarms page, where there is room.
        const reason = window.prompt(
            intl.formatMessage(messages.mutePrompt) ?? undefined
        );
        // `null` is Cancel — an empty string is a deliberate "no reason".
        if (reason === null) return;
        mute.mutate(
            {
                ruleId: finding.ruleId,
                entryId: finding.entryId,
                reason: reason || undefined
            },
            {
                onSuccess: () =>
                    toast.success(intl.formatMessage(messages.mutedToast))
            }
        );
    };

    const onUnmute = (finding: AlarmFinding) => {
        unmute.mutate(
            { ruleId: finding.ruleId, entryId: finding.entryId },
            {
                onSuccess: () =>
                    toast.success(intl.formatMessage(messages.unmutedToast))
            }
        );
    };

    return (
        <EntrySidebarSection
            title={intl.formatMessage(messages.title)}
            description={
                isPending
                    ? undefined
                    : intl.formatMessage(messages.counts, {
                          open: open.length,
                          muted: muted.length
                      })
            }
        >
            {isPending ? <Spinner /> : null}

            {isError ? (
                // Not an empty state: "nothing flagged" and "we could not check"
                // read identically, and only one of them is reassuring.
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.failed)}
                </p>
            ) : null}

            {!isPending && !isError && findings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.clean)}
                </p>
            ) : null}

            {findings.length > 0 ? (
                <ul className="flex flex-col gap-3">
                    {[...open, ...muted].map((finding) => {
                        const isMuted = finding.state === 'muted';
                        return (
                            <li
                                key={`${finding.ruleId}:${finding.entryId}`}
                                className="flex flex-col gap-1"
                            >
                                <div className="flex items-start gap-2">
                                    <SeverityBadge
                                        severity={finding.severity}
                                        className="mt-0.5 shrink-0"
                                    />
                                    <span
                                        className={
                                            isMuted
                                                ? 'text-sm text-muted-foreground'
                                                : 'text-sm font-medium'
                                        }
                                    >
                                        {finding.title}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {isMuted && finding.mutedReason
                                        ? finding.mutedReason
                                        : finding.ruleName}
                                </span>
                                {canManage ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="self-start"
                                        onClick={() =>
                                            isMuted
                                                ? onUnmute(finding)
                                                : onMute(finding)
                                        }
                                        aria-label={intl.formatMessage(
                                            isMuted
                                                ? messages.unmuteLabel
                                                : messages.muteLabel,
                                            { title: finding.title }
                                        )}
                                    >
                                        {isMuted ? (
                                            <BellRing aria-hidden="true" />
                                        ) : (
                                            <BellOff aria-hidden="true" />
                                        )}
                                        {intl.formatMessage(
                                            isMuted
                                                ? messages.unmute
                                                : messages.mute
                                        )}
                                    </Button>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </EntrySidebarSection>
    );
}
