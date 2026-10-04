import { defineMessages, useIntl } from 'react-intl';
import { SkeletonRegion } from '@orthacms/design-system';
import { ContentModelLayout } from '../ContentModelLayout';
import { TypeEditorSkeleton } from './TypeEditorSkeleton';
import { TypeRailSkeleton } from './TypeRailSkeleton';

const messages = defineMessages({
    loading: {
        id: 'schemaBuilder.skeleton.loading',
        defaultMessage: 'Loading the content model…'
    }
});

/**
 * One announced region for the whole body (`SkeletonRegion`: `role="status"`,
 * `aria-busy`, the blocks hidden from assistive tech). No `heading`: the
 * chrome's `<h1>` is already on screen, and a second one is worse than none.
 */
export function ContentModelSkeleton() {
    const intl = useIntl();
    return (
        <SkeletonRegion label={intl.formatMessage(messages.loading)}>
            <ContentModelLayout
                rail={<TypeRailSkeleton />}
                editor={<TypeEditorSkeleton />}
            />
        </SkeletonRegion>
    );
}
