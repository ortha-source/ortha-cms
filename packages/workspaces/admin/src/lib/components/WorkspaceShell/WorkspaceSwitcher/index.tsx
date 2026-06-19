import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown } from 'lucide-react';
import { avatarColorVar } from '@ortha-cms/design-system';
import { initialsOf } from '@ortha-cms/utils-admin';
import { RailTooltip } from '../RailTooltip';
import { WorkspaceSwitcherPopover } from './WorkspaceSwitcherPopover';
import type { Workspace } from '../../../types/workspace';

/** Intl descriptors for the switcher trigger, co-located here. */
const messages = defineMessages({
    trigger: {
        id: 'workspaces.switcher.trigger',
        defaultMessage: 'Switch workspace, current: {name}'
    }
});

type WorkspaceSwitcherProps = {
    /** The workspace currently open. */
    current: Workspace;
    /** Every workspace the switcher can jump to. */
    workspaces: Workspace[];
};

/**
 * The rail header: a 40×40 accent-tinted chip (the workspace's initials) with a
 * caret badge clipped to its corner, signalling "click to switch". Hovering
 * lifts it 1px — the only transform allowed in the rail. Clicking toggles the
 * {@link WorkspaceSwitcherPopover}; its tooltip is suppressed while the popover
 * is open.
 */
export function WorkspaceSwitcher({
    current,
    workspaces
}: WorkspaceSwitcherProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <RailTooltip label={current.name} suppressed={open}>
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={intl.formatMessage(messages.trigger, {
                        name: current.name
                    })}
                    className="relative flex size-8 items-center justify-center rounded-lg text-xs font-semibold tracking-[-0.01em] text-white shadow-xs transition-[transform,box-shadow] duration-[120ms] hover:-translate-y-px hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none"
                    style={{ backgroundColor: avatarColorVar(current.color) }}
                >
                    {initialsOf(current.name)}
                    <span
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 flex size-[13px] items-center justify-center rounded-full border border-border bg-background"
                    >
                        <ChevronDown className="size-2 text-muted-foreground" />
                    </span>
                </button>
            </RailTooltip>
            {open ? (
                <WorkspaceSwitcherPopover
                    current={current}
                    workspaces={workspaces}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </div>
    );
}
