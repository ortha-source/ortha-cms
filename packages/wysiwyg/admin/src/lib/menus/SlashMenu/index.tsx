import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { SlashState } from '../../editor/editorContext';
import type { BlockTypeGroup, BlockTypeItem } from '../useBlockTypeItems';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.slash.label',
        defaultMessage: 'Insert a block'
    },
    empty: {
        id: 'wysiwyg.slash.empty',
        defaultMessage: 'No blocks match “{query}”'
    }
});

/** Menu size, used to flip it above the caret when it would overflow. */
const MENU_WIDTH = 288;
const MENU_MAX_HEIGHT = 320;

/**
 * The `/` command palette.
 *
 * Two things are deliberate. It renders in a **portal** at viewport
 * coordinates, so it is never clipped by the editor's own scroll container.
 * And it never takes **focus** — the caret stays in the block the author is
 * typing in, which is what lets them keep narrowing the query; the editable
 * forwards ↑/↓/Enter/Escape here instead (`handleOverlayKey`), and the active
 * option is announced through `aria-activedescendant`.
 */
export function SlashMenu({
    state,
    groups,
    activeId,
    onSelect
}: {
    state: SlashState;
    groups: readonly BlockTypeGroup[];
    /** The highlighted item's id — owned by the editor, moved by the arrows. */
    activeId: string | null;
    onSelect(item: BlockTypeItem): void;
}) {
    const intl = useIntl();
    const listRef = useRef<HTMLDivElement>(null);

    // Keep the highlighted row in view as the arrows walk past the fold.
    useEffect(() => {
        listRef.current
            ?.querySelector('[data-active="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [activeId]);

    const flipUp = state.rect.bottom + MENU_MAX_HEIGHT > window.innerHeight;
    const style = {
        left: Math.min(state.rect.left, window.innerWidth - MENU_WIDTH - 8),
        top: flipUp ? undefined : state.rect.bottom + 6,
        bottom: flipUp ? window.innerHeight - state.rect.top + 6 : undefined,
        width: MENU_WIDTH,
        maxHeight: MENU_MAX_HEIGHT
    };

    return createPortal(
        <div
            id="wysiwyg-slash-menu"
            role="listbox"
            aria-label={intl.formatMessage(messages.label)}
            ref={listRef}
            style={style}
            className="bg-popover text-popover-foreground fixed z-50 overflow-y-auto rounded-md border p-1 shadow-md"
        >
            {groups.length === 0 && (
                <p className="text-muted-foreground px-2 py-3 text-sm">
                    {intl.formatMessage(messages.empty, {
                        query: state.query
                    })}
                </p>
            )}
            {groups.map((group) => (
                <div key={group.id} role="group" aria-label={group.label}>
                    <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {group.label}
                    </p>
                    {group.items.map((item) => (
                        <button
                            key={item.id}
                            id={`wysiwyg-slash-${item.id}`}
                            type="button"
                            role="option"
                            aria-selected={item.id === activeId}
                            data-active={item.id === activeId}
                            // The caret must not leave the block: a menu that
                            // steals focus can't be typed at to narrow it.
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onSelect(item)}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                                item.id === activeId
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/50'
                            )}
                        >
                            <item.Icon
                                aria-hidden
                                className="text-muted-foreground size-4 shrink-0"
                            />
                            <span className="truncate">{item.label}</span>
                        </button>
                    ))}
                </div>
            ))}
        </div>,
        document.body
    );
}
