import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@orthacms/design-system';
import type {
    InvalidatedSibling,
    SyncChange
} from '../../../../../../infrastructure/entryIssues';
import { SyncChangeItem } from './SyncChangeItem';

const messages = defineMessages({
    region: {
        id: 'content.editor.siblingSync.changes',
        defaultMessage: 'What else changes'
    },
    expandAll: {
        id: 'content.editor.siblingSync.expandAll',
        defaultMessage: 'Expand all'
    },
    collapseAll: {
        id: 'content.editor.siblingSync.collapseAll',
        defaultMessage: 'Collapse all'
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
    /** A record's own editor, by type and id — absent outside an editor. */
    hrefFor?: (typeName: string, id: string) => string;
};

/**
 * The preview inside {@link SiblingSyncDialog}: one item per other row the
 * write reaches — the record's own translations first, then other records.
 *
 * A focusable, labelled region because it scrolls: a long list of records
 * would otherwise be a scroll box a keyboard could not reach.
 *
 * Each item folds its details. A lone row opens unfolded — there is nothing
 * to skim past — while several start folded, each heading saying how much it
 * holds, with **Expand all / Collapse all** above them. Which rows are open
 * is reset whenever a new set of changes arrives.
 */
export function SyncChangeList({
    changes,
    invalidated,
    skipped,
    onToggle,
    localeName,
    hrefFor
}: SyncChangeListProps) {
    const intl = useIntl();
    const ordered = [
        ...changes.filter((change) => change.sibling),
        ...changes.filter((change) => !change.sibling)
    ];
    // A lone row opens unfolded; several start folded. Reset per refusal.
    const initiallyOpen = (rows: SyncChange[]): ReadonlySet<string> =>
        new Set(rows.length === 1 ? [rows[0].entryId] : []);
    const [open, setOpen] = useState(() => initiallyOpen(changes));
    useEffect(() => setOpen(initiallyOpen(changes)), [changes]);
    const allOpen = ordered.every((change) => open.has(change.entryId));
    const setRow = (entryId: string, next: boolean) =>
        setOpen((current) => {
            const updated = new Set(current);
            if (next) updated.add(entryId);
            else updated.delete(entryId);
            return updated;
        });
    return (
        <div className="space-y-1.5">
            {ordered.length > 1 ? (
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                            setOpen(
                                allOpen
                                    ? new Set()
                                    : new Set(ordered.map((c) => c.entryId))
                            )
                        }
                    >
                        {intl.formatMessage(
                            allOpen ? messages.collapseAll : messages.expandAll
                        )}
                    </Button>
                </div>
            ) : null}
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
                            hrefFor={hrefFor}
                            open={open.has(change.entryId)}
                            onOpenChange={(next) =>
                                setRow(change.entryId, next)
                            }
                        />
                    ))}
                </ul>
            </div>
        </div>
    );
}
