---
name: accessibility
description: Building accessible (WCAG 2.1 AA) admin UI in Ortha CMS — semantic HTML first, labels via the design-system Field/InputField, ARIA only as a last resort, focus management, keyboard support, color-contrast caveats, and intl. Use when authoring or reviewing admin components, forms, dialogs, menus, or any interactive UI. Verify with the admin-e2e a11y/keyboard suites.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(npx nx *), Bash(npm exec nx *)
---

# Ortha CMS accessibility (admin UI)

Target: **WCAG 2.1 Level AA**, as a best-practice goal (not a formal Section 508 /
VPAT obligation today). Build it accessible by default; **verify** with the
`admin-e2e` a11y (axe) + keyboard suites. Automated scans catch a fraction of
WCAG issues — they guard against regressions, they don't prove conformance.

> Companion skills: **`shadcn`** (component mechanics), **`admin-e2e`** (how to
> test the result). Design-system primitives live in
> [`packages/design-system`](../../../packages/design-system).

---

## The non-negotiables

1. **Semantic HTML first.** A real `<button>` for an action, `<a href>` for
   navigation, `<nav>/<main>/<header>`, `<h1…h6>` in order, `<ul>/<table>` for
   lists/tables. Reach for ARIA only when no native element fits — **a wrong/extra
   ARIA role is worse than none.**
2. **Every input has a programmatic label.** Build form fields from the
   design-system `InputField` (or `Field` + `FieldLabel`), which wires
   `htmlFor`/`id`, `aria-invalid`, and the error association for you. Never ship a
   bare `<input>` with only a placeholder.
3. **Keyboard-operable.** Every interaction works without a mouse: reachable by
   Tab in a logical order, activatable by Enter/Space, Escape closes overlays,
   and **focus is visible**. Don't remove focus outlines.
4. **Don't gate on a disabled submit.** Per the login pattern, the submit button
   stays enabled on an invalid form; pressing it **surfaces field errors** rather
   than silently doing nothing (a disabled control gives screen-reader users no
   feedback). See `packages/identity/admin/.../LoginForm`.
5. **Name every control.** Icon-only buttons need an accessible name
   (`sr-only` text or `aria-label`); decorative icons get `aria-hidden="true"`.
   Busy states announce (the submit `Spinner` is `aria-hidden` with an `sr-only`
   "Signing in…").

## Use the design system — it gives you a11y for free

- **`InputField`** — label + input + error, with `htmlFor`/`aria-invalid`/`FieldError`
  wired. Feed it `label`, `invalid`, `errors`. This is how `LoginField` binds a
  TanStack Form field.
- **`FieldError`** renders `role="alert"` so new errors are announced — note this
  collides with the `Alert` banner's role (see the `admin-e2e` gotchas).
- **`Button`** — real `<button>`; pass `type="submit"|"button"`.
- **`Alert`** (`role="alert"`) for page-level messages; **`Logo`/icons** mark
  decorative glyphs `aria-hidden`. **`Spinner`** is decorative — pair it with an
  `sr-only` label for the busy state.
- Strings go through **`react-intl`** (`defineMessages` + `useIntl`), co-located
  per component — so labels/errors are real, translatable text, not hardcoded.

## Focus management

- **Visible focus** on every interactive element (don't `outline: none` without a
  replacement).
- **Logical order** follows DOM order — avoid positive `tabindex`. Remember a
  label-row action (e.g. "Forgot password?") sits **before** its input in the DOM,
  so it tabs first.
- On a route/dialog change, **move focus** to the new context (dialog, or the
  first error after a failed submit) so keyboard/SR users aren't stranded.
- Overlays (dialog/menu/popover) **trap focus** while open and **restore** it to
  the trigger on close — prefer the design-system/Radix primitives, which do this.

## Color & contrast

- Normal text needs **4.5:1**, large text **3:1**, UI/graphics **3:1**.
- **KNOWN DEBT:** the `muted-foreground` token currently **fails AA** for small
  text (surfaced by axe on the "Forgot password"/"Sign up" links and legal
  footer). `color-contrast` is therefore disabled in the admin-e2e `makeAxe`
  fixture, centrally and loudly, pending a deliberate design-system contrast pass.
  When adjusting theme tokens in `apps/admin/src/styles.css`, fix this and
  re-enable the rule.
- Never use color **alone** to convey meaning (pair with text/icon).

## Other

- **Respect `prefers-reduced-motion`** for non-essential animation.
- **Images/icons:** meaningful → `alt`/accessible name; decorative → empty
  `alt`/`aria-hidden`.
- **Don't trap or auto-steal focus** unexpectedly; don't auto-play motion/sound.

## Verify (don't trust by eye)

```bash
# axe scan of pages + dynamic states, and keyboard operability
npx nx e2e admin-e2e -- --project=chromium src/**/a11y.spec.ts src/**/keyboard.spec.ts
```

- Add/extend an `a11y.spec.ts` (axe) and `keyboard.spec.ts` for new UI — see the
  **`admin-e2e`** skill for the harness (`makeAxe`, `expectNoA11yViolations`).
- `eslint-plugin-jsx-a11y` is installed; if/when it's wired into the eslint
  config it catches missing labels/alt/bad ARIA at lint time — a cheap first net.
- Automated tools ≠ conformance. For higher-assurance work, add a manual
  keyboard + screen-reader pass (and a VPAT) — a human/process task, not a test.
