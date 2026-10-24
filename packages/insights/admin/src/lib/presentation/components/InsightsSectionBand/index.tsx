import type { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type {
    InsightsWidget,
    InsightsWidgetSize
} from '../../slots/insightsSlots';
import type { InsightsBand } from '../../../utils/resolveInsightsLayout';
import { useInsightsRange } from '../../../hooks/useInsightsRange';
import { WidgetBoundary } from '../WidgetBoundary';
import { StatStrip } from '../StatStrip';

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

/** The span a widget with no declared size gets — half a row. */
const DEFAULT_SIZE: InsightsWidgetSize = 'md';

/**
 * Column span for a contributed widget's `size`, falling back to the default
 * for anything not in the table.
 *
 * A bare `SIZE_SPAN[size]` yielded `undefined` for a typo'd size, `cn` dropped
 * it, and the widget landed in one column of twelve — a sliver, with no error
 * anywhere. `Object.hasOwn` also keeps a size naming an `Object.prototype`
 * member (`constructor`, `toString`) from reading back a truthy non-string.
 * The type says this can't happen; the contributor writing it is in another
 * package and may not be compiling against that type.
 */
function spanFor(size: InsightsWidgetSize | undefined): string {
    if (size && Object.hasOwn(SIZE_SPAN, size)) return SIZE_SPAN[size];
    return SIZE_SPAN[DEFAULT_SIZE];
}

/** Props for {@link InsightsSectionBand}. */
export type InsightsSectionBandProps = {
    /** The section and its visible widgets. */
    band: InsightsBand;
    /**
     * Leads the band with the **Needs attention** card, the band's other charts
     * beside it — given to the first tab only, and only when the reader can
     * see at least one line.
     */
    attention?: ReactNode;
};

/**
 * One section of the Insights page — the body of its tab.
 *
 * Three rows, each only when it has something in it:
 *
 * 1. the band's `xs` widgets, set side by side in one {@link StatStrip};
 * 2. when `attention` is given, the Needs-attention card with the band's other
 *    widgets stacked beside it — what needs someone first, charts second;
 * 3. otherwise the other widgets in the twelve-column grid, at their sizes.
 *
 * The section's heading stays an `h2`, visually hidden: the tab already shows
 * its name, and the outline must still go `h1` → `h2` → `h3` with no gap
 * (`[insights:I-24]`).
 *
 * Each widget is mounted inside its own {@link WidgetBoundary} so a throw from
 * one contributing package can't take the others down — these components come
 * from packages the Insights plugin has no visibility into.
 */
export function InsightsSectionBand({
    band,
    attention
}: InsightsSectionBandProps) {
    const intl = useIntl();
    const { range } = useInsightsRange();
    const { section } = band;

    const heading = intl.formatMessage({
        id: section.titleId,
        defaultMessage: section.defaultTitle
    });
    const description = section.defaultDescription
        ? intl.formatMessage({
              id: section.descriptionId ?? `${section.titleId}.description`,
              defaultMessage: section.defaultDescription
          })
        : null;

    const tiles = band.widgets.filter((widget) => widget.size === 'xs');
    const rest = band.widgets.filter((widget) => widget.size !== 'xs');

    const mount = (widget: InsightsWidget) => (
        <WidgetBoundary
            title={intl.formatMessage({
                id: widget.titleId,
                defaultMessage: widget.defaultTitle
            })}
            // The range is the page's one "ask again" action, so a widget that
            // threw on one window's data gets another chance on the next rather
            // than staying broken until the page is remounted.
            resetKey={range}
        >
            <widget.Component />
        </WidgetBoundary>
    );

    return (
        <section
            className="flex flex-col gap-4"
            data-section-id={section.id}
            data-section-fallback={band.isFallback ? 'true' : undefined}
        >
            <h2 className="sr-only">{heading}</h2>
            {description ? (
                <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}

            {tiles.length > 0 ? (
                <StatStrip count={tiles.length}>
                    {tiles.map((widget) => (
                        <div
                            key={widget.id}
                            data-widget-id={widget.id}
                            className="bg-card"
                        >
                            {mount(widget)}
                        </div>
                    ))}
                </StatStrip>
            ) : null}

            {attention ? (
                <div className="grid items-start gap-4 lg:grid-cols-2">
                    {attention}
                    {rest.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {rest.map((widget) => (
                                <div key={widget.id} data-widget-id={widget.id}>
                                    {mount(widget)}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : rest.length > 0 ? (
                <div className="grid grid-cols-12 gap-4">
                    {rest.map((widget) => (
                        <div
                            key={widget.id}
                            data-widget-id={widget.id}
                            className={cn(spanFor(widget.size))}
                        >
                            {mount(widget)}
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
