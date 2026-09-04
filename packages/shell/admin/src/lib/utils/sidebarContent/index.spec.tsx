import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    SidebarContentProvider,
    useSidebarContent,
    useSidebarContentOverride
} from './index';

/**
 * The sidebar's contextual area — the one region of the chrome a route can take
 * over, and the only piece of the shell whose failure mode is *silence*.
 *
 * Both rules here are races, and neither is reachable from `admin-e2e`. The
 * ownership token exists because two callers overlap for exactly one commit when
 * one workspace's nav replaces another's: the incoming one installs its node,
 * the outgoing one's cleanup runs *after*, and an unguarded `clearContent` blanks
 * the winner's nav — the whole middle of the sidebar empty, with no error and no
 * way back short of another route change. The factory+deps contract exists
 * because the alternative (handing the hook raw JSX) makes a new element every
 * render, which re-runs the effect, which sets state, which renders again.
 *
 * A browser sees the *result* of both (a nav that is there, a page that does not
 * hang) and can attribute neither, so they are pinned here against the provider
 * itself.
 */

/** Renders whatever currently overrides the area, so it can be read back. */
function Region() {
    const override = useSidebarContentOverride();
    return <div data-testid="region">{override}</div>;
}

/**
 * A route-level consumer that claims the area for as long as it is mounted —
 * the shape `workspaces-admin`'s `WorkspaceNav` uses.
 *
 * `onRender` counts factory calls: the hook's contract is that the node is
 * rebuilt when `deps` change and at no other time, and the call count is the
 * only place that is observable.
 */
function Claimant({
    label,
    onRender
}: {
    label: string;
    onRender?: () => void;
}) {
    useSidebarContent(() => {
        onRender?.();
        return <span>{label}</span>;
    }, [label, onRender]);
    return null;
}

/**
 * The area plus however many claimants are mounted over it.
 *
 * The claimants are **keyed**, which is load-bearing: React reconciles a
 * same-typed sibling list by position unless told otherwise, so dropping the
 * first of two unkeyed `Claimant`s would update the survivor's props and unmount
 * the *last* instance — the opposite of the overlap this file is about.
 */
function Area({ labels }: { labels: string[] }) {
    return (
        <SidebarContentProvider>
            <Region />
            {labels.map((label) => (
                <Claimant key={label} label={label} />
            ))}
        </SidebarContentProvider>
    );
}

const region = () => screen.getByTestId('region');

describe('the sidebar contextual area', () => {
    it('holds one node — the last claimant to mount, not both [shell:I-11]', () => {
        render(<Area labels={['outgoing', 'incoming']} />);

        // Not `toContain`: "holds exactly one" is the claim, so an area showing
        // both would pass a containment check and fail this one.
        expect(region().textContent).toBe('incoming');
    });

    it('ignores a clear from a claimant that no longer owns it [shell:I-11]', () => {
        const { rerender } = render(<Area labels={['outgoing', 'incoming']} />);
        expect(region().textContent).toBe('incoming');

        // The overlap, driven exactly as a workspace switch drives it: the loser
        // is still mounted when the winner takes over, and unmounts afterwards.
        // Its cleanup calls `clearContent` with a token that is no longer the
        // one showing, and must do nothing.
        rerender(<Area labels={['incoming']} />);

        expect(region().textContent).toBe('incoming');
    });

    it('clears the area when the claimant that owns it unmounts [shell:I-11]', () => {
        // The other half of the same rule: a cleanup that is *always* a no-op
        // would pass the case above and leave a stale workspace nav on screen
        // for the rest of the session.
        const { rerender } = render(<Area labels={['incoming']} />);
        expect(region().textContent).toBe('incoming');

        rerender(<Area labels={[]} />);

        expect(region().textContent).toBe('');
    });

    it('rebuilds the injected node only when deps change [shell:I-14]', () => {
        const onRender = vi.fn();
        // Not `<Area>`: this claimant has to keep its identity across the
        // re-renders, so it is mounted directly and only its props move.
        const { rerender } = render(
            <SidebarContentProvider>
                <Region />
                <Claimant label="Marketing" onRender={onRender} />
            </SidebarContentProvider>
        );
        expect(onRender).toHaveBeenCalledTimes(1);
        expect(region().textContent).toBe('Marketing');

        // A re-render of the same claimant with the same deps. The factory is a
        // fresh closure every render, so a hook that depended on it — or on a
        // raw JSX node, which is what the factory exists to avoid — would run
        // the effect again here, set state again, and render again: the loop the
        // signature is shaped to prevent.
        rerender(
            <SidebarContentProvider>
                <Region />
                <Claimant label="Marketing" onRender={onRender} />
            </SidebarContentProvider>
        );
        expect(onRender).toHaveBeenCalledTimes(1);

        // And it is genuinely reactive: a changed dep does rebuild, so the area
        // cannot go stale on the workspace whose name just changed.
        rerender(
            <SidebarContentProvider>
                <Region />
                <Claimant label="Docs site" onRender={onRender} />
            </SidebarContentProvider>
        );
        expect(onRender).toHaveBeenCalledTimes(2);
        expect(region().textContent).toBe('Docs site');
    });

    it('refuses to be used outside a provider, rather than silently doing nothing', () => {
        // Fail-loud matters here: an unfilled area is invisible, so a claimant
        // mounted above the provider would otherwise have no symptom at all.
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {
            return undefined;
        });
        try {
            expect(() => render(<Claimant label="orphan" />)).toThrow(
                /SidebarContentProvider/
            );
        } finally {
            quiet.mockRestore();
        }
    });
});
