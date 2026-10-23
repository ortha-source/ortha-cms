import { useMemo } from 'react';
import { useIntl, defineMessages } from 'react-intl';
import type {
    EntrySlotContext,
    EntryStatusItem
} from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useFindingsByEntry } from '../../../application/useFindingsByEntry';

const messages = defineMessages({
    label: {
        id: 'alarms.status.label',
        defaultMessage:
            '{count, plural, one {# check flagged} other {# checks flagged}}'
    }
});

/**
 * The record's open check findings as **one status item** in the entry
 * editor's header (content-admin's `ENTRY_STATUS_ITEM_SLOT`) — so a flag is
 * seen without opening the Details panel, where the full Checks block still
 * lists them.
 *
 * A finding never blocks publishing (alarms are non-blocking by design), so
 * the item is a heads-up: **warning** when any open finding is an error,
 * **info** otherwise — and info never takes a header chip while something
 * does block, so a flag never crowds out what must be fixed.
 *
 * Shares `useFindingsByEntry`'s key with the Checks block, so it costs no
 * request of its own.
 */
export function useAlarmsStatusItem({
    entry,
    isCreate
}: EntrySlotContext): EntryStatusItem | null {
    const intl = useIntl();
    const canRead = useHasPermission('alarms:read');
    const entryIds = useMemo(
        () => (entry?.id && !isCreate ? [entry.id] : []),
        [entry?.id, isCreate]
    );
    const { data } = useFindingsByEntry(
        entryIds,
        canRead && entryIds.length > 0
    );
    if (!canRead || !entry?.id) return null;
    const open = (data?.[entry.id] ?? []).filter(
        (finding) => finding.state === 'open'
    );
    if (open.length === 0) return null;
    return {
        id: 'alarms.findings',
        severity: open.some((finding) => finding.severity === 'error')
            ? 'warning'
            : 'info',
        label: intl.formatMessage(messages.label, { count: open.length }),
        detail: open.map((finding) => finding.title).join(' · ')
    };
}
