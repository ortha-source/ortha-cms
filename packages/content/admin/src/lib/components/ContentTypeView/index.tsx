import { useParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Container,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle
} from '@ortha-cms/design-system';
import { FileQuestion, Inbox } from 'lucide-react';
import type { ContentType } from '../../types/contentType';
import { TYPE_PARAM } from '../../constants';
import { CollectionRecordsView } from '../CollectionRecordsView';

/** Intl descriptors for the selected-type view, co-located here. */
const messages = defineMessages({
    pageBadge: {
        id: 'content.type.pageBadge',
        defaultMessage: 'Page'
    },
    entriesComingSoonTitle: {
        id: 'content.type.entriesComingSoonTitle',
        defaultMessage: 'Entries coming soon'
    },
    entriesComingSoonBody: {
        id: 'content.type.entriesComingSoonBody',
        defaultMessage:
            'Browsing and editing entries for this content type lands next.'
    },
    unknownTitle: {
        id: 'content.type.unknownTitle',
        defaultMessage: 'Unknown content type'
    },
    unknownBody: {
        id: 'content.type.unknownBody',
        defaultMessage: 'This content type doesn’t exist in this workspace.'
    }
});

type ContentTypeViewProps = {
    /** Every content type in the workspace, resolved by the `:typeName` param. */
    types: ContentType[];
};

/**
 * The selected content type's pane, resolved from the `:typeName` route param
 * against the already-fetched catalogue (no re-fetch). For this milestone it
 * shows the type's header (label, kind badge, description) and an
 * "entries coming soon" placeholder; the entry list/editor lands later. An
 * unknown param renders a distinct not-found state.
 */
export function ContentTypeView({ types }: ContentTypeViewProps) {
    const intl = useIntl();
    const typeName = useParams()[TYPE_PARAM];
    const type = types.find((candidate) => candidate.name === typeName);

    if (!type) {
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

    // Collections get the dynamic records table; singles (one-entry pages)
    // keep the placeholder until their single-entry editor lands.
    if (type.kind === 'collection') {
        return <CollectionRecordsView type={type} />;
    }

    return (
        <Container className="py-8">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                    {type.label}
                </h1>
                <Badge variant="secondary">
                    {intl.formatMessage(messages.pageBadge)}
                </Badge>
            </div>
            {type.description ? (
                <p className="mt-1 text-muted-foreground">{type.description}</p>
            ) : null}

            <Empty className="mt-6">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Inbox />
                    </EmptyMedia>
                    <EmptyTitle>
                        {intl.formatMessage(messages.entriesComingSoonTitle)}
                    </EmptyTitle>
                    <EmptyDescription>
                        {intl.formatMessage(messages.entriesComingSoonBody)}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </Container>
    );
}
