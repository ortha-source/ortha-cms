import { defineMessages, useIntl } from 'react-intl';
import { Layers, Plus } from 'lucide-react';
import {
    Button,
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle
} from '@ortha-cms/design-system';

/** Intl descriptors for {@link WorkspacesEmpty}, co-located with the component. */
const messages = defineMessages({
    filteredTitle: {
        id: 'workspaces.empty.filtered.title',
        defaultMessage: 'No workspaces match'
    },
    filteredDescription: {
        id: 'workspaces.empty.filtered.description',
        defaultMessage:
            'Try a different search, or clear the filters to see them all.'
    },
    clear: {
        id: 'workspaces.empty.clear',
        defaultMessage: 'Clear filters'
    },
    emptyTitle: {
        id: 'workspaces.empty.none.title',
        defaultMessage: 'No workspaces yet'
    },
    emptyDescription: {
        id: 'workspaces.empty.none.description',
        defaultMessage:
            'Create your first workspace to group content, members, and plugins.'
    },
    create: {
        id: 'workspaces.empty.create',
        defaultMessage: 'New workspace'
    }
});

type WorkspacesEmptyProps = {
    /** Whether a search or non-default filter is currently narrowing the list. */
    filtered: boolean;
    /** Resets the search and status filter back to their defaults. */
    onClear: () => void;
    /**
     * Opens the create-workspace flow. Optional: omitted while the create entry
     * point is hidden (the API is read-only), so the empty list shows no CTA.
     */
    onCreate?: () => void;
};

/**
 * The empty state for the grid. When filters are active it offers to clear
 * them; otherwise it invites creating the first workspace (when create is
 * available).
 */
export function WorkspacesEmpty({
    filtered,
    onClear,
    onCreate
}: WorkspacesEmptyProps) {
    const intl = useIntl();

    return (
        <Empty className="border">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Layers />
                </EmptyMedia>
                <EmptyTitle>
                    {intl.formatMessage(
                        filtered ? messages.filteredTitle : messages.emptyTitle
                    )}
                </EmptyTitle>
                <EmptyDescription>
                    {intl.formatMessage(
                        filtered
                            ? messages.filteredDescription
                            : messages.emptyDescription
                    )}
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                {filtered ? (
                    <Button
                        variant="outline"
                        className="shadow-none"
                        onClick={onClear}
                    >
                        {intl.formatMessage(messages.clear)}
                    </Button>
                ) : onCreate ? (
                    <Button onClick={onCreate}>
                        <Plus />
                        {intl.formatMessage(messages.create)}
                    </Button>
                ) : null}
            </EmptyContent>
        </Empty>
    );
}
