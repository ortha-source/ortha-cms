import { defineMessages, useIntl } from 'react-intl';
import { ListChecks } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import type { EntryMenuEntry, EntrySlotContext } from '@orthacms/content-admin';
import { CONTENT_PUBLISH } from '../../../domain/constants';
import { useOpenInPublishManager } from '../useOpenInPublishManager';

const messages = defineMessages({
    action: {
        id: 'publishing.entry.open',
        defaultMessage: 'Open in Publish Manager'
    }
});

/**
 * **Open in Publish Manager** in the entry editor's ⋯ menu — the same page,
 * opened on the one record: its translations and the drafts it links to.
 * Hidden on a type with no publish state, on an unsaved record and without
 * `content:publish`.
 */
export function usePublishEntryAction(
    context: EntrySlotContext
): EntryMenuEntry | null {
    const intl = useIntl();
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const open = useOpenInPublishManager(context.workspaceId);
    const { schema, entry, isCreate } = context;
    if (!schema.publishable || isCreate || !entry || !canPublish) return null;
    return {
        label: intl.formatMessage(messages.action),
        icon: ListChecks,
        onSelect: () => open(schema.name, [entry.id])
    };
}
