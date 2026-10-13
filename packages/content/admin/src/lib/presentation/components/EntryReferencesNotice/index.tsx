import { defineMessages, useIntl } from 'react-intl';
import type {
    EntryReference,
    EntryReferenceOnPurge
} from '../../../domain/types/contentType';
import { useEntryReferences } from '../../../application/useEntryReferences';

const messages = defineMessages({
    checking: {
        id: 'content.references.checking',
        defaultMessage: 'Checking what links to this entry…'
    },
    linked: {
        id: 'content.references.linked',
        defaultMessage:
            '{total, plural, one {# record links} other {# records link}} to this entry{live, plural, =0 {} one {, # of them live} other {, # of them live}}.'
    },
    trashKeeps: {
        id: 'content.references.trashKeeps',
        defaultMessage:
            'The links are kept while it’s in the trash, but the content API stops serving it to those records. Restoring it brings the links back.'
    },
    purgeDeletes: {
        id: 'content.references.purgeDeletes',
        defaultMessage:
            'Deleting it permanently also deletes {count, plural, one {# record} other {# records}} that require it: {where}.'
    },
    purgeBlocked: {
        id: 'content.references.purgeBlocked',
        defaultMessage:
            '{count, plural, one {# record requires} other {# records require}} it ({where}), so the permanent delete will be refused until {count, plural, one {that link is} other {those links are}} removed.'
    },
    purgeUnlinks: {
        id: 'content.references.purgeUnlinks',
        defaultMessage:
            '{count, plural, one {# record loses its link} other {# records lose their link}} to it.'
    },
    where: {
        id: 'content.references.where',
        defaultMessage: '{type} · {field}'
    }
});

/** Props for {@link EntryReferencesNotice}. */
export type EntryReferencesNoticeProps = {
    /** The entry's content type. */
    typeName: string;
    /** The entry. */
    id: string;
    /** Whether the dialog it sits in is open — the read waits for it. */
    open: boolean;
    /**
     * Whether the action removes the entry **for good** (a purge, or a delete
     * on a type with no trash). Then the foreign keys decide what happens to
     * each referrer, and that is what the notice spells out.
     */
    permanent: boolean;
};

/**
 * What a delete reaches beyond the entry itself — the records in this
 * workspace that link to it — rendered as extra sentences inside a delete or
 * purge confirmation. Deleting a record used to go through with no word about
 * what pointed at it.
 *
 * - A **soft** delete keeps every link (the join rows and FKs survive), but the
 *   content API stops serving the entry to the records that link it; the notice
 *   says how many there are and how many of them are live.
 * - A **permanent** delete is decided by each foreign key: a required relation
 *   that cascades deletes the referrer too, a `restrict` one refuses the purge,
 *   anything else just drops the link. Each consequence that applies gets its
 *   own sentence, naming the type and field.
 *
 * Renders nothing when nothing links to the entry, or when the read fails — the
 * dialog's own sentence still states the plain consequence. Spans, not blocks:
 * it lives inside the dialog's description paragraph.
 */
export function EntryReferencesNotice({
    typeName,
    id,
    open,
    permanent
}: EntryReferencesNoticeProps) {
    const intl = useIntl();
    const references = useEntryReferences(typeName, id, open);

    if (references.isPending && open) {
        return (
            <span className="mt-2 block text-muted-foreground">
                {intl.formatMessage(messages.checking)}
            </span>
        );
    }
    const data = references.data;
    if (!data || data.total === 0) return null;

    const by = (kind: EntryReferenceOnPurge) =>
        data.items.filter((item) => item.onPurge === kind);
    const sum = (items: EntryReference[]) =>
        items.reduce((total, item) => total + item.count, 0);
    const where = (items: EntryReference[]) =>
        intl.formatList(
            items.map((item) =>
                intl.formatMessage(messages.where, {
                    type: item.typeLabel,
                    field: item.fieldLabel
                })
            ),
            { type: 'conjunction' }
        );

    const deletes = by('delete');
    const blocks = by('block');
    const unlinks = by('unlink');

    return (
        <span aria-live="polite" className="mt-2 block space-y-1">
            <span className="block font-medium text-foreground">
                {intl.formatMessage(messages.linked, {
                    total: data.total,
                    live: data.live
                })}
            </span>
            {permanent ? (
                <>
                    {deletes.length ? (
                        <span className="block text-destructive">
                            {intl.formatMessage(messages.purgeDeletes, {
                                count: sum(deletes),
                                where: where(deletes)
                            })}
                        </span>
                    ) : null}
                    {blocks.length ? (
                        <span className="block">
                            {intl.formatMessage(messages.purgeBlocked, {
                                count: sum(blocks),
                                where: where(blocks)
                            })}
                        </span>
                    ) : null}
                    {unlinks.length ? (
                        <span className="block">
                            {intl.formatMessage(messages.purgeUnlinks, {
                                count: sum(unlinks)
                            })}
                        </span>
                    ) : null}
                </>
            ) : (
                <span className="block">
                    {intl.formatMessage(messages.trashKeeps)}
                </span>
            )}
        </span>
    );
}
