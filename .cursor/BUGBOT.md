# BUGBOT — recurring bug patterns

Patterns that have bitten this codebase or that the review skills call out as
high-risk. Reviewers (human and AI) and code-gen agents should actively check
for these. Each item: the trap, then what "correct" looks like.

Cursor reads repo context from `AGENTS.md`; this file is the bug-pattern
companion to it.

## Server (NestJS plugins)

- **Permission strings as literals.** Guard with shared permission *constants*,
  not inline `'users:read'` strings — a typo silently disables enforcement.
- **Count-then-write races.** Don't read a count and then mutate on a contended
  invariant (e.g. "is this the last admin?"). Lock the contended rows or rely on
  a DB constraint; otherwise two concurrent requests both pass the check.
- **Audit outside the transaction.** `ActivityService.record(...)` must run with
  the *same* transaction/executor as the mutation, so the audit row commits iff
  the mutation does. A separate connection can leave orphaned or missing audit.
- **Enumeration signal.** Auth/lookup endpoints must not reveal whether an email
  or resource exists (timing or distinct messages). Keep responses uniform.
- **Dropping filters/validation when consolidating endpoints.** When merging or
  refactoring controllers, preserve every existing filter, permission check, and
  DTO validation. Re-verify the DTO (`class-validator`) still constrains input.
- **Schema/migration drift.** After editing a plugin's Drizzle schema, generate
  its migration (`nx run <plugin>:db:generate`) and commit the SQL. Never hand-
  edit applied migrations.

## Admin (React plugins)

- **Stale page after mutation.** After a delete/mutation that shrinks a list,
  clamp the current page to the new `pageCount` — otherwise the user lands on an
  empty page past the end.
- **Error masquerading as empty.** Distinguish a failed query from a genuinely
  empty result. Rendering the empty state on error hides outages.
- **Mapper fallbacks that rewrite data.** A `?? defaultValue` in a response
  mapper can silently invent data (e.g. coercing `null` role to `viewer`).
  Surface missing data; don't paper over it.
- **Over-invalidation.** Invalidate only the affected query keys, not the whole
  cache, on mutation — broad invalidation causes refetch storms and flicker.
- **Permission gating only in the UI.** `useHasPermission` hides affordances for
  UX; it is **not** security. The server guard is the real boundary — never rely
  on the hidden button alone.

## Accessibility (every interactive UI)

- Label inputs via the design-system `Field`/`InputField`, not bare ARIA.
- Manage focus on route change, dialog open/close, and after async actions.
- Tables, pagination, dialogs, and menus must be keyboard-operable. Verify with
  the `admin-e2e` a11y/keyboard suites. See the `accessibility` skill.

<!-- Append new patterns as they are found in review or incidents. -->
