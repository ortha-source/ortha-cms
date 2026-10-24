import { useMemo, type Ref } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { AlertCircle } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    type AvatarColor
} from '@orthacms/design-system';
import { useContentTypes } from '../../../../application/useContentTypes';
import { useSharedSourceCandidates } from '../../../../application/useSharedSourceCandidates';
import { useWorkspaces } from '../../../../application/useWorkspaces';
import { ContentTypesSkeleton } from '../../WorkspacesSkeleton';
import type {
    ContentMode,
    ResourceSelection,
    SharedContentChoice
} from '../../../../domain/types/wizard';
import { ModeTiles } from './ModeTiles';
import { ContentPicker } from './ContentPicker';

const messages = defineMessages({
    title: {
        id: 'workspaces.create.content.title',
        defaultMessage: 'What can people write here?'
    },
    help: {
        id: 'workspaces.create.content.help',
        defaultMessage:
            'Content types are shared by every workspace; pick the ones this one uses. Change it any time in Settings → Content.'
    },
    errorTitle: {
        id: 'workspaces.create.content.errorTitle',
        defaultMessage: 'Could not load content types'
    },
    errorBody: {
        id: 'workspaces.create.content.errorBody',
        defaultMessage:
            'Try again in a moment, or choose Everything and adjust it later in Settings → Content.'
    }
});

/** Props for {@link ContentStep}. */
export type ContentStepProps = {
    /** The step heading — the focus target after a step change. */
    titleRef: Ref<HTMLHeadingElement>;
    contentMode: ContentMode;
    setContentMode: (mode: ContentMode) => void;
    collections: ResourceSelection;
    setCollections: (selection: ResourceSelection) => void;
    pages: ResourceSelection;
    setPages: (selection: ResourceSelection) => void;
    sharedContent: SharedContentChoice[];
    onToggleSharedContent: (choice: SharedContentChoice) => void;
};

/**
 * The content step body — two answers first: "Everything" (the quick path) or
 * "Pick content types", which opens one list of collections, pages and what
 * shared workspaces offer. Each own type says how many records it holds in
 * your other workspaces; the loading and error states of the catalogue have
 * their own place under the tiles.
 */
export function ContentStep({
    titleRef,
    contentMode,
    setContentMode,
    collections,
    setCollections,
    pages,
    setPages,
    sharedContent,
    onToggleSharedContent
}: ContentStepProps) {
    const intl = useIntl();
    const query = useContentTypes();
    const workspaces = useWorkspaces();
    const { sources } = useSharedSourceCandidates();
    const catalog = useMemo(() => query.data ?? [], [query.data]);

    // Usage across the workspaces you can see — the membership-scoped list,
    // so these hints never describe a workspace you are not in.
    const { elsewhere, unused, colors } = useMemo(() => {
        const list = workspaces.data ?? [];
        const counts: Record<string, number> = {};
        const used = new Set<string>();
        const tints: Record<string, AvatarColor> = {};
        for (const workspace of list) {
            tints[workspace.id] = workspace.color;
            for (const slug of workspace.content) used.add(slug);
            for (const [slug, n] of Object.entries(
                workspace.recordCountByType
            )) {
                counts[slug] = (counts[slug] ?? 0) + n;
            }
        }
        return {
            elsewhere: counts,
            // Only claim "new" once the list has actually loaded.
            unused: new Set(
                workspaces.data
                    ? catalog.map((t) => t.name).filter((n) => !used.has(n))
                    : []
            ),
            colors: tints
        };
    }, [workspaces.data, catalog]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2
                    ref={titleRef}
                    tabIndex={-1}
                    className="text-sm font-semibold focus-visible:outline-none"
                >
                    {intl.formatMessage(messages.title)}
                </h2>
                <p className="text-[13px] text-muted-foreground">
                    {intl.formatMessage(messages.help)}
                </p>
            </div>

            <ModeTiles
                value={contentMode}
                onChange={setContentMode}
                total={catalog.length}
            />

            {contentMode === 'all' ? null : query.isPending ? (
                <ContentTypesSkeleton />
            ) : query.isError ? (
                <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>
                        {intl.formatMessage(messages.errorTitle)}
                    </AlertTitle>
                    <AlertDescription>
                        {intl.formatMessage(messages.errorBody)}
                    </AlertDescription>
                </Alert>
            ) : (
                <ContentPicker
                    catalog={catalog}
                    collections={collections}
                    onCollectionsChange={setCollections}
                    pages={pages}
                    onPagesChange={setPages}
                    sources={sources}
                    sourceColors={colors}
                    sharedContent={sharedContent}
                    onToggleSharedContent={onToggleSharedContent}
                    elsewhere={elsewhere}
                    unused={unused}
                />
            )}
        </div>
    );
}
