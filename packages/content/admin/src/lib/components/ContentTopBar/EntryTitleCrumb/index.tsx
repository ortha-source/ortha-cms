import { useContentSchema } from '../../../api/useContentSchema';
import { useContentEntry } from '../../../api/useContentEntry';
import { relationLabel } from '../../../utils/relationLabel';

/**
 * The breadcrumb leaf for an open record: its display title, derived the same
 * way rows are titled everywhere else ({@link relationLabel} over the type's
 * fields). Subscribes to the same schema/entry queries the editor already
 * fires, so it costs no extra request — while they resolve it shows a neutral
 * ellipsis rather than the raw id.
 */
export function EntryTitleCrumb({
    typeName,
    entryId
}: {
    /** The open type's machine name. */
    typeName: string;
    /** The open record's id. */
    entryId: string;
}) {
    const schema = useContentSchema(typeName);
    const entry = useContentEntry(typeName, entryId);

    const title =
        schema.data && entry.data
            ? relationLabel(entry.data.values, schema.data.fields, entryId)
            : '…';

    return <span className="max-w-64 truncate">{title}</span>;
}
