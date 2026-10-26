import { defineMessages, useIntl } from 'react-intl';
import { File, Table2 } from 'lucide-react';
import type { AvatarColor } from '@orthacms/design-system';
import type { SharedSource } from '../../../../../domain/types/workspace';
import type {
    ContentType,
    ResourceSelection,
    SharedContentChoice
} from '../../../../../domain/types/wizard';
import { OwnTypeSection } from './OwnTypeSection';
import { SharedTypeSection } from './SharedTypeSection';

const messages = defineMessages({
    collections: {
        id: 'workspaces.create.content.collectionsHeading',
        defaultMessage: 'Collections'
    },
    pages: {
        id: 'workspaces.create.content.pagesHeading',
        defaultMessage: 'Pages'
    },
    empty: {
        id: 'workspaces.create.content.catalogueEmpty',
        defaultMessage: 'This site defines no content types yet.'
    }
});

/** Props for {@link ContentPicker}. */
export type ContentPickerProps = {
    /** The whole content-type catalogue. */
    catalog: readonly ContentType[];
    collections: ResourceSelection;
    onCollectionsChange: (next: ResourceSelection) => void;
    pages: ResourceSelection;
    onPagesChange: (next: ResourceSelection) => void;
    /** What shared workspaces offer. */
    sources: readonly SharedSource[];
    /** Each source's accent colour, by workspace id. */
    sourceColors: Readonly<Record<string, AvatarColor>>;
    sharedContent: readonly SharedContentChoice[];
    onToggleSharedContent: (choice: SharedContentChoice) => void;
    /** Records of each type across your other workspaces. */
    elsewhere: Readonly<Record<string, number>>;
    /** Types none of your workspaces is granted. */
    unused: ReadonlySet<string>;
};

/**
 * "Pick content types" as **one** framed list rather than three panels:
 * collections, then pages, then what shared workspaces offer, each a labelled
 * group under its own header row.
 */
export function ContentPicker({
    catalog,
    collections,
    onCollectionsChange,
    pages,
    onPagesChange,
    sources,
    sourceColors,
    sharedContent,
    onToggleSharedContent,
    elsewhere,
    unused
}: ContentPickerProps) {
    const intl = useIntl();
    const collectionTypes = catalog.filter((ct) => ct.kind === 'collection');
    const pageTypes = catalog.filter((ct) => ct.kind === 'single');

    if (catalog.length === 0 && sources.length === 0) {
        return (
            <p className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
                {intl.formatMessage(messages.empty)}
            </p>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border [&>*:last-child_li:last-child]:border-b-0">
            <OwnTypeSection
                title={intl.formatMessage(messages.collections)}
                icon={Table2}
                types={collectionTypes}
                selection={collections}
                onChange={onCollectionsChange}
                elsewhere={elsewhere}
                unused={unused}
            />
            <OwnTypeSection
                title={intl.formatMessage(messages.pages)}
                icon={File}
                types={pageTypes}
                selection={pages}
                onChange={onPagesChange}
                elsewhere={elsewhere}
                unused={unused}
            />
            <SharedTypeSection
                sources={sources}
                colors={sourceColors}
                catalog={catalog}
                selected={sharedContent}
                onToggle={onToggleSharedContent}
            />
        </div>
    );
}
