/**
 * The id of the roster's focus anchor — the table wrapper, which carries
 * `tabIndex={-1}` so it can receive focus programmatically without becoming a
 * tab stop.
 *
 * It exists because a row-removing mutation unmounts the control that opened
 * the overlay (the row's kebab), so Radix's focus restoration has nowhere to
 * return to and focus falls to `<body>` — which restarts a keyboard user at the
 * top of the document after every action (WCAG 2.4.3 Focus Order). Shared as a
 * constant rather than a hardcoded string in two files so the contract between
 * {@link MembersTable} and its row menu is explicit.
 */
export const MEMBERS_TABLE_ANCHOR_ID = 'members-table';
