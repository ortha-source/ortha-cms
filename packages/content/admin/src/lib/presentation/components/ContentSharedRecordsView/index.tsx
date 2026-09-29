import { useParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Container,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle
} from '@orthacms/design-system';
import { FileQuestion } from 'lucide-react';
import type { ContentType } from '../../../domain/types/contentType';
import { SOURCE_PARAM, TYPE_PARAM } from '../../../domain/constants';
import { sharedSourceOf } from '../../../domain/contentTypeAccess';
import { CollectionRecordsView } from '../CollectionRecordsView';

const messages = defineMessages({
    unknownTitle: {
        id: 'content.sharedRecords.unknownTitle',
        defaultMessage: 'Shared content not available'
    },
    unknownBody: {
        id: 'content.sharedRecords.unknownBody',
        defaultMessage:
            'This workspace doesn’t read these records from that workspace — the grant may have been removed, or the workspace stopped sharing.'
    }
});

/**
 * The route element for `:typeName/shared/:sourceId`: one shared workspace's
 * published records of a type, **read-only** — the records table with no
 * create, no selection, no row actions and no saved views; a row opens the
 * existing read-only entry view. Resolved against the scoped catalogue, so a
 * deep link to a source this workspace isn't granted (or that stopped
 * sharing) lands on an explicit not-available state rather than on an empty
 * list that would read as "they have nothing".
 */
export function ContentSharedRecordsView({
    types
}: {
    /** The workspace's scoped content types. */
    types: ContentType[];
}) {
    const intl = useIntl();
    const params = useParams();
    const type = types.find(
        (candidate) => candidate.name === params[TYPE_PARAM]
    );
    const source = type
        ? sharedSourceOf(type, params[SOURCE_PARAM])
        : undefined;

    if (!type || !source) {
        return (
            <Container className="py-8">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <FileQuestion />
                        </EmptyMedia>
                        <EmptyTitle>
                            {intl.formatMessage(messages.unknownTitle)}
                        </EmptyTitle>
                        <EmptyDescription>
                            {intl.formatMessage(messages.unknownBody)}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </Container>
        );
    }

    // Keyed by source: two sources of one type are two different lists, and
    // the table's local state (selection, filters panel) must not carry over.
    return (
        <CollectionRecordsView
            key={source.workspaceId}
            type={type}
            sharedSource={source}
        />
    );
}
