import { useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { InsightsWidgetSize } from '../../slots/insightsSlots';
import type { InsightsBand } from '../../../hooks/useInsightsLayout';
import { WidgetBoundary } from '../WidgetBoundary';

/**
 * Column span per size, written as whole literal class strings because
 * Tailwind scans source text and never emits an interpolated class name.
 *
 * Sizes only take effect from `lg` up. Below that every widget goes full width
 * (with `sm` allowed a half row at `md`): a heat grid or a five-row bar list
 * compressed into a third of a phone screen stops being readable, and a
 * dashboard that can't be read on the device in someone's hand isn't a smaller
 * dashboard, it's a broken one.
 */
const SIZE_SPAN: Record<InsightsWidgetSize, string> = {
    xs: 'col-span-6 lg:col-span-3',
    sm: 'col-span-12 md:col-span-6 lg:col-span-4',
    md: 'col-span-12 lg:col-span-6',
    lg: 'col-span-12 lg:col-span-8',
    full: 'col-span-12'
};

/** Props for {@link InsightsSectionBand}. */
export type InsightsSectionBandProps = {
    /** The section and its visible widgets. */
    band: InsightsBand;
};

/**
 * One labelled band of the Insights page: a heading and the grid of widgets
 * under it.
 *
 * Each widget is mounted inside its own {@link WidgetBoundary} so a throw from
 * one contributing package can't take the others down — these components come
 * from packages the Insights plugin has no visibility into.
 */
export function InsightsSectionBand({ band }: InsightsSectionBandProps) {
    const intl = useIntl();
    const heading = intl.formatMessage({
        id: band.section.titleId,
        defaultMessage: band.section.defaultTitle
    });

    return (
        <section className="flex flex-col gap-3">
            <div className="border-b pb-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    {heading}
                </h2>
            </div>

            <div className="grid grid-cols-12 gap-3">
                {band.widgets.map((widget) => (
                    <div
                        key={widget.id}
                        data-widget-id={widget.id}
                        className={cn(SIZE_SPAN[widget.size ?? 'md'])}
                    >
                        <WidgetBoundary
                            title={intl.formatMessage({
                                id: widget.titleId,
                                defaultMessage: widget.defaultTitle
                            })}
                        >
                            <widget.Component />
                        </WidgetBoundary>
                    </div>
                ))}
            </div>
        </section>
    );
}
