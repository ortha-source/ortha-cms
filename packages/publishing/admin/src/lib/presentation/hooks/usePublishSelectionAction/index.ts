import { defineMessages, useIntl } from 'react-intl';
import { ListChecks } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import type {
    RecordsBulkActionEntry,
    RecordsBulkContext
} from '@orthacms/content-admin';
import { CONTENT_PUBLISH } from '../../../domain/constants';
import { PUBLISH_SET_MAX_IDS } from '../../../domain/publishSet';
import { useOpenInPublishManager } from '../useOpenInPublishManager';

const messages = defineMessages({
    action: {
        id: 'publishing.bulk.open',
        defaultMessage: 'Open in Publish Manager'
    },
    tooMany: {
        id: 'publishing.bulk.tooMany',
        defaultMessage: 'Open in Publish Manager (max {max})'
    }
});

/**
 * **Open in Publish Manager** in the records selection bar's ⋯ menu: the
 * "deep" publish of a selection — its translations and the drafts it links to,
 * picked on a page of their own. Hidden on a type with no publish state, in the
 * trash, and without `content:publish`. A selection over the set's cap is
 * offered disabled with the cap in its label, rather than silently cut short.
 */
export function usePublishSelectionAction(
    context: RecordsBulkContext
): RecordsBulkActionEntry | null {
    const intl = useIntl();
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const open = useOpenInPublishManager(context.workspaceId);
    const { schema, ids, trashed } = context;
    if (!schema.publishable || trashed || !canPublish || ids.length === 0) {
        return null;
    }
    const tooMany = ids.length > PUBLISH_SET_MAX_IDS;
    return {
        label: tooMany
            ? intl.formatMessage(messages.tooMany, { max: PUBLISH_SET_MAX_IDS })
            : intl.formatMessage(messages.action),
        icon: ListChecks,
        disabled: tooMany,
        onSelect: () => open(schema.name, ids)
    };
}
