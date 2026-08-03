import { isHexColor } from '@ortha-cms/wysiwyg-core';

/**
 * The "any colour you like" row of a palette — a native colour well.
 *
 * `<input type="color">` rather than a hand-built wheel: it is the one picker
 * every platform already has, it is keyboard-operable and screen-reader-labelled
 * without any work, and on a phone it opens the OS picker. It emits `#rrggbb`,
 * which is exactly the form the sanitizer stores.
 *
 * It sits **outside** `DropdownMenuItem` on purpose. A menu item swallows the
 * pointer to select-and-close, which would shut the menu the instant the well
 * was clicked and never let the picker open.
 */
export function CustomSwatch({
    label,
    caption,
    value,
    onPick,
    onOpen
}: {
    /** Accessible name — "Custom text colour" / "Custom highlight colour". */
    label: string;
    /** The visible row text. */
    caption: string;
    /** The current colour, so the well opens on it. Palette names are ignored. */
    value: string | null;
    onPick(hex: string): void;
    /** Called before the picker takes focus, so the selection can be saved. */
    onOpen(): void;
}) {
    // A palette name is not something a colour well can show; it opens on the
    // seed instead, which is honest — the author is picking a new colour.
    const current = value && isHexColor(value) ? value : '#3b82f6';

    return (
        <label
            className="hover:bg-accent hover:text-accent-foreground relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
            onPointerDown={onOpen}
        >
            <span
                aria-hidden
                className="border-border size-4 shrink-0 rounded border"
                style={{ backgroundColor: current }}
            />
            {caption}
            <input
                type="color"
                aria-label={label}
                value={current}
                // `onInput` rather than `onChange`: dragging inside the picker
                // streams values, and an author expects the text to follow the
                // swatch rather than jump once the dialog is dismissed.
                onInput={(event) => onPick(event.currentTarget.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
        </label>
    );
}
