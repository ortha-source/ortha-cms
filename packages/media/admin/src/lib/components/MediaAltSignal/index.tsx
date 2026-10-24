import { defineMessages, useIntl } from 'react-intl';
import { Eye } from 'lucide-react';
import {
    SignalRow,
    type InsightsSignalRowProps
} from '@orthacms/insights-admin';
import { useMediaAltCoverage } from '../../hooks/useMediaInsights';

/** Intl descriptors for the alt-text line, co-located here. */
const messages = defineMessages({
    title: {
        id: 'media.insights.signal.alt.title',
        defaultMessage: 'Images missing alt text'
    },
    hint: {
        id: 'media.insights.signal.alt.hint',
        defaultMessage: 'In Media Library · {percent}% of {images, number} images'
    },
    noImages: {
        id: 'media.insights.signal.alt.noImages',
        defaultMessage: 'No images in Media Library yet'
    }
});

/**
 * Images with no alt text — accessibility debt somebody can pick up, as a
 * count, with the share of the library it is. The headline is the missing
 * count rather than a coverage score: "23 images need alt text" is a job.
 */
export function MediaAltSignal({ onOpen, isOpen }: InsightsSignalRowProps) {
    const intl = useIntl();
    const { data, isPending, isError } = useMediaAltCoverage();

    const images = data?.images ?? 0;
    const missing = data?.missing ?? 0;
    const percent = images > 0 ? Math.round((missing / images) * 100) : 0;

    return (
        <SignalRow
            icon={Eye}
            tone="warn"
            count={missing}
            title={intl.formatMessage(messages.title)}
            hint={
                images > 0
                    ? intl.formatMessage(messages.hint, { percent, images })
                    : intl.formatMessage(messages.noImages)
            }
            isPending={isPending}
            isError={isError}
            onOpen={onOpen}
            isOpen={isOpen}
        />
    );
}
