import { defineMessages, useIntl } from 'react-intl';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button, TopBarActions } from '@orthacms/design-system';
import {
    RIGHT_PANEL_ID,
    usePageChromeHosts,
    usePanelFocusHandoff,
    useRightPanel
} from '../../utils/pageChrome';

const messages = defineMessages({
    show: {
        id: 'shell.rightPanel.show',
        defaultMessage: 'Show {title}'
    },
    hide: {
        id: 'shell.rightPanel.hideFromBar',
        defaultMessage: 'Hide {title}'
    },
    attention: {
        id: 'shell.rightPanel.attention',
        defaultMessage: 'Something here needs your attention.'
    }
});

/**
 * The **trailing region of a page's top bar**: whatever the open page put there
 * through `PageActionsPortal` (the entry editor's Publish + ⋯), plus the right
 * panel's toggle: while a docked panel is collapsed, the button that brings it
 * back; for an **unpinned** (overlay) panel, always — open or closed — since a
 * panel floating over the page has no column of its own to keep a control in.
 *
 * Render it as the **last** child of a `TopBar`. `PageTopBar` already does; a
 * bar that composes `TopBar` itself (content-admin's `ContentTopBar`) adds it the
 * same way, which is the whole reason this is a component rather than something
 * baked into `TopBar` — the design system can't reach the shell's context.
 *
 * The host stays mounted whether or not anything fills it, so a page's actions
 * can portal in the moment they mount.
 */
export function PageActions() {
    const intl = useIntl();
    const { setActionsHost } = usePageChromeHosts();
    const panel = useRightPanel();
    // A docked column brings its own Hide button, so the bar offers only the
    // way back. An unpinned panel floats over the page and has no column of
    // its own to live in: its toggle stays in the bar, open or closed, so the
    // way in and the way out are one control in one place.
    const floating = panel?.mode === 'overlay';
    const showExpand = !!panel?.present && (!panel.open || floating);
    const expanded = !!panel?.open;
    // Collapsing the panel destroys the button that did it (it goes `inert` with
    // the rest of the column), so this one — the only way back — takes the focus.
    const expandRef = usePanelFocusHandoff('bar');

    return (
        <TopBarActions>
            <div ref={setActionsHost} className="flex items-center gap-2" />
            {showExpand ? (
                <Button
                    ref={expandRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative -mr-1 size-7 shrink-0 text-muted-foreground"
                    aria-controls={RIGHT_PANEL_ID}
                    aria-expanded={expanded}
                    aria-label={intl.formatMessage(
                        expanded ? messages.hide : messages.show,
                        { title: panel.title }
                    )}
                    title={
                        panel.attention
                            ? intl.formatMessage(messages.attention)
                            : undefined
                    }
                    onClick={panel.toggle}
                >
                    {expanded ? (
                        <PanelRightClose aria-hidden />
                    ) : (
                        <PanelRightOpen aria-hidden />
                    )}
                    {panel.attention ? (
                        <span
                            aria-hidden
                            data-testid="right-panel-attention"
                            className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                        />
                    ) : null}
                </Button>
            ) : null}
        </TopBarActions>
    );
}
