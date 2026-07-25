import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@ortha-cms/design-system';
import {
    entryStatusView,
    ENTRY_STATUS_VIEW,
    type EntryStatusView
} from '../../../domain/entryStatusView';
import type { EntryRecord } from '../../../domain/types/contentType';

const messages = defineMessages({
    new: { id: 'content.status.new', defaultMessage: 'Not saved yet' },
    draft: { id: 'content.status.draft', defaultMessage: 'Draft' },
    modified: { id: 'content.status.modified', defaultMessage: 'Modified' },
    published: { id: 'content.status.published', defaultMessage: 'Published' },
    /** Only the ambiguous state needs explaining; the other three read plainly. */
    modifiedHint: {
        id: 'content.status.modifiedHint',
        defaultMessage:
            'Published, with saved changes that aren’t live yet. Publish to make them live.'
    }
});

const LABEL: Record<EntryStatusView, (typeof messages)[keyof typeof messages]> =
    {
        [ENTRY_STATUS_VIEW.New]: messages.new,
        [ENTRY_STATUS_VIEW.Draft]: messages.draft,
        [ENTRY_STATUS_VIEW.Modified]: messages.modified,
        [ENTRY_STATUS_VIEW.Published]: messages.published
    };

// Modified is `warning`, not `success`: what is live is *not* what's on screen,
// so it must not read as a clean published record.
const VARIANT: Record<
    EntryStatusView,
    'outline' | 'secondary' | 'warning' | 'success'
> = {
    [ENTRY_STATUS_VIEW.New]: 'outline',
    [ENTRY_STATUS_VIEW.Draft]: 'secondary',
    [ENTRY_STATUS_VIEW.Modified]: 'warning',
    [ENTRY_STATUS_VIEW.Published]: 'success'
};

/**
 * One record's publish state as a badge — the single rendering of
 * {@link entryStatusView}, shared by the records table's Status column and the
 * editor's Details card so the same record can't read two different ways in the
 * two places a writer looks at it.
 *
 * The label is **localized**; the table used to print the raw wire value
 * (`draft` / `published`, lowercase and untranslated), which stopped being an
 * option once a third state existed that no column value spells.
 */
export function EntryStatusBadge({
    entry,
    isCreate = false
}: {
    entry?: Pick<EntryRecord, 'status' | 'publishedAt'>;
    /**
     * Force the "not saved yet" state. A create form may carry values seeded
     * from a published sibling (the translation prefill), which would otherwise
     * read as that sibling's state for a row that doesn't exist yet.
     */
    isCreate?: boolean;
}) {
    const intl = useIntl();
    const view = isCreate ? ENTRY_STATUS_VIEW.New : entryStatusView(entry);
    return (
        <Badge
            variant={VARIANT[view]}
            title={
                view === ENTRY_STATUS_VIEW.Modified
                    ? intl.formatMessage(messages.modifiedHint)
                    : undefined
            }
        >
            {intl.formatMessage(LABEL[view])}
        </Badge>
    );
}
