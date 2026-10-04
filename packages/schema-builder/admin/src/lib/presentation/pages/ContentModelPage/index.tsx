import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDocumentTitle } from '@orthacms/utils-admin';
import { useSchemaDocument } from '../../../application/queries/useSchemaDocument';
import { ContentModelChrome } from '../../components/ContentModelChrome';
import { ContentModelError } from '../../components/ContentModelError';
import { ContentModelNoAccess } from '../../components/ContentModelNoAccess';
import { ContentModelSkeleton } from '../../components/ContentModelSkeleton';
import { ContentModelWorkspace } from '../../components/ContentModelWorkspace';

const messages = defineMessages({
    title: { id: 'schemaBuilder.page.title', defaultMessage: 'Content model' }
});

/**
 * `/content-model/:typeName?` — global, in the directory group: types are
 * code, the same in every workspace. Four states that never mix: no access
 * (no request sent), loading, error, loaded. The chrome is common to all.
 */
export function ContentModelPage() {
    const intl = useIntl();
    useDocumentTitle(intl.formatMessage(messages.title));
    const canRead = useHasPermission('content:read');
    const query = useSchemaDocument(canRead);

    // The loaded workspace renders the chrome itself: its header carries the draft.
    if (canRead && query.data)
        return <ContentModelWorkspace envelope={query.data} />;
    return (
        <ContentModelChrome>
            {!canRead ? (
                <ContentModelNoAccess />
            ) : query.isError ? (
                <ContentModelError onRetry={() => void query.refetch()} />
            ) : (
                <ContentModelSkeleton />
            )}
        </ContentModelChrome>
    );
}
