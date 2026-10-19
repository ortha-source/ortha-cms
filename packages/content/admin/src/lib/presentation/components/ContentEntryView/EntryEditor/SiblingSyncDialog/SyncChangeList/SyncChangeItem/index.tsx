import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Badge, Checkbox } from '@orthacms/design-system';
import type { RelationRef } from '../../../../../../../domain/types/contentType';
import { formatSyncValue } from '../../../../../../../domain/syncChangeValue';
import type { SyncChange } from '../../../../../../../infrastructure/entryIssues';

const messages = defineMessages({
    otherRecord: {
        id: 'content.editor.siblingSync.otherRecord',
        defaultMessage: '{type}: {title}'
    },
    untitled: {
        id: 'content.editor.siblingSync.untitled',
        defaultMessage: 'Untitled'
    },
    published: {
        id: 'content.editor.siblingSync.published',
        defaultMessage: 'Published · becomes Modified'
    },
    incomplete: {
        id: 'content.editor.siblingSync.incomplete',
        defaultMessage: 'Left incomplete'
    },
    changed: {
        id: 'content.editor.siblingSync.changed',
        defaultMessage: '{label}: changed'
    },
    value: {
        id: 'content.editor.siblingSync.value',
        defaultMessage: '{label}: {before} → {after}'
    },
    empty: {
        id: 'content.editor.siblingSync.empty',
        defaultMessage: '—'
    },
    added: {
        id: 'content.editor.siblingSync.added',
        defaultMessage: '{label}: + {records}'
    },
    removed: {
        id: 'content.editor.siblingSync.removed',
        defaultMessage: '{label}: − {records}'
    },
    unresolved: {
        id: 'content.editor.siblingSync.unresolved',
        defaultMessage:
            '{records} {count, plural, one {has} other {have}} no {locale} translation, so {count, plural, one {it isn’t} other {they aren’t}} linked here'
    },
    unavailable: {
        id: 'content.editor.siblingSync.unavailable',
        defaultMessage: 'an unavailable record'
    },
    include: {
        id: 'content.editor.siblingSync.include',
        defaultMessage: 'Change {name}'
    }
});

/** Props for {@link SyncChangeItem}. */
export type SyncChangeItemProps = {
    change: SyncChange;
    /** A published row the write would leave incomplete. */
    incomplete: boolean;
    /** Whether an optional row is still ticked. */
    included: boolean;
    onToggle: (included: boolean) => void;
    localeName: (slug: string) => string;
};

/**
 * One other row in the sync preview: which row it is (a language of this
 * record, or another record in a language), whether it is published, and
 * what changes in it — values before and after, links gained and lost, and
 * the linked records it is left without for want of a translation.
 *
 * An **optional** row (a gap a new translation fills) carries a checkbox,
 * labelled by the row's heading, so a person can leave it as it is.
 */
export function SyncChangeItem({
    change,
    incomplete,
    included,
    onToggle,
    localeName
}: SyncChangeItemProps) {
    const intl = useIntl();
    const headingId = useId();
    const locale = change.locale ? localeName(change.locale) : '';
    const title = change.sibling
        ? locale
        : `${intl.formatMessage(messages.otherRecord, {
              type: change.typeLabel,
              title: change.title ?? intl.formatMessage(messages.untitled)
          })}${locale ? ` · ${locale}` : ''}`;
    const records = (refs: RelationRef[]) =>
        intl.formatList(
            refs.map((ref) =>
                ref.missing
                    ? intl.formatMessage(messages.unavailable)
                    : `“${ref.title}”`
            ),
            { type: 'conjunction' }
        );
    const shown = (value: unknown) => {
        const text = formatSyncValue(value);
        return text === '' ? intl.formatMessage(messages.empty) : text;
    };

    const lines: string[] = [];
    for (const field of change.fields) {
        const before = shown(field.before);
        const after = shown(field.after);
        lines.push(
            before === null || after === null
                ? intl.formatMessage(messages.changed, { label: field.label })
                : intl.formatMessage(messages.value, {
                      label: field.label,
                      before,
                      after
                  })
        );
    }
    const notes: string[] = [];
    for (const link of change.links) {
        if (link.added.length)
            lines.push(
                intl.formatMessage(messages.added, {
                    label: link.label,
                    records: records(link.added)
                })
            );
        if (link.removed.length)
            lines.push(
                intl.formatMessage(messages.removed, {
                    label: link.label,
                    records: records(link.removed)
                })
            );
        if (link.unresolved.length)
            notes.push(
                intl.formatMessage(messages.unresolved, {
                    records: records(link.unresolved),
                    count: link.unresolved.length,
                    locale: locale || change.locale || ''
                })
            );
    }

    return (
        <li className="flex items-start gap-3 py-3">
            {change.optional ? (
                <Checkbox
                    className="mt-0.5"
                    checked={included}
                    onCheckedChange={(next) => onToggle(next === true)}
                    aria-label={intl.formatMessage(messages.include, {
                        name: title
                    })}
                />
            ) : null}
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p id={headingId} className="text-sm font-medium">
                        {title}
                    </p>
                    {change.published ? (
                        <Badge variant="warning">
                            {intl.formatMessage(messages.published)}
                        </Badge>
                    ) : null}
                    {incomplete ? (
                        <Badge variant="destructive-soft">
                            {intl.formatMessage(messages.incomplete)}
                        </Badge>
                    ) : null}
                </div>
                <ul
                    aria-labelledby={headingId}
                    className="space-y-0.5 text-sm text-muted-foreground"
                >
                    {lines.map((line, index) => (
                        <li key={`line-${index}`} className="break-words">
                            {line}
                        </li>
                    ))}
                    {notes.map((note, index) => (
                        <li key={`note-${index}`} className="text-xs italic">
                            {note}
                        </li>
                    ))}
                </ul>
            </div>
        </li>
    );
}
