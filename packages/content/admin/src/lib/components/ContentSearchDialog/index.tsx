import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandList
} from '@ortha-cms/design-system';
import type { ContentType } from '../../types/contentType';
import { groupContentTypes } from '../../utils/groupContentTypes';
import { ContentSearchItem } from './ContentSearchItem';

/** Intl descriptors for the content search palette, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.search.title',
        defaultMessage: 'Search content types'
    },
    description: {
        id: 'content.search.description',
        defaultMessage: 'Find and open a collection or page.'
    },
    placeholder: {
        id: 'content.search.placeholder',
        defaultMessage: 'Search collections and pages…'
    },
    empty: {
        id: 'content.search.empty',
        defaultMessage: 'No content types found.'
    },
    footer: {
        id: 'content.search.footer',
        defaultMessage: '↑↓ to navigate · ↵ to open · esc to close'
    },
    collectionsGroup: {
        id: 'content.search.collectionsGroup',
        defaultMessage: 'Collections'
    },
    pagesGroup: {
        id: 'content.search.pagesGroup',
        defaultMessage: 'Pages'
    },
    collectionBadge: {
        id: 'content.search.collectionBadge',
        defaultMessage: 'Collection'
    },
    pageBadge: {
        id: 'content.search.pageBadge',
        defaultMessage: 'Page'
    }
});

type ContentSearchDialogProps = {
    /** Whether the palette is open. */
    open: boolean;
    /** Open/close handler. */
    onOpenChange: (open: boolean) => void;
    /** Every content type in the workspace. */
    types: ContentType[];
    /** Absolute base path for the library (`/workspaces/:id/content`). */
    basePath: string;
};

/**
 * The ⌘K command palette over the workspace's content types. Built on
 * `CommandDialog` (Command inside Dialog — focus trap, ESC, arrow-key nav, and
 * an auto-focused input come for free), it lists Collections and Pages; choosing
 * one navigates to its route and closes the palette.
 */
export function ContentSearchDialog({
    open,
    onOpenChange,
    types,
    basePath
}: ContentSearchDialogProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const { collections, pages } = groupContentTypes(types);

    const select = (type: ContentType) => {
        onOpenChange(false);
        navigate(`${basePath}/${type.name}`);
    };

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            <CommandInput
                placeholder={intl.formatMessage(messages.placeholder)}
            />
            {/* Fixed height so the dialog doesn't resize/jump as results filter. */}
            <CommandList className="h-80 max-h-none">
                <CommandEmpty>
                    {intl.formatMessage(messages.empty)}
                </CommandEmpty>
                {collections.length > 0 ? (
                    <CommandGroup
                        heading={intl.formatMessage(messages.collectionsGroup)}
                    >
                        {collections.map((type) => (
                            <ContentSearchItem
                                key={type.name}
                                type={type}
                                badge={intl.formatMessage(
                                    messages.collectionBadge
                                )}
                                onSelect={select}
                            />
                        ))}
                    </CommandGroup>
                ) : null}
                {pages.length > 0 ? (
                    <CommandGroup
                        heading={intl.formatMessage(messages.pagesGroup)}
                    >
                        {pages.map((type) => (
                            <ContentSearchItem
                                key={type.name}
                                type={type}
                                badge={intl.formatMessage(messages.pageBadge)}
                                onSelect={select}
                            />
                        ))}
                    </CommandGroup>
                ) : null}
            </CommandList>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                {intl.formatMessage(messages.footer)}
            </div>
        </CommandDialog>
    );
}
