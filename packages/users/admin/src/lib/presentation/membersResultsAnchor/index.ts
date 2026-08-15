/**
 * The id of the roster's focus anchor — the wrapper around the results region,
 * which carries `tabIndex={-1}` so it can receive focus programmatically without
 * becoming a tab stop.
 *
 * It exists because a row-removing mutation unmounts the control that opened the
 * overlay (the row's kebab), so Radix's focus restoration has nowhere to return
 * to and focus falls to `<body>` — restarting a keyboard user at the top of the
 * document after every action (WCAG 2.4.3 Focus Order).
 *
 * It wraps **all four** result states (skeleton / error / empty / table), not the
 * table alone. Revoking the last row on screen swaps the table for the empty
 * state, so an anchor that lived on the table would unmount at exactly the moment
 * it was needed — which is the one case where focus was still being dropped.
 */
export const MEMBERS_RESULTS_ANCHOR_ID = 'members-results';
