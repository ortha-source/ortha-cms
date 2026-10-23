import { useEffect } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { PanelRightClose, Pin, PinOff } from 'lucide-react';
import {
    Button,
    cn,
    ResizeHandle,
    useIsMobile,
    useResizablePanel
} from '@orthacms/design-system';
import {
    RIGHT_PANEL_ID,
    RIGHT_PANEL_LAYOUT_ID,
    usePageChromeHosts,
    usePanelFocusHandoff,
    useRightPanel
} from '../../utils/pageChrome';

const messages = defineMessages({
    hide: {
        id: 'shell.rightPanel.hide',
        defaultMessage: 'Hide {title}'
    },
    resize: {
        id: 'shell.rightPanel.resize',
        defaultMessage: 'Resize {title}'
    },
    pin: {
        id: 'shell.rightPanel.pin',
        defaultMessage: 'Pin {title} beside the page'
    },
    unpin: {
        id: 'shell.rightPanel.unpin',
        defaultMessage: 'Unpin {title}'
    }
});

/**
 * The right panel's bounds in the panel layout, in pixels. Its collapsed state
 * shares the entry, but is flipped through the page-chrome `toggle` — which
 * also runs the slide and the focus handoff — never written here directly.
 */
export const RIGHT_PANEL = {
    id: RIGHT_PANEL_LAYOUT_ID,
    defaultWidth: 352,
    minWidth: 288,
    maxWidth: 640,
    maxViewportRatio: 0.35,
    collapsible: true,
    cssVar: '--right-panel-width'
} as const;

/**
 * The shell's **right panel** — the column beside the main inset that a page
 * fills through `RightPanelPortal` (the entry editor's Properties). It owns the
 * chrome only: a header aligned to the page's top bar (same `h-12` + bottom
 * border, so the two read as one band) over an independently scrolling body.
 *
 * The body host is **always mounted**, even with no panel registered and while
 * one is collapsed — a portal needs its target to exist, and keeping it mounted
 * means collapsing the panel never unmounts the filler, throwing away its state
 * and refetching its data. When there is nothing to show the column is zero-width
 * and `inert`, so it takes no space and leaves the accessibility tree.
 *
 * Collapsed, the control that brings it back lives in the top bar (`PageActions`)
 * — the panel can't offer it while it has no width to draw in.
 *
 * It **slides**, on the app sidebar's timing and curve (300ms, ease-in-out). The mechanism is the
 * sidebar's too: the column animates its width while the panel inside keeps its
 * own, so the panel slides out of the clip instead of re-wrapping its contents
 * on every frame. (The sidebar spells this as a `fixed` panel moved by `left`
 * beside a width-animated gap; a right-edge column can just narrow, because its
 * right edge is already pinned to the viewport.)
 *
 * The transition is **gated on `panel.animate`**, which only the toggle arms —
 * so the panel does not slide in on first paint, or each time a page registers
 * one. Motion here means "you just did that", nothing else.
 *
 * **On a phone it is a bottom sheet instead of a column**: a 22rem column would
 * leave the content nothing. It slides up from the bottom edge over a scrim
 * that dismisses it, and it starts collapsed there regardless of the desktop
 * preference (see `PageChromeProvider`).
 *
 * **As a column it is resizable**: a handle on its left edge drags its width
 * between {@link RIGHT_PANEL}'s bounds and collapses it when dragged well past
 * the minimum — through `toggle`, so the drag collapses it exactly the way the
 * Hide button does. The width is the `--right-panel-width` variable, declared
 * here and read by both the column and the panel inside it.
 */
