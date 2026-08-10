import type { ComponentType } from 'react';
import { createSlot } from '@ortha-cms/utils-admin';

/**
 * How wide a widget renders in the Insights grid, in twelfths.
 *
 * The grid is 12 columns: `xs` is 3, `sm` 4, `md` 6, `lg` 8, `full` 12. So four
 * `xs` stat tiles, or `sm` + `lg`, or `md` + `md`, each fill a row exactly.
 *
 * Sizes are a **request, not a guarantee** — below the `lg` breakpoint every
 * widget collapses toward full width, because a heat grid or a bar list squeezed
 * into a third of a phone screen is unreadable.
 */
export type InsightsWidgetSize = 'xs' | 'sm' | 'md' | 'lg' | 'full';

/**
 * One widget on the Insights page, contributed by the package that owns the
 * data behind it. The Insights plugin ships the page, the grid, the range
 * picker and the card shell — it contributes **no widgets of its own**.
 *
 * `Component` takes no props: like {@link https://react.dev | shell-admin}'s
 * `HOME_SECTION_SLOT`, a widget reads what it needs (the open workspace, the
 * selected range, its own query) rather than being handed it. That keeps the
 * page from having to know what any given widget's data looks like.
 */
export type InsightsWidget = {
    /** Stable identity — the React key, and the handle a saved layout would use. */
    id: string;
    /** The {@link InsightsSection} `id` this widget belongs under. */
    section: string;
    /** Sort order within the section; lower renders first. */
    order: number;
    /** Grid width. Defaults to `md` (half a row). */
    size?: InsightsWidgetSize;
    /**
     * Permission required to see this widget at all.
     *
     * Carried on the item **as well as** being enforced inside the component,
     * for the same reason the workspace sidebar checks it twice: the page has to
     * know whether a section has any visible widgets *before* it renders that
     * section's heading, or an operator without `content:read` gets a "Content"
     * header sitting over nothing.
     */
    permission?: string;
    /** `react-intl` id for the widget's name. */
    titleId: string;
    /**
     * Fallback name. Used by the error boundary — "Gone quiet couldn't load" is
     * a far more useful failure than an anonymous broken card — and by any
     * future layout editor that has to list widgets without mounting them.
     */
    defaultTitle: string;
    /** The widget body. Renders its own {@link WidgetCard}. */
    Component: ComponentType;
};

/**
 * A named group of widgets, rendered as a labelled band on the Insights page.
 * A section with no visible widgets renders nothing at all — heading included.
 */
export type InsightsSection = {
    /** Stable identity, referenced by {@link InsightsWidget.section}. */
    id: string;
    /** Sort order among sections; lower renders first. */
    order: number;
    /** `react-intl` id for the section heading. */
    titleId: string;
    /** Fallback heading text. */
    defaultTitle: string;
};

/**
 * The extension point plugins contribute Insights widgets to.
 *
 * @example
 * ```tsx
 * slots: [
 *     {
 *         slot: INSIGHTS_WIDGET_SLOT,
 *         items: [
 *             {
 *                 id: 'insights.content.stale',
 *                 section: INSIGHTS_SECTION_IDS.Content,
 *                 order: 10,
 *                 size: 'md',
 *                 permission: 'content:read',
 *                 titleId: 'content.insights.stale.title',
 *                 defaultTitle: 'Gone quiet',
 *                 Component: StaleEntriesWidget
 *             }
 *         ]
 *     }
 * ]
 * ```
 */
export const INSIGHTS_WIDGET_SLOT =
    createSlot<InsightsWidget>('insights.widget');

/**
 * The extension point for Insights sections. A plugin that only adds widgets to
 * an existing section never touches this — contribute here to open a new band.
 */
export const INSIGHTS_SECTION_SLOT =
    createSlot<InsightsSection>('insights.section');

/**
 * Section ids the Insights plugin itself registers, so contributors reference a
 * constant rather than retyping a string that has to match exactly. A widget
 * pointing at an unregistered section id is dropped rather than rendered
 * loose — the page logs it in development.
 */
export const INSIGHTS_SECTION_IDS = {
    Overview: 'overview',
    Content: 'content',
    Reach: 'reach',
    Team: 'team'
} as const;
