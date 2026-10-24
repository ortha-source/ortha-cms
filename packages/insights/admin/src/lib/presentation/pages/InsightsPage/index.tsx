import { useMemo } from 'react';
import {
    defineMessages,
    useIntl,
    type MessageDescriptor
} from 'react-intl';
import { BarChart3 } from 'lucide-react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    Container,
    ContainerHeader,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TopBar,
    TopBarActions,
    TopBarIcon
} from '@orthacms/design-system';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useDocumentTitle } from '@orthacms/utils-admin';
import {
    InsightsRangeProvider,
    useInsightsRange,
    type InsightsRange
} from '../../../hooks/useInsightsRange';
import {
    useInsightsLayout,
    type InsightsBand
} from '../../../hooks/useInsightsLayout';
import { useInsightsSignals } from '../../../hooks/useInsightsSignals';
import { useInsightsView } from '../../../hooks/useInsightsView';
import { InsightsRangePicker } from '../../components/InsightsRangePicker';
import { InsightsSectionBand } from '../../components/InsightsSectionBand';
import { NeedsAttentionCard } from '../../components/NeedsAttentionCard';
import { SignalDrillSheet } from '../../components/SignalDrillSheet';

/** Intl descriptors for the insights page, co-located here. */
const messages = defineMessages({
    // Names the breadcrumb `<nav>`; the design system's own default is an
    // untranslated "breadcrumb".
    nav: { id: 'insights.page.nav', defaultMessage: 'Breadcrumb' },
    title: {
        id: 'insights.page.title',
        defaultMessage: 'Insights'
    },
    subtitle: {
        id: 'insights.page.subtitle',
        defaultMessage:
            'What changed in {workspace} over the last {range}, and what needs you.'
    },
    tabs: {
        id: 'insights.page.tabs',
        defaultMessage: 'Insights sections'
    },
    empty: {
        id: 'insights.page.empty',
        defaultMessage:
            'No insights are available yet. Widgets appear here as the plugins that own the data are installed.'
    },
    range7d: { id: 'insights.page.range.7d', defaultMessage: '7 days' },
    range30d: { id: 'insights.page.range.30d', defaultMessage: '30 days' },
    range90d: { id: 'insights.page.range.90d', defaultMessage: '90 days' },
    range12m: { id: 'insights.page.range.12m', defaultMessage: '12 months' }
});

/** The subtitle's name for each window — "over the last 30 days". */
const RANGE_PHRASE: Record<InsightsRange, MessageDescriptor> = {
    '7d': messages.range7d,
    '30d': messages.range30d,
    '90d': messages.range90d,
    '12m': messages.range12m
};

/**
 * The Insights page, mounted inside the workspace shell at
 * `/workspaces/:id/insights`.
 *
 * It owns the **frame and nothing else** — the top bar, the heading, the range
 * picker, the section tabs, the Needs-attention card and its drill-down panel,
 * and the per-widget error boundary. It contributes no widgets or lines of its
 * own and imports no other feature package: every card comes through
 * `INSIGHTS_WIDGET_SLOT` and every line through `INSIGHTS_SIGNAL_SLOT`, from the
 * plugin that owns the data behind it. That is what keeps a dashboard from
 * slowly becoming the one module that has to know about every other one.
 */
export function InsightsPage() {
    return (
        <InsightsRangeProvider>
            <InsightsFrame />
        </InsightsRangeProvider>
    );
}

/** The page inside its range provider — the subtitle names the window. */
function InsightsFrame() {
    const intl = useIntl();
    // Names this route in the tab strip, the window list, the history
    // and a screen reader's window announcement. Every private route but
    // Workspaces was still titled a bare "Admin" (WCAG 2.4.2, `ORT-140`).
    useDocumentTitle(intl.formatMessage(messages.title));
    const workspace = useCurrentWorkspace();
    const { range } = useInsightsRange();
    const bands = useInsightsLayout();
    const signals = useInsightsSignals();

    const tabIds = useMemo(() => bands.map((band) => band.section.id), [bands]);
    const signalIds = useMemo(
        () => signals.map((signal) => signal.id),
        [signals]
    );
    const view = useInsightsView({ tabs: tabIds, signals: signalIds });
    const openSignal =
        signals.find((signal) => signal.id === view.signal) ?? null;

    // The card leads the first tab — "what needs someone first, then the
    // charts" — and only when there is a line this reader may see.
    const attention =
        signals.length > 0 ? (
            <NeedsAttentionCard
                signals={signals}
                openSignal={view.signal}
                onOpen={view.setSignal}
            />
        ) : undefined;

    return (
        <>
            <TopBar>
                <TopBarIcon className="bg-warning-soft text-warning-soft-foreground">
                    <BarChart3 />
                </TopBarIcon>
                <Breadcrumb aria-label={intl.formatMessage(messages.nav)}>
                    <BreadcrumbList className="font-medium">
                        <BreadcrumbItem>
                            <BreadcrumbPage className="font-medium">
                                {intl.formatMessage(messages.title)}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <TopBarActions>
                    <InsightsRangePicker />
                </TopBarActions>
            </TopBar>

            <Container className="flex flex-col gap-5 pt-6">
                <ContainerHeader
                    className="mb-0"
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle, {
                        workspace: workspace.name,
                        range: intl.formatMessage(RANGE_PHRASE[range])
                    })}
                />

                {bands.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    <Tabs
                        value={view.tab}
                        onValueChange={view.setTab}
                        className="flex flex-col gap-5"
                    >
                        {/* One tab is no choice at all, so a reader who can
                            see a single band gets the band without the strip. */}
                        {bands.length > 1 ? (
                            <TabsList
                                aria-label={intl.formatMessage(messages.tabs)}
                            >
                                {bands.map((band) => (
                                    <TabsTrigger
                                        key={band.section.id}
                                        value={band.section.id}
                                        data-tab-id={band.section.id}
                                    >
                                        <TabLabel band={band} />
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        ) : null}
                        {bands.map((band, index) => (
                            // Only the open tab is mounted (Radix's default),
                            // so only its widgets ask for data — a tab nobody
                            // opens costs nothing.
                            <TabsContent
                                key={band.section.id}
                                value={band.section.id}
                                className="mt-0"
                            >
                                <InsightsSectionBand
                                    band={band}
                                    attention={index === 0 ? attention : undefined}
                                />
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </Container>

            <SignalDrillSheet
                signal={openSignal}
                onClose={() => view.setSignal(null)}
            />
        </>
    );
}

/** A tab's label — the section's own title, with its icon when it has one. */
function TabLabel({ band }: { band: InsightsBand }) {
    const intl = useIntl();
    const Icon = band.section.icon;
    return (
        <>
            {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
            {intl.formatMessage({
                id: band.section.titleId,
                defaultMessage: band.section.defaultTitle
            })}
        </>
    );
}
