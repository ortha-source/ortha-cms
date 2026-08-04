import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import { BLOCK_GROUP } from '@ortha-cms/wysiwyg-core';
import type { BlockTypeItem } from '../blockTypes';
import type { SlashMenuState } from '../slashCommand';

const messages = defineMessages({
    label: { id: 'wysiwyg.slash.label', defaultMessage: 'Insert a block' },
    empty: {
        id: 'wysiwyg.slash.empty',
        defaultMessage: 'No blocks match “{query}”'
    },
    basic: { id: 'wysiwyg.group.basic', defaultMessage: 'Basic' },
    media: { id: 'wysiwyg.group.media', defaultMessage: 'Media' },
    advanced: { id: 'wysiwyg.group.advanced', defaultMessage: 'Advanced' }
});

/** Menu size, used to flip it above the caret when it would overflow. */
const MENU_WIDTH = 288;
const MENU_MAX_HEIGHT = 320;

const GROUP_LABEL = {
    [BLOCK_GROUP.Basic]: messages.basic,
    [BLOCK_GROUP.Media]: messages.media,
    [BLOCK_GROUP.Advanced]: messages.advanced
} as const;

/**
 * The `/` command palette.
 *
 * Two things are deliberate. It renders in a **portal** at viewport
 * coordinates, so it is never clipped by the editor's own scroll container.
 * And it never takes **focus** — the caret stays where the author is typing,
 * which is what lets them keep narrowing the query. The arrow keys are handled
 * inside the suggestion plugin and reach this component only as a new
 * `index`; the active option is announced through `aria-activedescendant` on
 * the editor rather than by moving focus here.
 */
export function TiptapSlashMenu({
    state,
    container
}: {
    state: SlashMenuState;
    /** Where to portal to. The editor root, so a modal can't make it inert. */
    container: HTMLElement | null;
}) {
    const intl = useIntl();
    const listRef = useRef<HTMLDivElement>(null);

    // Keep the highlighted row in view as the arrows walk past the fold.
    useEffect(() => {
        listRef.current
            ?.querySelector('[data-active="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [state.index]);

    const flipUp = state.rect.bottom + MENU_MAX_HEIGHT > window.innerHeight;
    const style = {
        left: Math.min(state.rect.left, window.innerWidth - MENU_WIDTH - 8),
        top: flipUp ? undefined : state.rect.bottom + 6,
        bottom: flipUp ? window.innerHeight - state.rect.top + 6 : undefined,
        width: MENU_WIDTH,
        maxHeight: MENU_MAX_HEIGHT
    };

    /** The catalogue in menu order, split into its sections. */
    const groups = [
        BLOCK_GROUP.Basic,
        BLOCK_GROUP.Media,
        BLOCK_GROUP.Advanced
    ].map((group) => ({
        group,
        items: state.items.filter((item) => item.group === group)
    }));
    const active = state.items[state.index];

    return createPortal(
        <div
            id="wysiwyg-slash-menu"
            role="listbox"
            aria-label={intl.formatMessage(messages.label)}
            aria-activedescendant={
                active ? `wysiwyg-slash-${active.id}` : undefined
            }
            ref={listRef}
            style={style}
            className="bg-popover text-popover-foreground fixed z-50 overflow-y-auto rounded-md border p-1 shadow-md"
        >
            {state.items.length === 0 && (
                <p className="text-muted-foreground px-2 py-3 text-sm">
                    {intl.formatMessage(messages.empty, { query: state.query })}
                </p>
            )}
            {groups.map(({ group, items }) =>
                items.length === 0 ? null : (
                    <div
                        key={group}
                        role="group"
                        aria-label={intl.formatMessage(GROUP_LABEL[group])}
                    >
                        <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                            {intl.formatMessage(GROUP_LABEL[group])}
                        </p>
                        {items.map((item: BlockTypeItem) => (
                            <button
                                key={item.id}
                                id={`wysiwyg-slash-${item.id}`}
                                type="button"
                                role="option"
                                aria-selected={item.id === active?.id}
                                data-active={item.id === active?.id}
                                // The caret must not leave the block: a menu
                                // that steals focus can't be typed at to
                                // narrow it.
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => state.choose(item)}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                                    item.id === active?.id
                                        ? 'bg-accent text-accent-foreground'
                                        : 'hover:bg-accent/50'
                                )}
                            >
                                <item.Icon
                                    aria-hidden
                                    className="text-muted-foreground size-4 shrink-0"
                                />
                                <span className="truncate">
                                    {intl.formatMessage(item.label)}
                                </span>
                            </button>
                        ))}
                    </div>
                )
            )}
        </div>,
        container ?? document.body
    );
}
