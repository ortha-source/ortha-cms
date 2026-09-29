import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader
} from '@orthacms/design-system';
import type {
    ContentType,
    EntrySource
} from '../../../domain/types/contentType';
import { useContentSchema } from '../../../application/useContentSchema';
import { CollectionRecordsSkeleton } from './CollectionRecordsSkeleton';
import { LoadedRecordsView } from './LoadedRecordsView';

/** Intl descriptors for {@link CollectionRecordsView}, co-located. */
const messages = defineMessages({
    error: {
        id: 'content.records.error',
        defaultMessage: 'Couldn’t load this collection. Please try again.'
    },
    retry: { id: 'content.records.retry', defaultMessage: 'Retry' }
});

/**
 * The records experience for a collection: a searchable, filterable, paginated,
 * deep-linkable table of its entries, with a column picker and an "Add record"
 * action. It loads the type's full field schema, then the entries page from
 * `GET /api/content/:name` (search/filter/sort/paginate happen server-side).
 * Loading/error states stand in while the schema resolves; the table itself
 * only mounts once the schema is known (in {@link LoadedRecordsView}), so columns
 * seed correctly on first render.
 */
export function CollectionRecordsView({
    type,
    trashed = false,
    sharedSource
}: {
    type: ContentType;
    /** Render the trash view (soft-deleted rows) instead of the live list. */
    trashed?: boolean;
    /**
     * List this shared workspace's published records of the type instead of
     * the open workspace's own — **read-only**: no create, no selection or
     * bulk actions, no row actions, no saved views.
     */
    sharedSource?: EntrySource;
}) {
    const intl = useIntl();
    const {
        data: schema,
        isPending,
        isError,
        refetch
    } = useContentSchema(type.name);

    if (isPending) {
        return (
            <Container className="max-w-none p-6 sm:p-6">
                <ContainerHeader titleClassName="text-lg" title={type.label} />
                <CollectionRecordsSkeleton />
            </Container>
        );
    }

    if (isError || !schema) {
        return (
            <Container className="max-w-none p-6 sm:p-6">
                <ContainerHeader titleClassName="text-lg" title={type.label} />
                <Alert variant="destructive" role="alert" className="mt-4">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        <span>{intl.formatMessage(messages.error)}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shadow-none"
                            onClick={() => refetch()}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </AlertDescription>
                </Alert>
            </Container>
        );
    }

    return (
        <LoadedRecordsView
            type={type}
            schema={schema}
            trashed={trashed}
            sharedSource={sharedSource}
        />
    );
}
