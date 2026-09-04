import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Input } from './input';
import {
    Sidebar,
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
    useOptionalSidebar,
    useSidebar
} from './sidebar';

/**
 * QA ORT-49 · F33/F34/F38, EC-21, EC-23, EC-24, EC-28 —
 * `🐞 BUG-design-system-01`, `🐞 BUG-design-system-07`,
 * `♿ A11Y-design-system-07` (and the ⌘B half of ORT-153).
 *
 * The shell mounts `SidebarProvider` with no props at all, so every one of
 * these behaviours is decided here and inherited by every private route. None
 * of it has any e2e coverage — `admin-e2e` never presses ⌘B and never reads the
 * cookie — which is exactly where the three defects sat.
 */

function clearCookie() {
    document.cookie = 'sidebar_state=; path=/; max-age=0';
}

/** The shell's shape: an offcanvas sidebar containing its own collapse trigger. */
function Shell({ children }: { children?: React.ReactNode }) {
    return (
        <SidebarProvider>
            <Sidebar collapsible="offcanvas">
                <SidebarTrigger data-testid="in-sidebar" />
            </Sidebar>
            <SidebarInset>
                <SidebarTrigger data-testid="in-bar" />
                {children}
            </SidebarInset>
        </SidebarProvider>
    );
}

const panel = () =>
    document.querySelector('[data-slot="sidebar-container"]') as HTMLElement;
const root = () =>
    document.querySelector('[data-slot="sidebar"]') as HTMLElement;

beforeEach(clearCookie);
afterEach(clearCookie);

describe('SidebarProvider', () => {
    it('starts expanded and collapses on the trigger', () => {
        render(<Shell />);
        expect(root().getAttribute('data-state')).toBe('expanded');

        fireEvent.click(screen.getByTestId('in-bar'));
        expect(root().getAttribute('data-state')).toBe('collapsed');
    });

    it('takes the collapsed panel out of the tab order and the a11y tree [design-system:I-19]', () => {
        render(<Shell />);

        fireEvent.click(screen.getByTestId('in-bar'));
        expect(panel().hasAttribute('inert')).toBe(true);
        expect(panel().getAttribute('aria-hidden')).toBe('true');
    });

    it('toggles on the ⌘B / Ctrl+B shortcut', () => {
        render(<Shell />);

        fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
        expect(root().getAttribute('data-state')).toBe('collapsed');

        fireEvent.keyDown(window, { key: 'b', metaKey: true });
        expect(root().getAttribute('data-state')).toBe('expanded');
    });

    // BUG-design-system-01 / ORT-153 — `Ctrl+B` is *bold* inside a text field
    // and inside the rich-text editor. The window listener called
    // `preventDefault()` unconditionally, so the sidebar moved and the text did
    // not go bold.
    it('leaves Ctrl+B alone inside a text field [design-system:I-20]', () => {
        render(
            <Shell>
                <Input data-testid="title" />
            </Shell>
        );
        const input = screen.getByTestId('title');
        input.focus();

        const handled = fireEvent.keyDown(input, {
            key: 'b',
            ctrlKey: true,
            bubbles: true
        });

        expect(root().getAttribute('data-state')).toBe('expanded');
        // `false` from fireEvent means preventDefault ran — the browser would
        // then never apply its own bold.
        expect(handled).toBe(true);
    });

    it('leaves Ctrl+B alone inside a textarea', () => {
        render(
            <Shell>
                <textarea data-testid="body" />
            </Shell>
        );
        const area = screen.getByTestId('body');
        area.focus();
        fireEvent.keyDown(area, { key: 'b', ctrlKey: true, bubbles: true });

        expect(root().getAttribute('data-state')).toBe('expanded');
    });

    it('leaves Ctrl+B alone inside a select', () => {
        // The fourth element the invariant names, and the only one with no
        // case: a native `<select>` uses letter keys to jump between options,
        // so swallowing the press costs the user a navigation they meant.
        render(
            <Shell>
                <select data-testid="status">
                    <option>Draft</option>
                </select>
            </Shell>
        );
        const select = screen.getByTestId('status');
        select.focus();
        fireEvent.keyDown(select, { key: 'b', ctrlKey: true, bubbles: true });

        expect(root().getAttribute('data-state')).toBe('expanded');
    });

    it('leaves Ctrl+B alone inside a contenteditable editor', () => {
        render(
            <Shell>
                <div
                    contentEditable
                    data-testid="editor"
                    suppressContentEditableWarning
                />
            </Shell>
        );
        const editor = screen.getByTestId('editor');
        editor.focus();
        fireEvent.keyDown(editor, { key: 'b', ctrlKey: true, bubbles: true });

        expect(root().getAttribute('data-state')).toBe('expanded');
    });

    it('still toggles on ⌘B when focus is on an ordinary button', () => {
        render(<Shell />);
        const button = screen.getByTestId('in-bar');
        button.focus();
        fireEvent.keyDown(button, { key: 'b', ctrlKey: true, bubbles: true });

        expect(root().getAttribute('data-state')).toBe('collapsed');
    });

    // BUG-design-system-01 (second half) / A11Y-design-system-07: the collapse
    // control lives inside the region it hides, so activating it from the
    // keyboard used to drop focus onto <body> with no way back.
    it('hands focus to the visible trigger when collapsing drops it', () => {
        render(<Shell />);
        const inside = screen.getByTestId('in-sidebar');
        inside.focus();
        expect(document.activeElement).toBe(inside);

        act(() => {
            fireEvent.click(inside);
        });

        expect(document.activeElement).not.toBe(document.body);
        expect(document.activeElement).toBe(screen.getByTestId('in-bar'));
    });

    it('leaves focus alone when it was never inside the sidebar', () => {
        render(<Shell />);
        const outside = screen.getByTestId('in-bar');
        outside.focus();

        act(() => {
            fireEvent.click(outside);
        });

        expect(document.activeElement).toBe(outside);
    });

    // BUG-design-system-07 / EC-24 — the cookie was written on every toggle and
    // read by nobody, so a reload always came back expanded.
    it('writes the collapsed state to the sidebar_state cookie', () => {
        render(<Shell />);
        fireEvent.click(screen.getByTestId('in-bar'));

        expect(document.cookie).toContain('sidebar_state=false');
    });

    it('restores the collapsed state from the cookie on the next mount', () => {
        document.cookie = 'sidebar_state=false; path=/';

        render(<Shell />);

        expect(root().getAttribute('data-state')).toBe('collapsed');
    });

    it('ignores a cookie value that is not a boolean', () => {
        document.cookie = 'sidebar_state=banana; path=/';

        render(<Shell />);

        expect(root().getAttribute('data-state')).toBe('expanded');
    });

    it('prefers an explicit defaultOpen over the stored cookie', () => {
        document.cookie = 'sidebar_state=true; path=/';

        render(
            <SidebarProvider defaultOpen={false}>
                <Sidebar collapsible="offcanvas" />
            </SidebarProvider>
        );

        expect(root().getAttribute('data-state')).toBe('collapsed');
    });

    // EC-28 — `document.cookie` throws in a sandboxed iframe without
    // `allow-same-origin`. The write was unguarded, which took the whole toggle
    // down with it.
    it('keeps toggling when the cookie jar is unwritable [design-system:I-23]', () => {
        const jar = Object.getOwnPropertyDescriptor(
            Document.prototype,
            'cookie'
        );
        Object.defineProperty(document, 'cookie', {
            configurable: true,
            get: () => {
                throw new Error('SecurityError');
            },
            set: () => {
                throw new Error('SecurityError');
            }
        });

        try {
            render(<Shell />);
            fireEvent.click(screen.getByTestId('in-bar'));
            expect(root().getAttribute('data-state')).toBe('collapsed');
        } finally {
            delete (document as unknown as Record<string, unknown>).cookie;
            if (jar) Object.defineProperty(Document.prototype, 'cookie', jar);
        }
    });

    it('detaches the shortcut listener on unmount', () => {
        const remove = vi.spyOn(window, 'removeEventListener');
        const { unmount } = render(<Shell />);
        unmount();

        expect(remove.mock.calls.some(([type]) => type === 'keydown')).toBe(
            true
        );
        remove.mockRestore();
    });
});

