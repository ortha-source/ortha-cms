import { defineMessages, useIntl } from 'react-intl';
import { PanelRightClose } from 'lucide-react';
import { Button, cn } from '@ortha-cms/design-system';
import {
    RIGHT_PANEL_ID,
    usePageChromeHosts,
    useRightPanel
} from '../../utils/pageChrome';

const messages = defineMessages({
    hide: {
        id: 'shell.rightPanel.hide',
        defaultMessage: 'Hide {title}'
    }
});

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
 */
export function AppRightPanel() {
    const intl = useIntl();
    const { setPanelHost } = usePageChromeHosts();
    const panel = useRightPanel();
    const shown = !!panel?.present && panel.open;

    return (
        <aside
            id={RIGHT_PANEL_ID}
            aria-label={shown ? panel?.title : undefined}
            inert={!shown}
            className={cn(
                'sticky top-0 flex h-svh shrink-0 flex-col bg-background',
                shown ? 'w-[22rem] border-l' : 'w-0 overflow-hidden'
            )}
        >
            {shown ? (
                <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
                    <h2 className="min-w-0 truncate text-sm font-semibold tracking-[-0.01em]">
                        {panel.title}
                    </h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-mr-1 size-7 shrink-0 text-muted-foreground"
                        aria-controls={RIGHT_PANEL_ID}
                        aria-expanded
                        aria-label={intl.formatMessage(messages.hide, {
                            title: panel.title
                        })}
                        onClick={panel.toggle}
                    >
                        <PanelRightClose aria-hidden />
                    </Button>
                </div>
            ) : null}
            <div
                ref={setPanelHost}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            />
        </aside>
    );
}
