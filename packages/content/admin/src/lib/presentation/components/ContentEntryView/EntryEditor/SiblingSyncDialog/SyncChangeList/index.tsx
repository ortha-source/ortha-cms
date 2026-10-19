import { defineMessages, useIntl } from 'react-intl';
import type {
    InvalidatedSibling,
    SyncChange
} from '../../../../../../infrastructure/entryIssues';
import { SyncChangeItem } from './SyncChangeItem';

const messages = defineMessages({
    region: {
        id: 'content.editor.siblingSync.changes',
        defaultMessage: 'What else changes'
    }
});

/** Props for {@link SyncChangeList}. */
export type SyncChangeListProps = {
    changes: SyncChange[];
    /** The published rows the write would leave incomplete. */
    invalidated: InvalidatedSibling[];
    /** Optional rows the person unticked, by entry id. */
    skipped: ReadonlySet<string>;
    onToggle: (entryId: string, included: boolean) => void;
    /** A locale slug's display name. */
    localeName: (slug: string) => string;
};

/**
 * The preview inside {@link SiblingSyncDialog}: one item per other row the
 * write reaches — the record's own translations first, then other records.
 *
 * A focusable, labelled region because it scrolls: a long list of records
 * would otherwise be a scroll box a keyboard could not reach.
 */
export function SyncChangeList({
    changes,
    invalidated,
    skipped,
    onToggle,
    localeName
}: SyncChangeListProps) {
    const intl = useIntl();
    const ordered = [
        ...changes.filter((change) => change.sibling),
        ...changes.filter((change) => !change.sibling)
    ];
    return (
        <div
            role="region"
            aria-label={intl.formatMessage(messages.region)}
            tabIndex={0}
            className="max-h-[50vh] overflow-y-auto rounded-md border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <ul className="divide-y">
                {ordered.map((change) => (
                    <SyncChangeItem
                        key={change.entryId}
                        change={change}
                        incomplete={invalidated.some(
                            (row) =>
                                row.entryId === change.entryId ||
                                (!row.entryId &&
                                    change.sibling &&
                                    row.locale === change.locale)
                        )}
                        included={!skipped.has(change.entryId)}
                        onToggle={(included) =>
                            onToggle(change.entryId, included)
                        }
                        localeName={localeName}
                    />
                ))}
            </ul>
        </div>
    );
}
