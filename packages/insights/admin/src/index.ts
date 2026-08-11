export {
    InsightsPlugin,
    DEFAULT_INSIGHTS_SECTIONS
} from './lib/utils/insightsPlugin';
export type {
    InsightsAdminPlugin,
    InsightsPluginConfig
} from './lib/utils/insightsPlugin';

/* The extension point. A package contributes widgets by adding items to
   INSIGHTS_WIDGET_SLOT from its own plugin factory. */
export {
    INSIGHTS_WIDGET_SLOT,
    INSIGHTS_SECTION_SLOT,
    INSIGHTS_SECTION_IDS
} from './lib/presentation/slots/insightsSlots';
export { DEFAULT_INSIGHTS_ORDER } from './lib/presentation/slots/insightsSlots';
export type {
    InsightsWidget,
    InsightsSection,
    InsightsWidgetSize
} from './lib/presentation/slots/insightsSlots';

/* The pure layout fold — exported so a host or a test can reason about how
   sections merge and where an orphaned widget lands, without a browser. */
export { resolveInsightsLayout } from './lib/utils/resolveInsightsLayout';
export type {
    InsightsBand,
    ResolveInsightsLayoutInput
} from './lib/utils/resolveInsightsLayout';

/* The shared window every widget reports against. */
export {
    useInsightsRange,
    INSIGHTS_RANGES
} from './lib/hooks/useInsightsRange';
export type {
    InsightsRange,
    InsightsRangeValue
} from './lib/hooks/useInsightsRange';

/* The widget shell — a contributed widget renders its body inside this so the
   pending / error / empty / data ladder is identical across packages. */
export { WidgetCard } from './lib/presentation/components/WidgetCard';
export type { WidgetCardProps } from './lib/presentation/components/WidgetCard';
export { WidgetChip } from './lib/presentation/components/WidgetChip';
export type {
    WidgetChipProps,
    WidgetChipTone
} from './lib/presentation/components/WidgetChip';

/* Chart primitives. Deliberately a small hand-built set rather than a charting
   dependency: the whole page is bar lists, one area chart and two heat grids,
   and these read the same design tokens as the rest of the admin, so they
   follow the theme without a parallel styling system. */
export { BarRows } from './lib/presentation/components/BarRows';
export type {
    BarRowsProps,
    BarRowSpec,
    BarSegment
} from './lib/presentation/components/BarRows';
export { AreaTrend } from './lib/presentation/components/AreaTrend';
export type {
    AreaTrendProps,
    TrendPoint
} from './lib/presentation/components/AreaTrend';
export { ColumnTrend } from './lib/presentation/components/ColumnTrend';
export type { ColumnTrendProps } from './lib/presentation/components/ColumnTrend';
export { HeatGrid } from './lib/presentation/components/HeatGrid';
export type {
    HeatGridProps,
    HeatRow,
    HeatCell
} from './lib/presentation/components/HeatGrid';
export { RampLegend } from './lib/presentation/components/RampLegend';
export type { RampLegendProps } from './lib/presentation/components/RampLegend';
export { StatWidget } from './lib/presentation/components/StatWidget';
export type { StatWidgetProps } from './lib/presentation/components/StatWidget';
export { Sparkline } from './lib/presentation/components/Sparkline';
export type { SparklineProps } from './lib/presentation/components/Sparkline';

/* The palette roles a widget asks for by name. */
export {
    toneBackground,
    toneForIntensity,
    toneInk,
    SEQUENTIAL_TONES
} from './lib/utils/chartTone';
export type { ChartTone } from './lib/utils/chartTone';
