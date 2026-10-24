import { defineMessages, useIntl } from 'react-intl';
import { Blocks } from 'lucide-react';
import { ContainerHeader, SkeletonRegion } from '@orthacms/design-system';
import { ContentModelLayout } from '../ContentModelLayout';
import { TypeEditorSkeleton } from './TypeEditorSkeleton';
import { TypeRailSkeleton } from './TypeRailSkeleton';

const messages = defineMessages({
    title: { id: 'schemaBuilder.page.title', defaultMessage: 'Content Model' },
    loading: {
        id: 'schemaBuilder.skeleton.loading',
        defaultMessage: 'Loading the content model…'
    }
});

/**
 * The workspace's two panes as blocks, under a real `<h1>` where the open
 * type's name will be — so the heading does not move when the document
 * lands. One announced region (`SkeletonRegion`: `role="status"`,
 * `aria-busy`) for the editor's blocks; the rail's carry nothing to announce.
 */
export function ContentModelSkeleton() {
    const intl = useIntl();
    return (
        <ContentModelLayout
            rail={
                <div aria-hidden className="ds-skeleton-reveal">
                    <TypeRailSkeleton />
                </div>
            }
            editor={
                <>
                    <ContainerHeader
                        className="mb-0"
                        icon={<Blocks className="size-4" />}
                        title={intl.formatMessage(messages.title)}
                    />
                    <SkeletonRegion
                        label={intl.formatMessage(messages.loading)}
                    >
                        <TypeEditorSkeleton />
                    </SkeletonRegion>
                </>
            }
        />
    );
}
