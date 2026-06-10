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

    const radios = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')
    );
    const last = options.length - 1;

    // Move relative to the *focused* radio, per the ARIA radiogroup pattern —
    // not the selected value. On open, focus can land on a radio other than the
    // selected one (e.g. Radix autofocuses the first option), and keying off
    // `current` would then jump from the wrong origin and skip an option. Fall
    // back to the selected value only when focus is outside the group.
    const focusedIndex = radios.indexOf(
        document.activeElement as HTMLElement
    );
    const index = focusedIndex >= 0 ? focusedIndex : options.indexOf(current);

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
    radios[next]?.focus();
}
