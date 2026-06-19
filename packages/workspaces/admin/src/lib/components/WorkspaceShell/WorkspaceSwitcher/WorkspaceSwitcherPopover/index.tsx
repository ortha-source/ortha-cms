import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Plus } from 'lucide-react';
import { avatarColorVar, cn } from '@ortha-cms/design-system';
import { initialsOf } from '@ortha-cms/utils-admin';
import type { Workspace } from '../../../../types/workspace';

/** Intl descriptors for the switcher popover, co-located here. */
const messages = defineMessages({
    heading: {
        id: 'workspaces.switcher.heading',
        defaultMessage: 'Switch workspace'
    },
    sub: {
        id: 'workspaces.switcher.sub',
        defaultMessage:
            '{count, plural, one {# member} other {# members}} · {status}'
    },
    create: {
        id: 'workspaces.switcher.create',
        defaultMessage: 'New workspace'
    }
});

type WorkspaceSwitcherPopoverProps = {
    /** The workspace currently open (gets the trailing check). */
    current: Workspace;
    /** Every workspace the user can switch to. */
    workspaces: Workspace[];
    /** Closes the popover (outside click, Esc, or after navigating). */
    onClose: () => void;
};

/**
 * The switcher's popover: a fixed panel anchored just right of the rail, listing
 * every workspace (switching navigates to its base, which redirects to its first
 * section) over a "New workspace" footer. A transparent full-viewport backdrop
 * closes it on outside click; `Esc` closes too. Enter motion (fade + slide) is
 * driven by an `entered` flag flipped after mount, and dropped under
 * `prefers-reduced-motion`.
 */
export function WorkspaceSwitcherPopover({
    current,
    workspaces,
    onClose
}: WorkspaceSwitcherPopoverProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const panelRef = useRef<HTMLDivElement>(null);
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => setEntered(true));
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        // Move focus into the panel so Tab cycles its rows and Esc has a target.
        panelRef.current?.focus();
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const go = (path: string) => {
        onClose();
        navigate(path);
    };

    return (
        <>
            {/* Transparent backdrop: catches outside clicks to close. */}
            <div
                className="fixed inset-0 z-[75]"
                aria-hidden
                onClick={onClose}
            />
            <div
                ref={panelRef}
                role="menu"
                aria-label={intl.formatMessage(messages.heading)}
                tabIndex={-1}
                // Anchored right of the 64px rail; `top` clears the 48px navbar
                // plus the rail's 12px top padding (nested chrome).
                className={cn(
                    'fixed left-[72px] top-[60px] z-[76] w-[300px] rounded-xl border border-border bg-popover p-2 shadow-md outline-none',
                    'transition-[opacity,transform] duration-[140ms] ease-out',
                    'motion-reduce:transition-none',
                    entered
                        ? 'translate-x-0 opacity-100'
                        : '-translate-x-1.5 opacity-0'
                )}
            >
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {intl.formatMessage(messages.heading)}
                </p>
                {workspaces.map((workspace) => {
                    const isCurrent = workspace.id === current.id;
                    return (
                        <button
                            key={workspace.id}
                            type="button"
                            role="menuitem"
                            onClick={() => go(`/workspaces/${workspace.id}`)}
                            className={cn(
                                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-[120ms] hover:bg-accent',
                                isCurrent && 'bg-accent'
                            )}
                        >
                            <span
                                aria-hidden
                                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white"
                                style={{
                                    backgroundColor: avatarColorVar(
                                        workspace.color
                                    )
                                }}
                            >
                                {initialsOf(workspace.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-medium">
                                    {workspace.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {intl.formatMessage(messages.sub, {
                                        count: workspace.members.length,
                                        status: workspace.status
                                    })}
                                </span>
                            </span>
                            {isCurrent ? (
                                <Check className="size-4 shrink-0 text-muted-foreground" />
                            ) : null}
                        </button>
                    );
                })}
                <div className="my-1 h-px bg-border" />
                <button
                    type="button"
                    role="menuitem"
                    onClick={() => go('/workspaces/new')}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-[120ms] hover:bg-accent"
                >
                    <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                    >
                        <Plus className="size-4" />
                    </span>
                    <span className="text-[13.5px] font-medium">
                        {intl.formatMessage(messages.create)}
                    </span>
                </button>
            </div>
        </>
    );
}