export function AppRightPanel() {
    const intl = useIntl();
    const { setPanelHost } = usePageChromeHosts();
    const panel = useRightPanel();
    const isMobile = useIsMobile();
    const shown = !!panel?.present && panel.open;
    const animate = !!panel?.animate;
    // A desktop overlay: a sheet over the whole page, opened on demand.
    const floating = !isMobile && panel?.mode === 'overlay';
    // Both overlay shapes cover the page and take it out of reach while up.
    const covering = isMobile || floating;
    const collapseRef = usePanelFocusHandoff('panel');
    const toggle = panel?.toggle;
    const resizable = useResizablePanel(RIGHT_PANEL);

    // `Esc` dismisses the mobile overlay. The overlay is not a Radix `Sheet` on
    // purpose — a Sheet unmounts its content when closed, and the panel's body is
    // a **portal host** that has to stay mounted or collapsing would throw away
    // the filler's state and refetch its data (see the class comment). So the one
    // affordance a Sheet would have brought for free is added by hand.
    //
    // Deliberately yields to anything stacked on top: a dialog, menu or listbox
    // open over the panel owns `Esc` first, and closing the panel out from under
    // it would strand the user twice over.
    useEffect(() => {
        if (!(isMobile || floating) || !shown || !toggle) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            //
            // `:not([data-slot=right-panel-dialog])` because the panel is
            // **itself** a `role="dialog"` while it covers the page (`ORT-154`) — without the
            // exclusion this handler found the panel, concluded something was
            // stacked on top of it, and yielded to itself, so `Esc` stopped
            // working the moment the attribute was added.
            if (
                document.querySelector(
                    '[role="dialog"]:not([data-slot="right-panel-dialog"]),[role="alertdialog"],[role="menu"],[role="listbox"]'
                )
            ) {
                return;
            }
            toggle();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isMobile, floating, shown, toggle]);

    return (
        <>
            {covering ? (
                // A scrim, not a control: it was a `<button aria-hidden
                // tabIndex={-1}>`, which advertises a role to nobody and cannot be
                // operated by keyboard — a dismiss affordance that only a pointer
                // could reach. The keyboard equivalents are `Esc` (above) and the
                // panel's own collapse button, so this is honest as inert
                // decoration. It stays mounted so it can fade out with the
                // sheet, and takes clicks only while the sheet is up; a click
                // on it closes through `toggle`, which hands focus back to the
                // top bar rather than dropping it on `<body>`.
                <div
                    aria-hidden
                    data-slot="right-panel-scrim"
                    onClick={shown ? toggle : undefined}
                    className={cn(
                        'fixed inset-0 z-40 cursor-default bg-black/40 dark:bg-black/60',
                        animate &&
                            'transition-opacity duration-300 ease-(--ds-ease-drawer) motion-reduce:transition-none',
                        shown ? 'opacity-100' : 'pointer-events-none opacity-0'
                    )}
                />
            ) : null}
            <aside
                ref={resizable.ref}
                style={isMobile ? undefined : resizable.style}
                data-mode={floating ? 'overlay' : 'docked'}
                id={RIGHT_PANEL_ID}
                aria-label={shown ? panel?.title : undefined}
                // On a phone this is an overlay covering the page, so it says so
                // — but only *here*, and only now. The attributes are a promise
                // that everything outside is unreachable, and until `AppShell`
                // started inerting the page behind it (`ORT-154`) that promise
                // would have been false; a truthful `complementary` beats a
                // `dialog` the markup does not keep. As a desktop column it
                // covers nothing and stays a complementary landmark.
                inert={!shown}
                className={cn(
                    'relative flex shrink-0 overflow-hidden motion-reduce:transition-none',
                    isMobile
                        ? // A bottom sheet: up from the bottom edge, where a
                          // thumb already is, over the page it describes.
                          cn(
                              'fixed inset-x-0 bottom-0 z-50 h-[85svh] rounded-t-2xl border-t shadow-2xl',
                              // `translate`, not `transform`: Tailwind v4
                              // writes it as its own property.
                              animate &&
                                  'transition-[translate] duration-300 ease-(--ds-ease-drawer)',
                              shown ? 'translate-y-0' : 'translate-y-full'
                          )
                        : floating
                          ? // A classic sheet: the full height of the window
                            // at its right edge, over a scrim. It takes no
                            // width from the page, so the form keeps its
                            // measure. It slides on `translate` — the card it
                            // replaced transitioned `transform`, which Tailwind
                            // v4 does not write, so it faded while its
                            // movement snapped. Its shadow goes with it: at
                            // `translate-x-full` a shadow would still bleed
                            // back into the window.
                            cn(
                                'fixed inset-y-0 right-0 z-50 w-(--right-panel-width) max-w-[calc(100vw-3rem)] border-l',
                                animate &&
                                    'transition-[translate,box-shadow] duration-300 ease-(--ds-ease-drawer)',
                                shown
                                    ? 'translate-x-0 shadow-2xl'
                                    : 'pointer-events-none translate-x-full shadow-none'
                            )
                          : // Column: full height of the viewport-bounded shell
                            // row, so the panel scrolls on its own rather than
                            // riding the inset's scrollport.
                            cn(
                                'h-full',
                                animate &&
                                    'transition-[width] duration-300 ease-in-out',
                                shown ? 'w-(--right-panel-width)' : 'w-0'
                            )
                )}
            >
                {/* Never unmounted, and — in the column layout — a **fixed**
                    width: this is what slides. It must not be `max-w-full`
                    there, or it would shrink with the animating column and
                    re-wrap its contents line by line instead of sliding out of
                    the clip. On mobile the column doesn't animate its width (it
                    translates), so the panel simply fills it. */}
                <div
                    // The dialog is this wrapper, not the `<aside>`: a
                    // `complementary` element may not take `role="dialog"`
                    // (axe's `aria-allowed-role`), and swapping the aside's
                    // tag would remount the portal host inside it.
                    data-slot="right-panel-dialog"
                    role={covering && shown ? 'dialog' : undefined}
                    aria-modal={covering && shown ? true : undefined}
                    aria-label={covering && shown ? panel?.title : undefined}
                    className={cn(
                        'relative flex h-full shrink-0 flex-col bg-background',
                        isMobile && 'rounded-t-2xl',
                        floating ? 'w-full' : 'border-l',
                        isMobile || floating
                            ? 'w-full'
                            : 'w-(--right-panel-width)'
                    )}
                >
                    {shown && !isMobile && !floating && toggle ? (
                        // Inside the panel rather than on the column: the
                        // column clips, so a handle hanging over its edge
                        // would be cut in half.
                        <ResizeHandle
                            {...resizable.handleProps}
                            onCollapse={toggle}
                            edge="left"
                            className="left-0"
                            controls={RIGHT_PANEL_ID}
                            label={intl.formatMessage(messages.resize, {
                                title: panel?.title ?? ''
                            })}
                        />
                    ) : null}
                    {/* On a page with tabs under its bar the band is 48 + 36px
                        (`TopBarTabs` is a fixed `h-9`), so the header grows to
                        rule itself on the same line, keeping its title level
                        with the breadcrumb. */}
                    <div
                        className={cn(
                            'flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4',
                            // Only the column sits beside the page's band; a
                            // sheet over it has a header of its own height.
                            !floating &&
                                '[[data-slot=app-frame]:has([data-slot=top-bar-tabs])_&]:h-21 [[data-slot=app-frame]:has([data-slot=top-bar-tabs])_&]:pb-9'
                        )}
                    >
                        <h2 className="min-w-0 truncate text-sm font-semibold tracking-[-0.01em]">
                            {panel?.title}
                        </h2>
                        <div className="ml-auto flex items-center gap-0.5">
                            {panel?.pinnable ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 shrink-0 text-muted-foreground"
                                    aria-pressed={panel.pinned}
                                    aria-label={intl.formatMessage(
                                        panel.pinned
                                            ? messages.unpin
                                            : messages.pin,
                                        { title: panel.title }
                                    )}
                                    onClick={() =>
                                        panel.setPinned(!panel.pinned)
                                    }
                                >
                                    {panel.pinned ? (
                                        <PinOff aria-hidden />
                                    ) : (
                                        <Pin aria-hidden />
                                    )}
                                </Button>
                            ) : null}
                            <Button
                                ref={collapseRef}
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="-mr-1 size-7 shrink-0 text-muted-foreground"
                                aria-controls={RIGHT_PANEL_ID}
                                aria-expanded
                                aria-label={intl.formatMessage(messages.hide, {
                                    title: panel?.title ?? ''
                                })}
                                onClick={toggle}
                            >
                                <PanelRightClose aria-hidden />
                            </Button>
                        </div>
                    </div>
                    <div
                        ref={setPanelHost}
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                    />
                </div>
            </aside>
        </>
    );
}
