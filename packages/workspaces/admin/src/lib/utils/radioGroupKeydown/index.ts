import type { KeyboardEvent } from 'react';

/** The keys this handler reacts to; everything else is left to the browser. */
const HANDLED_KEYS = [
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'ArrowUp',
    'Home',
    'End'
];

/**
 * Keyboard handler implementing the ARIA radiogroup pattern for a row or column
 * of `role="radio"` `<button>`s (the shared swatch/segmented-control shape used
 * by the color picker and status filter). Arrow keys move the selection,
 * wrapping at the ends; Home/End jump to the first/last option; selection
 * follows focus. Pair it with a roving tabindex on the buttons (only the
 * selected radio is `tabIndex={0}`) so Tab enters the group once and the arrows
 * do the rest.
 *
 * The buttons must be rendered in `options` order so the rendered
 * `[role="radio"]` nodes line up with the option indices.
 */
export function radioGroupKeydown<T extends string>(
    event: KeyboardEvent<HTMLElement>,
    options: readonly T[],
    current: T,
    onChange: (value: T) => void
): void {
    if (!HANDLED_KEYS.includes(event.key)) return;
    event.preventDefault();

    const index = options.indexOf(current);
    const last = options.length - 1;

    let next = index;
    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            next = index >= last ? 0 : index + 1;
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            next = index <= 0 ? last : index - 1;
            break;
        case 'Home':
            next = 0;
            break;
        case 'End':
            next = last;
            break;
    }

    if (next === index) return;
    onChange(options[next]);

    const radios =
        event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
    radios[next]?.focus();
}