describe('SidebarInset', () => {
    // The scrollport is the app's only scroll container; ORT-150 fixed the
    // missing focus ring on it and left the naming question open on purpose.
    it('keeps the scrollport a visibly-focusable tab stop [design-system:I-17]', () => {
        render(<Shell />);
        const scrollport = document.querySelector(
            '[data-slot="sidebar-inset-scroll"]'
        ) as HTMLElement;

        expect(scrollport.getAttribute('tabindex')).toBe('0');
        expect(scrollport.className).toContain('focus-visible:ring-2');
        // The ring has to be drawn *inside* the box: this element is the
        // clipping context for the whole page body, so an outset ring is
        // painted outside its own overflow and simply never seen. A tab stop
        // with an invisible indicator is 2.4.7 for the one control every
        // keyboard user passes through.
        expect(scrollport.className).toContain('focus-visible:ring-inset');
    });

    it('exposes exactly one landmark of its own [design-system:I-18]', () => {
        render(<Shell />);
        expect(screen.getAllByRole('main')).toHaveLength(1);
    });
});

/**
 * The two ways to read the sidebar, and why there are two.
 *
 * `useSidebar` throwing is a *feature*: a panel primitive rendered outside the
 * provider would otherwise silently take the collapsed default and a whole
 * region of the shell would go missing with nothing in the console. But the
 * same rule made an optional dependency impossible — `TopBar` adapts to the
 * sidebar when there is one and renders on public pages where there is not, and
 * with only the throwing hook it could only reach the state by try/catch around
 * a hook call, which React does not allow. Hence the pair. Deleting the throw
 * "because the optional one exists" is the regression.
 */
describe('reading the sidebar state', () => {
    function RequiredProbe() {
        const context = useSidebar();
        return <span data-testid="probe">{context.state}</span>;
    }

    function OptionalProbe() {
        const context = useOptionalSidebar();
        return (
            <span data-testid="probe">{context ? context.state : 'null'}</span>
        );
    }

    it('refuses to guess outside a SidebarProvider [design-system:I-26]', () => {
        // React re-throws the render error after logging it; the spy keeps the
        // expected stack out of the run's output.
        const logged = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        expect(() => render(<RequiredProbe />)).toThrow(
            /must be used within a SidebarProvider/
        );

        logged.mockRestore();
    });

    it('answers null outside one, for an optional dependency [design-system:I-26]', () => {
        render(<OptionalProbe />);

        expect(screen.getByTestId('probe').textContent).toBe('null');
    });

    it('reads the same state as the provider from either hook [design-system:I-26]', () => {
        // The complement: `useOptionalSidebar` is the *same* context, not a
        // second source of truth that happens to agree outside a provider.
        render(
            <SidebarProvider defaultOpen={false}>
                <OptionalProbe />
                <RequiredProbe />
            </SidebarProvider>
        );

        expect(
            screen.getAllByTestId('probe').map((node) => node.textContent)
        ).toEqual(['collapsed', 'collapsed']);
    });
});
