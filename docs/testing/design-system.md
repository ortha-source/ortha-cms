# @orthacms/design-system — Test Artifact

> **Unit:** `packages/design-system` · **Package:** `@orthacms/design-system` · **Kind:** library
> **Source of truth:** `packages/design-system/AGENTS.md`
> **Findings verified:** 2026-08-11 — 12 confirmed · 0 deleted · 4 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the shadcn/ui primitive layer every admin plugin builds from — 51 exported
component families plus `cn`, `useIsMobile`, and the `AppearanceProvider` theme
context. It is a *presentational* library: no router, no data layer, no `react-intl`,
no permission awareness.

**Does NOT own:** theme token values (they live in `apps/admin/src/styles.css`, not
here — only the `wizard-step-in` animation ships in `packages/design-system/src/styles.css`);
any copy that a user reads (consumers pass localized nodes — with the exceptions
catalogued in §6); layout of any page; the sidebar's *content* (that is
`@orthacms/shell-admin`); the durable theme preference (server-side, hydrated in
by a plugin through `setTheme`).

- **Entry points** — everything is re-exported from
  `packages/design-system/src/index.ts:1-278`. There is no other public surface.
  No HTTP routes, no slots, no DI ports. Two React contexts are exported
  indirectly: `AppearanceContext` (via `AppearanceProvider` / `useAppearance`,
  `packages/design-system/src/lib/appearance/index.tsx:32`) and `SidebarContext`
  (via `SidebarProvider` / `useSidebar` / `useOptionalSidebar`,
  `packages/design-system/src/lib/components/ui/sidebar.tsx:43-62`), plus the
  internal `InsetTopBarContext` consumed by `TopBar`
  (`packages/design-system/src/lib/components/ui/sidebar.tsx:357-364`).
- **Runtime prerequisites** — a browser DOM (`localStorage`, `matchMedia`,
  `document.cookie`, `navigator.clipboard` for consumers). No env vars, no feature
  flags, no Postgres, no login. The library is consumed **from source**
  (`customConditions: ["@orthacms/source"]`), so there is no build step to run
  before exercising it.
- **How to exercise it manually** — the library ships no story/demo harness. The
  only way to drive it is through the admin app:

    ```bash
    docker compose up -d          # Postgres, for the API half
    npm run dev                   # admin on http://localhost:4200, API on :3000
    ```

    Sign in at `http://localhost:4200/login`. The pages that exercise the widest
    set of primitives are:
    - `/login` — `InputField`, `Field`, `FieldError`, `Button`, `Alert`, `Logo`, `AppLoader`
    - `/` (Home) — `Container`, `ContainerHeader`, `StatTile`, `Card`, `Sidebar*`
    - `/users` (Members) — `Table`, `SearchToolbar`, `InputGroup`, `DropdownMenu`, `Pagination`, `Badge`, `Avatar`, `ConfirmDialog`, `Toaster`
    - `/workspaces/new` — `Stepper`, `WizardStepCard`, `WizardFooter`, `RadioGroup`, `Textarea`
    - `/workspaces/:id/content/…` — `Sheet`, `Drawer`, `Command`/`CommandDialog`, `SegmentedControl`, `Select`, `MultiSelect`, `DatePicker`, `DateTimePicker`, `Calendar`, `Checkbox`, `TabNav`, `Breadcrumb`, `TopBar`
    - `/workspaces/:id/insights` — `Skeleton`, `Card`, `Progress`-adjacent chart chrome
    - Theme switching: the account menu in the sidebar footer (`users-admin`) calls `setTheme`.
- **Dependencies that must be healthy** — `@radix-ui/*` (dialog, popover, select,
  dropdown-menu, toggle-group, progress, tooltip, tabs, checkbox, radio-group,
  slot, separator, avatar, collapsible), `cmdk`, `vaul` (Drawer), `sonner`,
  `react-day-picker`, `lucide-react`, `class-variance-authority`, `tailwind-merge`.
  A version bump in any of them changes rendered ARIA and can silently invalidate
  every assertion in §5.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `cn` class merge (tailwind-merge + clsx) | `packages/design-system/src/lib/utils.ts:1-7` | ❌ NONE |
| F2 | `AppearanceProvider` / `useAppearance` — theme preference, system tracking, `localStorage` persistence, `<html class="dark">` + `color-scheme` reflection | `packages/design-system/src/lib/appearance/index.tsx:91-161` | ⚠️ PARTIAL |
| F3 | `Button` + `buttonVariants` (6 variants × 4 sizes, `asChild`) | `packages/design-system/src/lib/components/ui/button.tsx:7-55` | ✅ E2E |
| F4 | `Input` (native input with invalid/disabled styling) | `packages/design-system/src/lib/components/ui/input.tsx:5-20` | ✅ E2E |
| F5 | `InputField` — composite label + input + hint + error, `aria-describedby` wiring | `packages/design-system/src/lib/components/ui/input-field.tsx:40-101` | ✅ E2E |
| F6 | `Field` family — `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSet`, `FieldSeparator`, `FieldContent`, `FieldTitle` | `packages/design-system/src/lib/components/ui/field.tsx:8-242` | ⚠️ PARTIAL |
| F7 | `Label` | `packages/design-system/src/lib/components/ui/label.tsx` | ✅ E2E |
| F8 | `Textarea` | `packages/design-system/src/lib/components/ui/textarea.tsx` | ⚠️ PARTIAL |
| F9 | `Checkbox` (Radix) | `packages/design-system/src/lib/components/ui/checkbox.tsx` | ✅ E2E |
| F10 | `RadioGroup` / `RadioGroupItem` (Radix) | `packages/design-system/src/lib/components/ui/radio-group.tsx` | ⚠️ PARTIAL |
| F11 | `Select` family (Radix) | `packages/design-system/src/lib/components/ui/select.tsx` | ✅ E2E |
| F12 | `MultiSelect` — Popover + Command + Badge, no shadcn core equivalent | `packages/design-system/src/lib/components/ui/multi-select.tsx:55-152` | ❌ NONE |
| F13 | `SegmentedControl` / `SegmentedControlItem` / `SegmentedControlCount` (Radix ToggleGroup, `type="single"` → radiogroup) | `packages/design-system/src/lib/components/ui/segmented-control.tsx:24-90` | ✅ E2E |
| F14 | `DatePicker` — Button trigger + Calendar popover | `packages/design-system/src/lib/components/ui/date-picker.tsx:64-123` | ❌ NONE |
| F15 | `DateTimePicker` — Calendar + time input, one `Date` value | `packages/design-system/src/lib/components/ui/date-picker.tsx:137-229` | ❌ NONE |
| F16 | `Calendar` / `CalendarDayButton` (react-day-picker) | `packages/design-system/src/lib/components/ui/calendar.tsx` | ❌ NONE |
| F17 | `InputGroup` family — addon-decorated controls, click-to-focus addon | `packages/design-system/src/lib/components/ui/input-group.tsx:9-167` | ✅ E2E |
| F18 | `SearchToolbar` — search box + trailing actions + `busy` spinner swap | `packages/design-system/src/lib/components/ui/search-toolbar.tsx:41-73` | ✅ E2E |
| F19 | `Table` family — `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` | `packages/design-system/src/lib/components/ui/table.tsx:5-113` | ⚠️ PARTIAL |
| F20 | `Pagination` family — `<nav>`, links, prev/next, ellipsis | `packages/design-system/src/lib/components/ui/pagination.tsx:7-107` | ⚠️ PARTIAL |
| F21 | `Dialog` family + close button | `packages/design-system/src/lib/components/ui/dialog.tsx:7-119` | ✅ E2E |
| F22 | `ConfirmDialog` — busy-gated confirm/cancel modal | `packages/design-system/src/lib/components/ui/confirm-dialog.tsx:43-86` | ⚠️ PARTIAL |
| F23 | `Sheet` family (side panel over Radix Dialog) | `packages/design-system/src/lib/components/ui/sheet.tsx:8-137` | ⚠️ PARTIAL |
| F24 | `Drawer` family (vaul) | `packages/design-system/src/lib/components/ui/drawer.tsx` | ✅ E2E |
| F25 | `Popover` family (Radix) | `packages/design-system/src/lib/components/ui/popover.tsx` | ✅ E2E |
| F26 | `DropdownMenu` family (Radix, 15 exports incl. sub-menus, checkbox/radio items) | `packages/design-system/src/lib/components/ui/dropdown-menu.tsx` | ✅ E2E |
| F27 | `Command` family + `CommandDialog` (cmdk) | `packages/design-system/src/lib/components/ui/command.tsx:17-177` | ✅ E2E |
| F28 | `Tooltip` family (Radix) | `packages/design-system/src/lib/components/ui/tooltip.tsx` | ❌ NONE |
| F29 | `Tabs` family (Radix) | `packages/design-system/src/lib/components/ui/tabs.tsx` | ⚠️ PARTIAL |
| F30 | `TabNav` / `TabNavLink` — route-backed tabs, `aria-current` driven | `packages/design-system/src/lib/components/ui/tab-nav.tsx:12-57` | ⚠️ PARTIAL |
| F31 | `Breadcrumb` family | `packages/design-system/src/lib/components/ui/breadcrumb.tsx` | ✅ E2E |
| F32 | `TopBar` / `TopBarIcon` / `TopBarActions` — portal-hoisted page bar | `packages/design-system/src/lib/components/ui/top-bar.tsx:27-101` | ⚠️ PARTIAL |
| F33 | `Sidebar` shell — `SidebarProvider`, `Sidebar`, offcanvas/icon/none collapse, mobile Sheet | `packages/design-system/src/lib/components/ui/sidebar.tsx:69-296` | ⚠️ PARTIAL |
| F34 | `SidebarTrigger` + ⌘B/Ctrl+B global shortcut | `packages/design-system/src/lib/components/ui/sidebar.tsx:112-125, 299-323` | ⚠️ PARTIAL |
| F35 | `SidebarInset` — fixed bar strip + keyboard-focusable scrollport | `packages/design-system/src/lib/components/ui/sidebar.tsx:379-416` | ⚠️ PARTIAL |
| F36 | `SidebarMenu*` family — items, buttons, actions, badges, sub-menus, skeleton | `packages/design-system/src/lib/components/ui/sidebar.tsx:564-824` | ✅ E2E |
| F37 | `SidebarRail` (exported, deliberately unused by the shell) | `packages/design-system/src/lib/components/ui/sidebar.tsx:326-349` | ❌ NONE |
| F38 | Sidebar state persistence via `sidebar_state` cookie | `packages/design-system/src/lib/components/ui/sidebar.tsx:26-27, 89-102` | ❌ NONE |
| F39 | `Toaster` (sonner) + re-exported `toast` — theme-following, click-body-to-dismiss | `packages/design-system/src/lib/components/ui/sonner.tsx:10-70` | ⚠️ PARTIAL |
| F40 | `Alert` / `AlertTitle` / `AlertDescription` | `packages/design-system/src/lib/components/ui/alert.tsx` | ✅ E2E |
| F41 | `Empty` family — empty-state scaffold | `packages/design-system/src/lib/components/ui/empty.tsx:5-95` | ✅ E2E |
| F42 | `Skeleton` | `packages/design-system/src/lib/components/ui/skeleton.tsx:16-22` | ✅ E2E |
| F43 | `Spinner` | `packages/design-system/src/lib/components/ui/spinner.tsx:15-22` | ⚠️ PARTIAL |
| F44 | `AppLoader` — branded boot screen, `role="status"` | `packages/design-system/src/lib/components/ui/app-loader.tsx:25-45` | ✅ E2E |
| F45 | `WizardPageSkeleton` | `packages/design-system/src/lib/components/ui/wizard-page-skeleton.tsx` | ⚠️ PARTIAL |
| F46 | `Stepper` — numbered rail, jump-back to reached steps | `packages/design-system/src/lib/components/ui/wizard.tsx:49-139` | ⚠️ PARTIAL |
| F47 | `WizardStepCard` + `wizard-step-in` animation (reduced-motion aware) | `packages/design-system/src/lib/components/ui/wizard.tsx:158-160`, `packages/design-system/src/styles.css` | ❌ NONE |
| F48 | `WizardFooter` — back/hint + skip + primary | `packages/design-system/src/lib/components/ui/wizard.tsx:182-217` | ⚠️ PARTIAL |
| F49 | `Card` family | `packages/design-system/src/lib/components/ui/card.tsx` | ✅ E2E |
| F50 | `StatTile` | `packages/design-system/src/lib/components/ui/stat-tile.tsx:21-35` | ⚠️ PARTIAL |
| F51 | `Container` / `ContainerHeader` — page wrapper + `<h1>` | `packages/design-system/src/lib/components/ui/container.tsx:6-70` | ✅ E2E |
| F52 | `Badge` / `badgeVariants` | `packages/design-system/src/lib/components/ui/badge.tsx` | ✅ E2E |
| F53 | `Avatar` family + `AVATAR_COLORS` / `avatarColorVar` | `packages/design-system/src/lib/components/ui/avatar.tsx` | ✅ E2E |
| F54 | `Progress` (Radix) | `packages/design-system/src/lib/components/ui/progress.tsx:13-31` | ⚠️ PARTIAL |
| F55 | `Separator`, `Collapsible`, `Kbd`, `Logo` | `separator.tsx`, `collapsible.tsx`, `kbd.tsx`, `logo.tsx` | ⚠️ PARTIAL |
| F56 | `useIsMobile` — the single 768px breakpoint | `packages/design-system/src/lib/hooks/use-mobile.tsx:1-19` | ❌ NONE |

---

## 3. Manual Test Plan

Every block assumes `npm run dev` is up and you are signed in as an **admin**
unless stated otherwise. Each block ends with a **Keyboard-only path** and a
**Screen-reader expectation** (tested with VoiceOver/Safari or NVDA/Firefox —
axe does not cover either).

### F1 — `cn` class merge

**Preconditions:** none (pure function).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | In DevTools console on any admin page, evaluate a `Button` with `className="px-8"` | Rendered `class` contains `px-8` and **not** the variant's `px-4` — tailwind-merge dropped the loser |
| 2 | Render `<Badge className="bg-red-500" />` | `bg-red-500` wins over the variant background |
| 3 | Pass `cn(undefined, false, 'a', ['b'])` | Returns `'a b'` — falsy entries dropped |

**Keyboard-only path:** N/A. **Screen-reader expectation:** N/A.

### F2 — Theme preference

**Preconditions:** signed in; OS colour scheme set to Light.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the account menu in the sidebar footer, choose **Dark** | `<html>` gains class `dark`; `document.documentElement.style.colorScheme === 'dark'`; every surface repaints without a reload |
| 2 | Reload the page | Still dark — `localStorage['ortha.theme'] === 'dark'`, read synchronously on first paint, so there is **no** light flash |
| 3 | Choose **System**; flip the OS to Dark while the tab is open | The app follows within one frame — the `matchMedia('(prefers-color-scheme: dark)')` listener at `appearance/index.tsx:99-108` fires |
| 4 | In DevTools, `localStorage.setItem('ortha.theme','banana')`, reload | Falls back to `system` (`asTheme` at `appearance/index.tsx:40-44` rejects it), no crash |
| 5 | Open the app in a Private window with storage blocked | Renders; theme changes still apply to the DOM, only cross-reload persistence is lost (`try/catch` at `appearance/index.tsx:116-126`) |
| 6 | Render a component that calls `useAppearance()` outside any provider | Returns `{ theme:'system', resolvedTheme:'light', setTheme: noop }` — no throw (`appearance/index.tsx:151-161`) |

**Keyboard-only path:** Tab to the sidebar footer account button → `Enter` opens
the Radix menu → `ArrowDown` to **Appearance** → `Enter`/`ArrowRight` opens the
sub-menu → `ArrowDown` to **Dark** → `Enter`. Focus must return to the account
button when the menu closes.
**Screen-reader expectation:** the theme item announces as
"Dark, menu item radio, selected" once chosen. The theme change itself is a
visual-only change of state and needs no announcement.

### F3 — `Button`

**Preconditions:** any page.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On `/login`, inspect the submit button | `<button type="submit">` with `bg-primary text-primary-foreground` and a visible focus ring class `focus-visible:ring-2` |
| 2 | Set `disabled` (submit while pending) | `pointer-events-none opacity-50`; clicks do nothing; the button stays in the tab order and announces "disabled" |
| 3 | Find an `asChild` button (e.g. a `BreadcrumbLink`) | Renders as `<a>`, not `<button>`, and carries the button classes |
| 4 | Render `<Button asChild disabled><a href="/x">Go</a></Button>` | **Known trap:** `disabled` is not a valid `<a>` attribute — the link stays clickable. Consumers must not rely on it |

**Keyboard-only path:** Tab to the button; `Enter` and `Space` both activate;
the focus ring is visible against both themes.
**Screen-reader expectation:** "Login, button". Icon-only buttons must carry an
`aria-label` or an `sr-only` child — see `♿ A11Y-design-system-01`.

### F4 / F5 / F6 / F7 — `Input`, `InputField`, `Field` family, `Label`

**Preconditions:** `/login` (signed out).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click the visible text "Email" | Focus moves into the email input — `FieldLabel htmlFor={id}` at `input-field.tsx:75/79` |
| 2 | Submit the empty form | A `role="alert"` node reading "Email is required" appears *below* the input; the input gets `aria-invalid="true"` and `aria-describedby="<id>-error"` |
| 3 | Give `InputField` both `description` and `error` | `aria-describedby` lists **both** ids, space-separated, description first (`input-field.tsx:61-69`) |
| 4 | Pass a consumer `aria-describedby` as well | It is appended, not replaced (`input-field.tsx:66`) |
| 5 | Pass `invalid={false}` while `error="Nope"` | **Suspected defect:** the error is *not* rendered at all — see `🐞 BUG-design-system-05` |
| 6 | Pass `errors={[]}` with `invalid` | **Suspected defect:** an empty `role="alert"` box renders — see `🐞 BUG-design-system-05` |
| 7 | Render a `FieldSet` + `FieldLegend` around two checkboxes | `<fieldset><legend>` — the group name is announced before each checkbox |

**Keyboard-only path:** Tab reaches Email → Password → "Forgot password?" (the
`labelAction`) → Login. Note the `labelAction` sits **after** the label and
**before** the input in DOM order, so Tab order is label-action → input, which
reads oddly; verify against `2.4.3`.
**Screen-reader expectation:** "Email, edit text, invalid data, Email is required".
The description must be read on focus, not only when it first appears.

### F8 — `Textarea`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the workspace-create wizard, step 1 | The Description textarea is labelled by its `FieldLabel`; clicking the label focuses it |
| 2 | Type 5000 characters | No client-side cap in the primitive; the consumer's validation must catch it |

**Keyboard-only path:** Tab in, type, `Tab` out (does **not** insert a tab char).
**Screen-reader expectation:** "Description, edit text, multiline".

### F9 / F10 — `Checkbox`, `RadioGroup`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `/workspaces/:id/content/<collection>` — click a row's select checkbox | `aria-checked` flips to `true`; the row gets `data-state="selected"` |
| 2 | Click the header select-all with 3 of 25 selected | Header checkbox exposes `aria-checked="mixed"` (indeterminate) |
| 3 | Workspace-create wizard, colour picker | `RadioGroup` with `role="radiogroup"`; exactly one item is `aria-checked="true"` |

**Keyboard-only path:** Checkbox — Tab to it, `Space` toggles. RadioGroup —
Tab enters the group at the **checked** item, arrow keys move *and* select
(automatic activation), Tab leaves the whole group.
**Screen-reader expectation:** "Select row, check box, not checked" / "Green,
radio button, 2 of 6, selected".

### F11 — `Select`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Members page → a row's Role select | Trigger is `role="combobox"` with `aria-expanded="false"`; opening renders `role="listbox"` with `role="option"` children |
| 2 | Open and type `c` | cmdk-free Radix type-ahead jumps to the first option starting with `c` |
| 3 | Give `Select` a `value` with no matching `SelectItem` | Trigger renders empty; **no** error. This is the failure mode behind `🐞 BUG-query-builder-admin-02` |

**Keyboard-only path:** Tab to trigger → `Enter`/`Space`/`ArrowDown` opens →
arrows move → `Enter` selects and closes → **focus returns to the trigger**.
`Esc` closes without selecting, focus returns to the trigger.
**Screen-reader expectation:** "Role, combo box, Admin, collapsed" then
"Contributor, 2 of 3" while arrowing.

### F12 — `MultiSelect`

**Preconditions:** a consumer that mounts it (none in the shipped admin today —
it is exported but unused, which is why coverage is ❌).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Mount with 3 options, none selected | Trigger shows the `placeholder` in `text-muted-foreground` and `aria-expanded="false"` |
| 2 | Open, click option A then B | Two `Badge`s appear in the trigger; each chosen row shows an opaque check |
| 3 | Type into the search box | cmdk filters by the item's `value`, which is set to `option.label` (`multi-select.tsx:131`) — searching by the option's *value* finds nothing |
| 4 | Supply two options with the same `label`, different `value` | **Suspected defect:** cmdk keys on `value`; both rows filter and highlight together — see `🐞 BUG-design-system-06` |
| 5 | Read the JSDoc: "trigger shows the selected options as removable badges" | **Doc drift:** the badges have no remove affordance (`multi-select.tsx:104-109`) |

**Keyboard-only path:** Tab to trigger → `Enter` opens → focus lands in the
search input → arrows move the cmdk highlight → `Enter` toggles → `Esc` closes
and returns focus to the trigger.
**Screen-reader expectation:** currently **fails** — selection state is conveyed
only by an `aria-hidden` check icon, so a screen-reader user cannot tell what is
selected. See `♿ A11Y-design-system-02`.

### F13 — `SegmentedControl`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `/workspaces/:id/insights` — the range picker | Root is `role="radiogroup"` with `aria-label`; items are `role="radio"` with `aria-checked` |
| 2 | Click the already-active item | Radix calls `onValueChange('')`. Both shipped consumers guard against the empty string (`insights/.../InsightsRangePicker/index.tsx:45-49`, `query-builder/.../GroupNode/index.tsx:83-87`), so nothing changes |
| 3 | Mount a consumer that does **not** guard | The value is cleared and the control shows nothing selected. The primitive's type says `(value: string) => void`, which hides that `''` is reachable |

**Keyboard-only path:** Tab enters at the checked item (roving tabindex);
`ArrowRight`/`ArrowLeft` move focus **without** selecting; `Enter`/`Space`
commits. Asserted at `apps/admin-e2e/src/insights/a11y.spec.ts:87-103`.
**Screen-reader expectation:** "Time range, 30 days, radio button, 2 of 4, selected".

### F14 / F15 / F16 — `DatePicker`, `DateTimePicker`, `Calendar`

**Preconditions:** a consumer mounting a date field (content entry with a date field).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click the empty trigger | Reads the `placeholder` in muted ink; `data-empty="true"`; a Calendar popover opens with the month grid focused (`autoFocus`) |
| 2 | Pick 14 March | Trigger reads "14 March 2026" in the **browser** locale, not the app's `react-intl` locale — `value.toLocaleDateString(undefined, …)` at `date-picker.tsx:95` |
| 3 | Re-open and click the same day | `onSelect(undefined)` → `onChange(undefined)`; the field clears |
| 4 | `DateTimePicker`: set 14 March, then type `10:30:45` in the time input | The stored `Date` carries `:45` seconds but the input **redisplays `10:30`** — `timeOf` truncates to `HH:mm` (`date-picker.tsx:30-33`, `220`). See `🐞 BUG-design-system-02` |
| 5 | With `10:30:45` set, pick a different day | The time silently becomes `10:30:00` — `setDate` round-trips through `timeOf` (`date-picker.tsx:157`) |
| 6 | Clear the time input | Ignored on purpose (`date-picker.tsx:160-165`) — the datetime keeps its previous time |
| 7 | Pick 29 March 2026 02:30 in `Europe/Berlin` (DST spring-forward) | `next.setHours(2,30,0,0)` lands on a non-existent local time; the browser shifts it to 03:30. The trigger shows 03:30 |

**Keyboard-only path:** Tab to trigger → `Enter` opens → the day grid takes focus →
arrows move by day, `PageUp`/`PageDown` by month → `Enter` selects and closes →
**focus returns to the trigger** (Radix Popover). For `DateTimePicker`, `Tab`
from the grid reaches the time input inside the popover; `Esc` closes.
**Screen-reader expectation:** trigger announces "14 March 2026, button, has
popup dialog, collapsed". The `captionLayout="dropdown"` month/year selects must
each carry a name — unverified, see `♿ A11Y-design-system-06`.

### F17 / F18 — `InputGroup`, `SearchToolbar`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Members page — click the magnifier icon left of the search box | Focus jumps into the input (`InputGroupAddon`'s `onClick` at `input-group.tsx:69-74`) |
| 2 | Type `grace` | Rows filter. Asserted at `apps/admin-e2e/src/users/keyboard.spec.ts:16-23` |
| 3 | While the list refetches | The magnifier is replaced by a `Spinner aria-hidden` (`search-toolbar.tsx:56-60`) — purely visual, the list owns the announcement |
| 4 | Pass a consumer `onClick` to `InputGroupAddon` | **Suspected defect:** `{...props}` is spread *after* the built-in handler (`input-group.tsx:75`), so the consumer's handler replaces click-to-focus |

**Keyboard-only path:** Tab reaches the input directly (the addon is a
non-focusable `div`). `Escape` in a `type="search"` input clears it in Chromium.
**Screen-reader expectation:** "Search members, search text field". The
`searchLabel` prop is the *only* accessible name — there is no visible label, so
`searchPlaceholder` alone would be a `3.3.2` failure.

### F19 — `Table`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Members page | `<table>` with `<thead>`/`<tbody>`; column headers are real `<th>` |
| 2 | Inspect a `<th>` | **No `scope="col"`** is emitted (`table.tsx:73-85`) — see `♿ A11Y-design-system-03` |
| 3 | Look for `<caption>` or an accessible name on the table | None by default; `TableCaption` exists but is opt-in |
| 4 | Narrow the viewport to 500px on the content records table | The wrapper `div.overflow-auto` (`table.tsx:9`) scrolls horizontally but has **no `tabIndex`** — keyboard users cannot scroll it. See `🐞 BUG-design-system-04` |
| 5 | Sort a column (content records) | The consumer sets `aria-sort`; asserted at `apps/admin-e2e/src/content/content-library.spec.ts:446-460`. The primitive itself has no sort support |

**Keyboard-only path:** Tab moves through focusable cell contents only; the
scroll container itself is unreachable (step 4).
**Screen-reader expectation:** in table-navigation mode, moving right should
announce the column header for each cell. Without `scope`, browsers guess from
position — correct for this simple grid, incorrect the moment a `colspan`
appears.

### F20 — `Pagination`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Any list page with >1 page | A `<nav role="navigation" aria-label="pagination">` wraps a `<ul>` of `<li>` |
| 2 | Inspect the current page link | `aria-current="page"` (`pagination.tsx:49`) |
| 3 | Switch the admin to German | Prev/Next still read **"Previous"/"Next"** and the nav is still labelled `"pagination"` — hard-coded English, see `🐞 BUG-design-system-03` |
| 4 | Inspect `PaginationEllipsis` | `aria-hidden` on the wrapper hides the `sr-only` "More pages" inside it (`pagination.tsx:98-105`) — dead text |
| 5 | Render `PaginationLink` without `href` | An `<a>` with no `href` — **not focusable, not keyboard-activatable** |

**Keyboard-only path:** Tab through the page links; `Enter` follows. A
`PaginationLink` used as a button (no `href`) is skipped entirely.
**Screen-reader expectation:** "pagination, navigation" then "page 2, current page, link".

### F21 / F22 / F23 / F24 — `Dialog`, `ConfirmDialog`, `Sheet`, `Drawer`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Members page → row menu → **Remove** | A modal with `role="dialog" aria-modal="true"`, an overlay, and a title/description |
| 2 | Press `Esc` | Closes; **focus returns to the row-menu trigger** (Radix restores it) |
| 3 | Tab repeatedly inside the dialog | Focus cycles inside — Cancel, Confirm, Close (`X`). It never escapes to the page behind |
| 4 | Confirm; while the request is in flight | Both buttons are `disabled`, a `Spinner` shows on Confirm, and `Esc`/overlay click are ignored (`confirm-dialog.tsx:56-59`) — no double-submit |
| 5 | Switch to German and open any dialog | The `X` button's `sr-only` name is still **"Close"** — hard-coded English (`dialog.tsx:47`, `sheet.tsx:67`). See `🐞 BUG-design-system-03` |
| 6 | Omit `cancelLabel` on `ConfirmDialog` | Defaults to the English literal `'Cancel'` (`confirm-dialog.tsx:49`) |
| 7 | Open the query-builder `Drawer`, then open the field picker inside it | The popover portals into the drawer element, so the mouse wheel scrolls its list |

**Keyboard-only path:** trigger → `Enter` opens → focus lands on the first
focusable element inside → Tab cycles → `Esc` closes → focus is restored to the
trigger. Verify the restore explicitly; it is the step most often broken.
**Screen-reader expectation:** on open, "Remove member, dialog" then the
description. The `X` button announces as "Close, button".

### F25 / F26 / F27 — `Popover`, `DropdownMenu`, `Command`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Members row `⋯` menu | `role="menu"` with `role="menuitem"` children; opens on `Enter`. Asserted at `apps/admin-e2e/src/users/keyboard.spec.ts:39-48` |
| 2 | Check the menu's `modal` prop at each call site | Every shipped row menu passes `modal={false}` — a `modal` Radix menu `aria-hidden`s the page root and fails axe's `aria-hidden-focus` (documented in `apps/admin-e2e/AGENTS.md:78-81`) |
| 3 | `⌘K` on the Content Library | `CommandDialog` opens with the input focused; `Esc` closes. Asserted at `apps/admin-e2e/src/content/content-library.spec.ts:138-147` |
| 4 | Switch to German and open `CommandDialog` without passing `title` | The `sr-only` dialog title defaults to English `'Command palette'` (`command.tsx:40-41`). The shell passes a localized one; a new consumer that forgets will not |
| 5 | Type a term matching nothing | `CommandEmpty` renders the consumer's text |

**Keyboard-only path:** menu — Tab to trigger, `Enter`/`ArrowDown` opens and
focuses the first item, arrows move, type-ahead jumps, `Esc` closes and restores
focus. Command — `⌘K`, type, arrows, `Enter` selects, `Esc` closes.
**Screen-reader expectation:** "menu, General, 1 of 4"; the palette announces
"Search, dialog" then result counts as the list filters.

### F28 — `Tooltip`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Collapse the sidebar to icon mode (not used by the shell today) and hover a nav icon | A tooltip appears to the right |
| 2 | **Focus** the same trigger with Tab instead of hovering | Radix shows the tooltip on focus too — verify, because a hover-only tooltip fails `1.4.13` |
| 3 | Move the pointer onto the tooltip itself | It must stay open (hoverable) and be dismissible with `Esc` without moving the pointer |

**Keyboard-only path:** Tab to trigger → tooltip appears → `Esc` dismisses it
while focus stays put.
**Screen-reader expectation:** the tooltip text is exposed via
`aria-describedby` on the trigger. `SidebarMenuButton` passes `hidden` when the
sidebar is expanded (`sidebar.tsx:657`) — confirm `hidden` removes it from the
accessibility tree rather than merely hiding it visually.

### F29 / F30 — `Tabs`, `TabNav`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Workspace settings tabs | `TabNav` is a `<nav>` of links, not a Radix tablist — the router owns the active pane and sets `aria-current="page"` |
| 2 | Inspect `TabNav` for an `aria-label` | The JSDoc says "Pass an `aria-label`" (`tab-nav.tsx:10`) but nothing enforces it; an unnamed `<nav>` is a `2.4.1`/`1.3.1` smell when several exist |
| 3 | Radix `Tabs` (where used) | Arrow keys move between tabs; `aria-controls` points at the panel |

**Keyboard-only path:** `TabNav` — plain Tab through each link, `Enter` navigates
(each is a real link, so no arrow-key pattern applies and none should be
expected). Radix `Tabs` — Tab enters at the selected tab, arrows move.
**Screen-reader expectation:** `TabNav` announces "General, current page, link"
inside a named navigation landmark.

### F31 / F32 — `Breadcrumb`, `TopBar`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Any page except Home | A slim 48px bar with a coloured icon tile and a breadcrumb |
| 2 | Inspect the bar's DOM position | It is **portaled** into `div[data-slot="sidebar-inset-bar"]`, above the scrollport (`top-bar.tsx:56-57`) — so the page scrollbar starts *below* the bar |
| 3 | Open a public page (`/login`) | No `SidebarInset` above → `useInsetTopBarHost()` returns `undefined` → the bar renders in place |
| 4 | Collapse the sidebar (`⌘B`) | An inline `SidebarTrigger` appears as the bar's first child (`top-bar.tsx:46-48`) |
| 5 | Inspect `TopBarIcon` | `aria-hidden` — decorative, the breadcrumb carries the context |

**Keyboard-only path:** Tab order is skip-link → sidebar → the bar's inline
trigger → breadcrumb links → page actions → the scrollport. Because the bar is
portaled *out of* the page's DOM position but *into* an earlier position, verify
the visual order and the tab order still agree (`2.4.3`).
**Screen-reader expectation:** "Breadcrumb, navigation" then the trail, with the
last crumb announced as the current page.

### F33 / F34 / F35 / F36 / F37 / F38 — the `Sidebar` shell

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in | The sidebar is expanded; the shell mounts it as `collapsible="offcanvas"` |
| 2 | Click the in-header trigger | The panel slides off the left edge; `data-collapsible="offcanvas"`; the container gets `inert` **and** `aria-hidden` (`sidebar.tsx:282-283`) |
| 3 | Focus the in-header trigger with the keyboard, then press `Enter` to collapse | **Suspected defect:** the focused element is now inside an `inert` subtree; focus falls to `<body>`. See `🐞 BUG-design-system-01` |
| 4 | Press `⌘B` (macOS) / `Ctrl+B` | Toggles the sidebar from anywhere |
| 5 | Put the caret inside a WYSIWYG body field and press `Ctrl+B` to bold | **Suspected defect:** the window-level listener calls `preventDefault()` unconditionally (`sidebar.tsx:112-125`), so the sidebar toggles and the text is not bolded. See `🐞 BUG-design-system-01` |
| 6 | Collapse the sidebar, then reload | **Suspected defect:** the sidebar is expanded again. The `sidebar_state` cookie is written (`sidebar.tsx:99`) but never read. See `🐞 BUG-design-system-07` |
| 7 | Inspect that cookie | `sidebar_state=false; path=/; max-age=604800` — no `SameSite`, no `Secure` |
| 8 | Narrow to <768px | The sidebar becomes a `Sheet` overlay with an `sr-only` title **"Sidebar"** and description **"Displays the mobile sidebar."** — hard-coded English (`sidebar.tsx:234-239`) |
| 9 | Switch to German and inspect `SidebarTrigger` | `sr-only` name is still **"Toggle Sidebar"** (`sidebar.tsx:320`) |
| 10 | Tab with nothing else focusable on a fully-skeleton page | Focus reaches `div[data-slot="sidebar-inset-scroll"][tabindex="0"]`; arrow keys scroll the page (`sidebar.tsx:406-410`) — this is the primitive doing `2.1.1` correctly |
| 11 | Look for `SidebarRail` in the DOM | Absent — the shell deliberately does not render it (`packages/shell/admin/AGENTS.md:12-17`), but it is still exported and `tabIndex={-1}` if anyone mounts it |
| 12 | Render `SidebarMenuSkeleton` twice | Each gets a random width from `Math.random()` inside `useMemo` (`sidebar.tsx:729-731`) — fine in the browser, non-deterministic under SSR |

**Keyboard-only path:** skip link (`Enter` jumps to `<main id="main-content">`) →
sidebar search trigger → nav links → footer account menu → main scrollport.
Collapsing must move focus somewhere sensible (step 3).
**Screen-reader expectation:** the sidebar is inside a named `<nav>` supplied by
the shell; collapsed, its contents leave the accessibility tree entirely
(`inert`), which is correct.

### F39 — `Toaster` / `toast`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Perform any mutation that toasts (e.g. rename a workspace) | A toast appears **top-right** on the semantic soft surface for its type |
| 2 | Switch to Dark and toast again | Sonner's own chrome follows, because `theme={resolvedTheme}` is passed (`sonner.tsx:40`) |
| 3 | Click the toast body | It dismisses (`isToastBodyClick` at `sonner.tsx:10-16`) |
| 4 | Trigger three toasts, then click one of them | **Suspected defect:** all three vanish — `toast.dismiss()` takes no id (`sonner.tsx:36`). See `🐞 BUG-design-system-08` |
| 5 | Click the toast's action/close button or a link inside it | Only that control fires; the body handler bails out |

**Keyboard-only path:** the toast's close button is reachable by Tab while the
toast is on screen; the body-click dismissal has no keyboard equivalent, which is
acceptable because the close button exists.
**Screen-reader expectation:** sonner mounts its own live region; a `toast.error`
should be assertive and a `toast.success` polite. Verify the region **pre-exists**
the toast — see `♿ A11Y-design-system-05`.

### F40 / F41 / F42 / F43 / F44 / F45 — status & placeholder primitives

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Force a query error (block `/api/**` in DevTools) on Members | An `Alert variant="destructive"` renders with a title and body — **not** the empty state |
| 2 | Filter to a term with no matches | The `Empty` scaffold renders with its icon, title and description |
| 3 | Inspect `Empty`'s classes | `border-dashed` without `border` (`empty.tsx:10`) — the dashed border never draws unless the consumer adds `border` |
| 4 | Inspect `EmptyDescription`'s element | Typed `ComponentProps<'p'>` but renders a `<div>` (`empty.tsx:71-82`) — a `<p>`-only prop would be a type lie |
| 5 | Reload with a slow `/api/auth/me` | `AppLoader` fills the screen: one `role="status"` region, the spinner `aria-hidden`, the label carrying the announcement (`app-loader.tsx:30-44`). Scanned at `apps/admin-e2e/src/auth/a11y.spec.ts:107-118` |
| 6 | Inspect a bare `Spinner` | It carries `role="status"` on the `<svg>` itself with no text content (`spinner.tsx:17-21`) — an empty live region. Consumers must pair it with an `sr-only` label |

**Keyboard-only path:** N/A for the status primitives; the `Empty` scaffold's
`EmptyContent` action button must be reachable by Tab.
**Screen-reader expectation:** the boot loader announces "Loading…" exactly once.
A skeleton block is silent by design and the *consumer* must wrap it in a named
`role="status"` — a contract `insights-admin`'s `WidgetCard` does not honour
(`♿ A11Y-insights-admin-01`).

### F46 / F47 / F48 — the wizard chrome

**Preconditions:** `/workspaces/new`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Land on step 1 | An `<ol>` rail; step 1's marker is `aria-current="step"`, steps 2+ are `disabled` buttons |
| 2 | Advance to step 2, then click step 1's marker | Jumps back; step 1 now shows a check and its `summary` chip |
| 3 | Give two steps the same `label` | **Suspected defect:** `key={step.label}` (`wizard.tsx:69`) collides — React warns and step state can cross over. See `🐞 BUG-design-system-09` |
| 4 | Omit `optionalLabel` on an `optional` step | The badge is silently hidden (`wizard.tsx:117`) — the step no longer says it is skippable |
| 5 | Enable "Reduce motion" in the OS and change step | The `wizard-step-in` entrance does not play; content is never hidden mid-animation (opacity stays 1) |

**Keyboard-only path:** Tab reaches only *reached* markers (later ones are
`disabled`); `Enter` jumps. In the footer, Tab order is Back → Skip → Primary.
**Screen-reader expectation:** each marker announces the localized
`stepAriaLabel`, e.g. "Step 2: Members, current step". Note the accessible name
**replaces** the visible number/check — verify against `2.5.3`.

### F49 / F50 / F51 / F52 / F53 / F54 / F55 — presentational primitives

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Home page stat row | `StatTile` renders value above label inside a `Card`; the optional icon is **not** `aria-hidden` (`stat-tile.tsx:29`) |
| 2 | `ContainerHeader` on any page | Exactly one `<h1>` per page comes from here (`container.tsx:48-55`) |
| 3 | An upload with a `Progress` bar | `role="progressbar"` with `aria-valuenow`; the consumer must supply `aria-label` — the primitive supplies none |
| 4 | Pass `value={150}` to `Progress` | `translateX(--50%)` — the indicator overshoots; no clamping (`progress.tsx:27`) |
| 5 | `Avatar` with no image | `AvatarFallback` shows initials on a deterministic colour from `AVATAR_COLORS` |
| 6 | `Kbd` in the command palette footer | Renders `⌘K` glyphs; decorative, paired with visible text |

**Keyboard-only path:** none of these are interactive.
**Screen-reader expectation:** `StatTile` reads "1,284 Active workspaces" — value
then label, which is the right order. A decorative icon that is not
`aria-hidden` adds no text, so the practical impact is nil, but it violates the
skill's rule.

### F56 — `useIsMobile`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Resize the window across 768px | Components branching on it (`Sidebar`, `AppRightPanel`) flip between column and overlay |
| 2 | Read the value on the first render before the listener attaches | It is initialised from `matchMedia`, so there is no `undefined` first frame |

**Keyboard-only path / Screen-reader expectation:** N/A.

---

## 4. Edge Cases & Negative Paths

**Empty / zero / null**

- **EC-01 — `FieldError` with `errors={[]}` and `invalid` forced.** `❌ NONE`
  Steps: render `<InputField invalid errors={[]} … />`.
  Expected: nothing rendered. Suspected: `showError` is `true` because `[]` is
  truthy (`input-field.tsx:57`), and `FieldError` returns a `<ul>` element — also
  truthy — so an empty `role="alert"` box renders. → `🐞 BUG-design-system-05`.
- **EC-02 — `FieldError` with `errors=[{}, undefined]`.** `❌ NONE`
  Expected: nothing. Actual: an empty `<ul>` inside a `role="alert"`.
- **EC-03 — `MultiSelect` with `options=[]`.** `❌ NONE` `CommandEmpty` renders the
  `emptyText`; the trigger shows the placeholder. Correct.
- **EC-04 — `Sparkline`-style zero data does not apply here**, but `Progress`
  with `value={undefined}` renders a full-width bar translated by `-100%` — i.e.
  empty. Correct.
- **EC-05 — `Stepper` with `steps=[]`.** `❌ NONE` Renders an empty `<ol>`; no crash.
- **EC-06 — `Table` with an empty `<tbody>`.** `❌ NONE` Renders header only. The
  *consumer* must render the `Empty` scaffold; the primitive will happily show a
  headed table with no rows and no explanation.

**Boundary**

- **EC-07 — `Progress value={-5}` / `value={150}`.** `❌ NONE` No clamp
  (`progress.tsx:27`); the indicator overshoots the track in both directions.
- **EC-08 — `Stepper current > steps.length`.** `❌ NONE` No marker is
  `aria-current`; every step renders as complete. Silent.
- **EC-09 — `Stepper maxReached < current`.** `❌ NONE` The active step's own
  button is `disabled` — you cannot re-focus the step you are on.
- **EC-10 — `DateTimePicker` at a DST spring-forward hour.** `❌ NONE`
  `withTimeOf` (`date-picker.tsx:36-41`) uses `setHours`, which resolves a
  non-existent local time forward by an hour. The displayed time silently differs
  from what was picked.
- **EC-11 — `DateTimePicker` seconds.** `❌ NONE` `step="1"` invites seconds;
  `timeOf` discards them on the next render. → `🐞 BUG-design-system-02`.
- **EC-12 — `useIsMobile` at exactly 768px.** `❌ NONE` The query is
  `(max-width: 767px)`-shaped; 768 is desktop. Consistent with `MOBILE_QUERY` in
  `packages/shell/admin/src/lib/utils/pageChrome/index.tsx:57`.

**Size & encoding**

- **EC-13 — A 500-character label in `InputField`.** `❌ NONE` `FieldLabel` is
  `w-fit` with no truncation; it wraps and pushes the input down. Acceptable.
- **EC-14 — RTL content in `Breadcrumb` / `Pagination`.** `❌ NONE` The library sets
  no `dir`; `ChevronLeft`/`ChevronRight` in `PaginationPrevious`/`Next` are
  hard-coded LTR glyphs and would point the wrong way in an RTL locale.
- **EC-15 — Emoji / combining marks in an `Avatar` fallback.** `❌ NONE` Handled by
  the consumer's `initials()` helper, not here.
- **EC-16 — `<script>alert(1)</script>` typed into any `Input`.** `❌ NONE` React
  escapes it on render. No `dangerouslySetInnerHTML` anywhere in the package —
  verified by grep across `packages/design-system/src`.
- **EC-17 — A 200-item `Select`.** `❌ NONE` Radix renders all items with scroll
  buttons; no virtualisation. Perf, not correctness.
- **EC-18 — A 2000-row `Table`.** `❌ NONE` No virtualisation; the wrapper's
  `overflow-auto` handles it. Consumers page instead.

**Permission matrix / tenant isolation**

- **EC-19 — Not applicable.** This unit has no authentication, authorization,
  tenant, or network surface. It renders exactly what it is handed. Any
  permission concern belongs to the consuming plugin. Explicitly checked and
  cleared: no `fetch`/`XMLHttpRequest`/`apiClient` import anywhere in
  `packages/design-system/src`.

**Concurrency**

- **EC-20 — Double-submit through `ConfirmDialog`.** `⚠️ PARTIAL` `busy` disables
  both buttons and blocks dismissal (`confirm-dialog.tsx:56-80`), so a second
  request cannot fire. But `onConfirm` is fire-and-forget — if the consumer
  forgets to set `busy`, nothing here prevents a double-submit.
- **EC-21 — Two `SidebarProvider`s mounted.** `❌ NONE` Both attach a window
  `keydown` listener; `⌘B` toggles both. Not reachable in the shipped shell.
- **EC-22 — `AppearanceProvider` `setTheme` called from two places in one tick.**
  `❌ NONE` `setThemeState` short-circuits on an unchanged value
  (`appearance/index.tsx:128-132`); last write wins otherwise. Fine.

**State after mutation**

- **EC-23 — Collapsing the sidebar while focus is inside it.** `❌ NONE`
  → `🐞 BUG-design-system-01`.
- **EC-24 — Reloading after collapsing the sidebar.** `❌ NONE`
  → `🐞 BUG-design-system-07`.
- **EC-25 — Toast stack dismissal.** `❌ NONE` → `🐞 BUG-design-system-08`.
- **EC-26 — `TopBar` mounted before its inset host.** `⚠️ PARTIAL` `host === null`
  means "one commit away", so the bar renders **nothing** for a frame rather than
  flashing in the page flow (`top-bar.tsx:53-57`). Deliberate; if the host never
  mounts, the bar never appears and nothing says so.

**Failure & partiality**

- **EC-27 — `localStorage` throws (quota / private mode).** `⚠️ PARTIAL` Both the
  read (`appearance/index.tsx:51-58`) and the write (`116-126`) are guarded.
- **EC-28 — `document.cookie` unavailable.** `❌ NONE` `setOpen`
  (`sidebar.tsx:99`) writes it **unguarded**. In a sandboxed iframe with
  `allow-same-origin` absent, this throws and the sidebar stops toggling entirely.
- **EC-29 — `matchMedia` absent (jsdom without a polyfill).** `⚠️ PARTIAL`
  `canUseDom` guards `appearance`, but `useIsMobile` calls `window.matchMedia`
  unconditionally.

**Idempotency & replay**

- **EC-30 — `applyToDocument` called twice with the same theme.** `✅` Idempotent
  by construction (`classList.toggle` with an explicit force flag).

**UI-specific: loading vs error vs empty**

- **EC-31 — The library provides three distinct scaffolds** (`Skeleton`/`Spinner`/
  `AppLoader`, `Alert`, `Empty`) but **does not enforce** that a consumer uses
  them distinctly. The ladder is enforced only in `insights-admin`'s `WidgetCard`.
  Every other list page re-implements it, which is where BUGBOT's "error
  masquerading as empty" pattern keeps recurring.

---

### 4A. Accessibility & Section 508 Conformance

**Standards tested against:** WCAG 2.1 Level AA (the `accessibility` skill's
target), with the Revised Section 508 provision cited alongside. 508 E205.4
incorporates WCAG 2.0 A+AA by reference for electronic content; 502.2/502.3 and
503.2/503.4 are the Chapter 5 software provisions; 504.2 applies because the
admin is an authoring tool. WCAG 2.2 criteria are marked **advisory** only.

**Why axe is not enough here.** `apps/admin-e2e/src/support/a11y.ts:12-23` runs
axe with `wcag2a, wcag2aa, wcag21a, wcag21aa` and **no rule exclusions** — good.
But axe evaluates roughly a third of the AA criteria and none of the following,
all of which this unit owns: focus restoration after a dialog or menu closes,
focus survival when a container becomes `inert`, whether an accessible name is
*meaningful* rather than merely present, keyboard traps, announcement timing, and
contrast in the **dark** theme (every scan runs in the default light scheme —
there is no `colorScheme: 'dark'` Playwright project in
`apps/admin-e2e/playwright.config.ts:33-58`). A green axe run on this library is
not a conformance claim.

---

#### ♿ A11Y-design-system-01 — Icon-only buttons across the library rely on hard-coded English `sr-only` text or nothing at all

**WCAG:** `4.1.2 Name, Role, Value (A)`, `3.1.2 Language of Parts (AA)` · **508:** `E205.4 / 502.3.1 (Object Information)` · **Verdict: Partially Supports**

**Location:** `packages/design-system/src/lib/components/ui/dialog.tsx:45-48`;
`packages/design-system/src/lib/components/ui/sheet.tsx:65-68`;
`packages/design-system/src/lib/components/ui/sidebar.tsx:319-321, 333, 336`;
`packages/design-system/src/lib/components/ui/command.tsx:40-41`

Every icon-only control the library ships **does** have an accessible name — so
it is not a bare `4.1.2` failure — but the name is a hard-coded English literal
with no prop to override it: `"Close"` (Dialog, Sheet), `"Toggle Sidebar"`
(SidebarTrigger, SidebarRail), `"Command palette"` / `"Search for a command to
run."` (CommandDialog defaults), `"Sidebar"` / `"Displays the mobile sidebar."`
(mobile sidebar Sheet). In a German session the surrounding page is German and
these names are English, with no `lang` attribute marking the change.

**Keyboard-only user:** unaffected — the controls are reachable and operable.
**Screen-reader user:** a German NVDA voice reads "Close" with German phonetics,
which is often unintelligible. The mobile sidebar announces as a dialog named
"Sidebar" regardless of locale.
**Remediation:** add optional label props (`closeLabel`, `toggleLabel`) defaulting
to the current strings, and have `shell-admin` pass localized values, exactly as
`CommandDialog` already allows via `title`/`description`. Cross-reference
`🐞 BUG-design-system-03` — the same root cause also produces *visible* untranslated
text in `Pagination`.

#### ♿ A11Y-design-system-02 — `MultiSelect` conveys selection by an `aria-hidden` icon only

**WCAG:** `4.1.2 Name, Role, Value (A)`, `1.4.1 Use of Color (A)` · **508:** `E205.4 / 502.3.6 (Values), 502.3.10 (List)` · **Verdict: Does Not Support**

**Location:** `packages/design-system/src/lib/components/ui/multi-select.tsx:117-149`

The trigger is `role="combobox" aria-expanded` but carries **no**
`aria-haspopup="listbox"` and **no** `aria-controls`. The popover is a cmdk
`Command`, whose rows expose `aria-selected` for the *highlighted* row, not the
*chosen* one. Chosen-ness is drawn as `<Check aria-hidden className="opacity-100|0">`
(`multi-select.tsx:134-142`) — an icon that is (a) hidden from assistive
technology and (b) distinguished from unchosen purely by opacity.

**Keyboard-only user:** can operate it — arrows move, `Enter` toggles — but gets
no confirmation other than a badge appearing in the trigger behind the popover.
**Screen-reader user:** hears "Editor" for both a chosen and an unchosen row.
There is no way to determine the current selection without closing the popover
and reading the badge list.
**Remediation:** put `aria-multiselectable="true"` on the list, set
`aria-selected` per row from the `value` set rather than relying on cmdk's
highlight, and add `aria-haspopup="listbox"` + `aria-controls` to the trigger.

#### ♿ A11Y-design-system-03 — `<th>` cells carry no `scope`, and tables have no accessible name

**WCAG:** `1.3.1 Info and Relationships (A)` · **508:** `E205.4 / 502.3.3 (Row, Column, and Headers)` · **Verdict: Partially Supports**

**Location:** `packages/design-system/src/lib/components/ui/table.tsx:73-85` (no `scope`), `5-16` (no name on `<table>`)

`TableHead` renders a bare `<th>`. Browsers infer column association from
position, which happens to be correct for the admin's flat single-header grids —
so this "supports" in practice today — but the moment a consumer adds a
`colspan`, a row header, or a second header row, the association silently
becomes wrong with nothing to catch it. Separately, no shipped table passes a
`TableCaption` or an `aria-label`, so on a page with two tables a screen-reader
user's table list reads "table, table".

**Keyboard-only user:** unaffected. **Screen-reader user:** table-navigation mode
announces the right header today by inference, not by markup.
**Remediation:** default `TableHead` to `scope="col"` (overridable), and make
`Table` require either `aria-label`/`aria-labelledby` or a `TableCaption`.

#### ♿ A11Y-design-system-04 — The `Table` scroll container is not keyboard-scrollable

**WCAG:** `2.1.1 Keyboard (A)` · **508:** `E205.4 / 502.3.14 (Event Notification)`, `Chapter 5 502.2.2` · **Verdict: Does Not Support**

**Location:** `packages/design-system/src/lib/components/ui/table.tsx:9`

Cross-reference `🐞 BUG-design-system-04` for the functional write-up. Noted
here because axe's `scrollable-region-focusable` rule (tagged `wcag2a`/`wcag211`)
**would** catch it — but only if a scan ran at a viewport where the table
actually overflows. Every `a11y.spec.ts` runs at the default 1280×720 desktop
viewport, so the rule never fires. This is the clearest example in the repo of
"a clean axe run proves nothing about the states you did not scan."

**Remediation:** `tabIndex={0}` plus `role="region"` and an accessible name on
the wrapper when it overflows.

#### ♿ A11Y-design-system-05 — `Spinner` is an empty live region; `Skeleton` pushes `aria-busy` onto the consumer

**WCAG:** `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3.14` · **Verdict: Partially Supports**

**Location:** `packages/design-system/src/lib/components/ui/spinner.tsx:15-22`; `packages/design-system/src/lib/components/ui/skeleton.tsx:16-22`

`Spinner` sets `role="status"` on an `<svg>` with no text content. A live region
with nothing in it announces nothing, so the role buys nothing — while the
*presence* of several such regions on one page (four spinners = four live
regions) is a real source of confusing announcements when a consumer later puts
text inside one. `Skeleton`'s JSDoc correctly instructs consumers to wrap a
placeholder block in a named `role="status"`, but nothing enforces it, and at
least one consumer does not (`♿ A11Y-insights-admin-01`).

`AppLoader` (`app-loader.tsx:30-44`) is the reference implementation and does it
right: one `role="status"` region, spinner `aria-hidden`, label carrying the text.

**Keyboard-only user:** unaffected. **Screen-reader user:** a page transitioning
into a loading state announces nothing, so a blind user cannot tell whether the
app is working or stuck.
**Remediation:** drop `role="status"` from `Spinner` and give it `aria-hidden`
by default; add an `aria-busy` + `label` contract to `Skeleton` (or ship a
`SkeletonRegion` wrapper) so the correct pattern is the easy one.

#### ♿ A11Y-design-system-06 — Contrast and platform preferences are unverified in the dark theme and under forced colors

**WCAG:** `1.4.3 Contrast (Minimum) (AA)`, `1.4.11 Non-text Contrast (AA)`, `1.4.12 Text Spacing (AA)`, `1.4.10 Reflow (AA)` · **508:** `E205.4 / 503.2 (User Preferences)` · **Verdict: Partially Supports — unverified**

**Location:** tokens live outside this unit (`apps/admin/src/styles.css`), consumed by every `*.tsx` here; scan config at `apps/admin-e2e/src/support/fixtures.ts:108-117` and `apps/admin-e2e/playwright.config.ts:33-38`

Concretely unverified:

- **Dark theme contrast.** Every axe scan runs in the browser default (light).
  `AGENTS.md` records that the scan once caught a real `muted-foreground`
  failure — in light mode. The dark palette has never been scanned.
- **Focus-ring contrast.** `focus-visible:ring-ring/40` (`button.tsx:8`) is a
  40%-opacity ring; `1.4.11` requires 3:1 for the focus indicator against
  adjacent colours. At 40% alpha over `bg-primary` this is very likely below 3:1
  in at least one theme.
- **`forced-colors` / Windows High Contrast.** Nothing in the package emits
  `forced-colors` media rules, so any state drawn only as a `background-color` is
  flattened by the forced palette. Two components to check first —
  `SegmentedControlItem` (`segmented-control.tsx:57`) and `SidebarMenuButton`
  (`sidebar.tsx:588`). **Correction to an earlier draft:** these do *not* lose
  their selected state "entirely". Both pair the fill with a **font-weight bump**
  on the same line (`data-[state=on]:font-semibold`,
  `data-[active=true]:font-medium`), and the comment at `segmented-control.tsx:55-56`
  says that is deliberate — "so the selection is distinguishable without relying
  on color alone". Weight survives forced colors, so the residual risk is reduced
  salience, not a total loss, and 1.4.1 Use of Colour is satisfied by design.
- **`prefers-reduced-motion`.** Honoured by the dropdown motion utility
  (`packages/design-system/src/styles.css:74-79`) and the wizard step entrance
  (`:98-102`), but **not** by `Dialog`/`Sheet`/`Drawer`, whose
  `animate-in`/`slide-in` classes are unconditional (`dialog.tsx:39`,
  `sheet.tsx:32`).
- **Text spacing / reflow.** Never tested; `whitespace-nowrap` on `Button`
  (`button.tsx:8`) and on `PageTopBar`'s crumbs is where `1.4.12` typically breaks.

**Remediation:** add a second Playwright project with
`use: { colorScheme: 'dark' }` and re-run every existing `a11y.spec.ts` against
it; add a `forcedColors: 'active'` smoke scan; wrap the overlay animations in a
`motion-reduce:` variant.

#### ♿ A11Y-design-system-07 — Focus is dropped when the sidebar collapses

**WCAG:** `2.4.3 Focus Order (A)`, `3.2.2 On Input (A)` · **508:** `E205.4 / 502.3.12 (Focus Cursor)` · **Verdict: Does Not Support**

Cross-reference `🐞 BUG-design-system-01` — filed there as a functional defect
because it also breaks the `Ctrl+B` shortcut. The a11y half: the collapse control
lives inside the region it hides, so activating it from the keyboard puts the
user on `<body>` with no announcement and no way back except Tab-from-the-top.

**Remediation:** on collapse, move focus to the reveal trigger that replaces it
(the inline `TopBar` trigger or `SidebarToggle`), and announce the state change
via `aria-expanded` on whichever trigger is visible.

#### ♿ A11Y-design-system-08 — `Tooltip` focus behaviour and `1.4.13` dismissibility are unverified

Unverified — Radix's default focus/`Esc` behaviour and the effect of `hidden` on the
accessibility tree were both read from the component's props, not observed in a browser.

**WCAG:** `1.4.13 Content on Hover or Focus (AA)` · **508:** `E205.4` · **Verdict: Unverified**

**Location:** `packages/design-system/src/lib/components/ui/tooltip.tsx`; consumed at `packages/design-system/src/lib/components/ui/sidebar.tsx:651-661`

Radix Tooltip shows on focus and dismisses on `Esc` by default, so this most
likely **Supports** — but there is **zero** coverage (F28 is ❌) and
`SidebarMenuButton` passes `hidden={state !== 'collapsed' || isMobile}`
(`sidebar.tsx:657`), which is a Radix prop whose effect on the accessibility tree
has not been checked. If `hidden` merely hides visually, every expanded sidebar
row carries a redundant `aria-describedby` duplicating its own label.

**Remediation:** add a keyboard spec that focuses a tooltip trigger, asserts the
tooltip is visible, presses `Esc`, and asserts it is gone with focus unmoved.

#### Advisory (WCAG 2.2 — not referenced by 508)

- **2.4.11 Focus Not Obscured (Minimum, AA).** The portaled `TopBar` is `sticky`
  above the scrollport; a focused element scrolled to the very top of
  `div[data-slot="sidebar-inset-scroll"]` may sit under it.
- **2.5.8 Target Size (Minimum, AA).** `SidebarTrigger` is `size-7` = 28px
  (`sidebar.tsx:312`); `SegmentedControlItem` is `h-7` = 28px
  (`segmented-control.tsx:52`); `JsonPreview`'s toggle and the summary chips'
  `×` are smaller still. All below the 24×24 floor only when spacing is also
  tight — worth measuring.

---

## 5. E2E Coverage Map

There is **no unit test in this package** — `packages/design-system` has a
`tsconfig.spec.json` but no `*.spec.ts` files (verified by glob). Everything below
is indirect coverage: an admin-e2e spec exercising a *consumer* that happens to
render the primitive.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F3 Button, F4 Input, F5 InputField, F6 Field, F40 Alert | `apps/admin-e2e/src/auth/a11y.spec.ts:23-46` | axe-clean with required-field errors visible and with the credential-error banner visible | ✅ E2E — the strongest coverage in the unit; it scans the *error* state, not just the idle one |
| F5 InputField label wiring | `apps/admin-e2e/src/auth/keyboard.spec.ts:80-86` | Tab order Name → Email → Password → Confirm on the accept-invite form | ⚠️ PARTIAL — asserts tab order, not that `aria-describedby` points at the hint and the error |
| F5/F6 error association | `apps/admin-e2e/src/auth/a11y.spec.ts:30-32` | a field error appears and axe passes | ⚠️ PARTIAL — axe's `aria-valid-attr-value` does not verify the *content* of `aria-describedby`; `EC-01`/`EC-02` are untested |
| F44 AppLoader | `apps/admin-e2e/src/auth/a11y.spec.ts:107-118` | the boot screen is scanned in isolation with `/api/auth/me` held open 30s | ✅ E2E |
| F13 SegmentedControl | `apps/admin-e2e/src/insights/a11y.spec.ts:87-103` | arrow moves focus **without** selecting (`aria-checked` still `false`), `Enter` commits, the previous item unchecks | ✅ E2E — exemplary; this is the pattern every other primitive's keyboard spec should copy |
| F19 Table (sortable headers) | `apps/admin-e2e/src/content/content-library.spec.ts:442-460` | `aria-sort` cycles ascending → descending → none in step with the URL | ✅ E2E — but the *consumer* sets `aria-sort`; the primitive is untested |
| F19 Table (semantics) | `apps/admin-e2e/src/content/a11y.spec.ts:32-43` | axe-clean on the real records table incl. selection checkboxes | ⚠️ PARTIAL — desktop viewport only, so the overflow/`2.1.1` case (`♿ A11Y-design-system-04`) is never reached |
| F21 Dialog / F26 DropdownMenu | `apps/admin-e2e/src/users/keyboard.spec.ts:39-48` | the row menu opens on `Enter` from a focused trigger and a menu item is visible | ⚠️ PARTIAL — never asserts focus **restoration** to the trigger on close, which is the criterion that actually breaks |
| F21 Dialog focus restore | `apps/admin-e2e/src/copilot/agents-manage.spec.ts:96` | `rowMenuTrigger` is focused after a dialog interaction | ✅ E2E — the one place restoration is asserted |
| F26 DropdownMenu `modal={false}` | `apps/admin-e2e/src/content/a11y.spec.ts:45-54` | axe-clean with the column picker **open** | ✅ E2E |
| F27 Command / CommandDialog | `apps/admin-e2e/src/content/content-library.spec.ts:138-147` | `⌘K` opens, the input takes focus, `Esc` closes | ✅ E2E |
| F27 Command (open-state a11y) | `apps/admin-e2e/src/content/a11y.spec.ts:56-60` | axe-clean with the palette open | ✅ E2E |
| F24 Drawer / F25 Popover | `apps/admin-e2e/src/content/records-filter.spec.ts:161` | `Escape` inside the filter surface | ⚠️ PARTIAL — asserts the close, not where focus lands |
| F33/F34 Sidebar | `apps/admin-e2e/src/shell/command-palette.spec.ts` | the palette that lives in the sidebar header | ⚠️ PARTIAL — no spec anywhere presses `⌘B`, asserts the collapsed state, or asserts focus after collapse |
| F39 Toaster | mutation specs across `users/`, `workspaces/`, `content/` | a toast's *text* appears after a mutation | ⚠️ PARTIAL — no spec asserts live-region politeness, and none raises two toasts to expose `🐞 BUG-design-system-08` |
| F41 Empty | `apps/admin-e2e/src/users/members.spec.ts` (no-results path) | the empty state renders on a non-matching filter | ⚠️ PARTIAL — never asserts that a **failed** request renders the `Alert` instead |
| F2 Appearance | — | — | ❌ NONE — no spec toggles the theme, so the dark palette has never been exercised by any automated check |
| F12 MultiSelect | — | — | ❌ NONE — exported but mounted nowhere in the admin |
| F14/F15/F16 Date pickers, Calendar | — | — | ❌ NONE |
| F28 Tooltip | — | — | ❌ NONE |
| F37 SidebarRail | — | — | ❌ NONE (deliberately unrendered) |
| F38 Sidebar cookie | — | — | ❌ NONE |
| F46/F47/F48 Wizard chrome | `apps/admin-e2e/src/workspaces/keyboard.spec.ts:76-94` | the "New workspace" button and a colour radio take focus | ⚠️ PARTIAL — never steps the `Stepper`, never jumps back to a reached step |
| F54 Progress | — | — | ❌ NONE |
| F1 `cn`, F56 `useIsMobile` | — | — | ❌ NONE |

**Coverage tally:** `56 features · 18 ✅ · 22 ⚠️ · 16 ❌`

---

## 6. 🐞 Potential Bugs

Ranked by severity.

### 🐞 BUG-design-system-01 — The global `⌘B`/`Ctrl+B` sidebar shortcut fires from inside text fields and the editor, and collapsing drops focus into an `inert` subtree · Severity: Medium

**Location:** `packages/design-system/src/lib/components/ui/sidebar.tsx:112-125`, and `sidebar.tsx:282-283`
**Category:** correctness / a11y

**What the code does:**

```ts
React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (
            event.key === SIDEBAR_KEYBOARD_SHORTCUT &&      // 'b'
            (event.metaKey || event.ctrlKey)
        ) {
            event.preventDefault();
            toggleSidebar();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [toggleSidebar]);
```

The listener is attached to `window` with no check on `event.target`, so it fires
while the caret is inside any text field, textarea, or `contenteditable`.
`preventDefault()` then suppresses the browser's and the editor's own handling.

**Why it is wrong:** the admin ships a rich-text editor —
`apps/admin-e2e/src/content/wysiwyg-fields.spec.ts` drives it, and
`WysiwygFieldPage.surface('Body')` is a `contenteditable` region
(`wysiwyg-fields.spec.ts:150`). `Ctrl+B` / `⌘B` is the universal bold shortcut in
every such editor, and TipTap's `StarterKit`
(`packages/wysiwyg/admin/src/lib/infrastructure/editorExtensions/index.ts:33`)
registers `Mod-b` for it. So the two handlers collide on the same chord while the
caret is in the body field, and app chrome moves during typing.

**Unverified — the collision's exact outcome.** ProseMirror binds its keymap on
the editable element, so it runs on the bubble path *before* this `window`
listener; the likely result is that the text **is** bolded **and** the sidebar
also toggles, rather than bold being suppressed. An earlier draft of this artifact
asserted the stronger claim (bold silently stops working); that could not be
confirmed from source and is not asserted here. What **is** confirmed from source
is the defect proper: a `window` keydown listener with **no `event.target` check
and an unconditional `preventDefault()`**, which is precisely the pattern the
sibling `⌘K` palette bug (`docs/testing/shell-admin.md`
`🐞 BUG-shell-admin-02`) also exhibits, and which means a global chrome shortcut
fires from inside every input, textarea and editor in the product.

Compounding it, `Sidebar` marks the collapsed panel `inert`
(`sidebar.tsx:282-283`). The in-header `SidebarTrigger` lives *inside* that panel
(`packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:80`),
so pressing `Enter` on it — or pressing `⌘B` while focus is anywhere in the
sidebar — leaves the focused element inside an `inert` subtree. Browsers blur it
to `<body>`; the user's place in the tab order is gone. This half needs no
runtime confirmation: `inert` blurring its focused descendant is specified
behaviour, and nothing in the collapse path moves focus first.

**Repro:**
1. `npm run dev`, sign in, open a content entry with a WYSIWYG body field.
2. Click into the body, type `hello`, select it, press `⌘B`.
3. → Observed: the sidebar slides shut mid-edit (and, per the note above, the
   text is probably also bolded). Expected: the editor consumes the chord and the
   sidebar is untouched.
4. Separately: Tab to the sidebar's in-header trigger, press `Enter`.
5. → Observed: `document.activeElement` is `<body>`. Expected: focus on the
   reveal trigger that replaced it.

**Blast radius:** every keyboard user of the shell (focus loss on collapse — the
confirmed half) and every content author who uses `⌘B` while editing (unexpected
chrome movement). Medium rather than High: no data is lost or exposed, and the
worst confirmed outcome is a lost tab position.
**Suggested fix:** bail out of the handler when `event.target` is an editable
element (`isContentEditable`, `INPUT`, `TEXTAREA`), and on collapse move focus to
the reveal trigger before the panel becomes `inert`.

### 🐞 BUG-design-system-02 — `DateTimePicker` silently discards the seconds a user types, and re-zeroes them when the day changes · Severity: Medium

**Location:** `packages/design-system/src/lib/components/ui/date-picker.tsx:30-41, 152-165, 216-224`
**Category:** correctness / data-loss

**What the code does:**

```ts
function timeOf(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;   // no seconds
}
…
<Input type="time" step="1" value={value ? timeOf(value) : ''} … />
…
const setDate = (day) => onChange(value ? withTimeOf(day, timeOf(value)) : day);
```

`step="1"` tells the browser to render and accept a seconds field. `setTime` →
`withTimeOf` **does** store the seconds (`next.setHours(h, m, s, 0)`), but the
input's `value` is re-derived through `timeOf`, which truncates to `HH:mm`. And
`setDate` round-trips the existing value through `timeOf` too, so changing the
day drops the seconds from the *model*, not just the display.

**Why it is wrong:** the control is fully controlled, so its displayed value must
be the model's value. Here they diverge the instant a user types a seconds
component — the classic controlled/uncontrolled drift the `admin-plugin` skill
warns about. Either the field should not offer seconds (`step` omitted, the
default), or `timeOf` must emit `HH:mm:ss`.

**Repro:**
1. Mount a `DateTimePicker`, pick 14 March.
2. In the time field type `10:30:45`. → the model holds `10:30:45`; the field
   redisplays `10:30`.
3. Pick 15 March. → Observed: the model is now `15 March 10:30:00`.
   Expected: `15 March 10:30:45`.

**Blast radius:** any consumer using `DateTimePicker` for a scheduled-publish or
expiry instant; a 45-second silent shift is small but unexplained, and the
display/model divergence is a latent source of "I set it and it didn't save".
**Suggested fix:** make `timeOf` emit seconds when they are non-zero, or drop
`step="1"`.

### 🐞 BUG-design-system-03 — Hard-coded English strings in `Pagination`, `Dialog`, `Sheet`, `Sidebar`, `Command` and `ConfirmDialog` cannot be localized · Severity: Medium

**Location:** `packages/design-system/src/lib/components/ui/pagination.tsx:10, 67, 73, 83, 88, 104`; `dialog.tsx:47`; `sheet.tsx:67`; `sidebar.tsx:235-238, 320, 333, 336`; `command.tsx:40-41`; `confirm-dialog.tsx:49`
**Category:** correctness (i18n)

**What the code does:**

```tsx
<PaginationLink aria-label="Go to previous page" …>
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>          {/* JSX children — props.children cannot override */}
</PaginationLink>
```

`PaginationPrevious`/`Next` write their label as JSX children, which take
precedence over anything spread from `{...props}`, so a consumer cannot pass a
translated node. The `<nav aria-label="pagination">` is likewise fixed.

**Why it is wrong:** the admin is a `react-intl` application — the root
`AGENTS.md` states every user-facing string goes through `defineMessages`. Most
of this library honours that by taking labels as props (`SearchToolbar`'s
`searchLabel`, `AppLoader`'s `label`, `Stepper`'s `stepAriaLabel`,
`CommandDialog`'s `title`). `Pagination` is the outlier that renders *visible*
untranslated text; the others render untranslated *accessible names* (see
`♿ A11Y-design-system-01`).

**Repro:**
1. Switch the admin to a non-English locale.
2. Open any paginated list. → Observed: the pager reads "Previous"/"Next".
   Expected: the localized equivalents.

**Blast radius:** every list page in every non-English deployment.
**Suggested fix:** give `PaginationPrevious`/`Next`/`Ellipsis` and `Pagination`
optional label props defaulting to today's strings, and do the same for the
`Dialog`/`Sheet` close buttons and the sidebar's mobile title.

### 🐞 BUG-design-system-04 — The `Table` scroll container cannot be scrolled by keyboard · Severity: Medium

**Location:** `packages/design-system/src/lib/components/ui/table.tsx:5-16`
**Category:** a11y

**What the code does:**

```tsx
<div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
</div>
```

The wrapper is the horizontal scrollport for every admin table. It has no
`tabIndex`, no `role`, and no accessible name, and the wrapper takes no
`className` from the consumer either.

**Why it is wrong:** the same repository already solved this correctly one file
away — `SidebarInset` gives its scrollport `tabIndex={0}` with a comment citing
WCAG 2.1.1 verbatim (`sidebar.tsx:398-410`). A scrollable region that only a
mouse wheel can reach fails 2.1.1; the content records table with 8+ columns
overflows at any laptop width.

**Repro:**
1. Open `/workspaces/:id/content/<collection>` and enable enough columns to
   overflow horizontally.
2. Unplug the mouse. Tab through the page.
3. → Observed: focus never lands on the scroll container; the off-screen columns
   are unreachable. Expected: the container is focusable and arrow-scrollable.

**Blast radius:** every table in the admin, for every keyboard-only user.
**Suggested fix:** `tabIndex={0}` on the wrapper plus `role="region"` and a
`aria-label`, mirroring `SidebarInset`. Cross-reference `♿ A11Y-design-system-04`.

### 🐞 BUG-design-system-05 — `InputField` hides a real error when `invalid={false}` is passed explicitly, and renders an empty alert for `errors={[]}` · Severity: Low

**Location:** `packages/design-system/src/lib/components/ui/input-field.tsx:55-57, 93-97`; `packages/design-system/src/lib/components/ui/field.tsx:192-229`
**Category:** correctness / ux-state

**What the code does:**

```ts
const hasError = !!error || (errors?.some((e) => e?.message) ?? false);
const isInvalid = invalid ?? hasError;
const showError = isInvalid && (error || errors);
```

Two asymmetries fall out. (a) `invalid` is documented as "when omitted, derived
from the presence of `error`/`errors`" — but when *supplied* as `false` it also
suppresses rendering of an `error` that was supplied, because `showError`
requires `isInvalid`. A form library that computes `invalid` from "touched &&
error" will pass `invalid={false}` on an untouched field and the message
disappears — probably intended, but the prop's JSDoc does not say so.
(b) `errors={[]}` is truthy, so with `invalid` forced true, `showError` is true;
`FieldError`'s `content` then falls through to the `<ul>` branch
(`field.tsx:205-212`), which is a truthy element even with zero `<li>` children,
so an empty `role="alert"` box renders.

**Why it is wrong:** a `role="alert"` inserted with no content is an announcement
of nothing, and the `invalid={false}` behaviour contradicts the prop docs at
`input-field.tsx:22-26`.

**Repro:**
1. `<InputField id="x" label="X" invalid errors={[]} />` → Observed: an empty
   `div[role=alert]` in the DOM. Expected: nothing.
2. `<InputField id="x" label="X" invalid={false} error="Required" />` →
   Observed: no message. Expected: per the docs, ambiguous.

**Blast radius:** low — no shipped consumer passes `errors={[]}` today.
**Suggested fix:** in `FieldError`, return `null` when the mapped list is empty;
and document (or change) the `invalid={false}` suppression.

### 🐞 BUG-design-system-06 — `MultiSelect` keys cmdk items by `label`, so two options sharing a label collide · Severity: Medium

**Location:** `packages/design-system/src/lib/components/ui/multi-select.tsx:128-144`
**Category:** correctness

**What the code does:**

```tsx
<CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
```

cmdk uses `value` for filtering, for the highlight, and for its internal item
registry. Setting it to the human label means (a) two options with the same label
are indistinguishable to cmdk — they filter and highlight as one — and (b) the
search box matches labels only, so typing an option's underlying value (a slug, a
uuid) finds nothing.

**Why it is wrong:** the sibling `SidebarCommandItem`
(`packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/SidebarCommandItem/index.tsx:35`)
has the identical pattern for the same reason, and there it is defensible (labels
*are* the search target). Here the component exposes a `value`/`label` pair
precisely because they differ.

**Repro:** mount `MultiSelect` with
`[{value:'a',label:'Editor'},{value:'b',label:'Editor'}]`, open it, type
`Editor`. → Observed: one highlightable row, and toggling it is ambiguous.
Expected: two rows.

**Blast radius:** **live, not latent.** An earlier draft of this artifact claimed
`MultiSelect` is "mounted nowhere in the shipped admin"; that is wrong — grep finds
two consumers, and one of them can genuinely produce duplicate labels:
`packages/api-tokens/admin/src/lib/presentation/components/CreateApiTokenDialog/index.tsx:187-192`
maps `{ value: workspace.id, label: workspace.name }`, and **nothing prevents two
workspaces from sharing a name** (the uniqueness constraint is on the slug, not the
name), so an admin scoping a token to one of two same-named workspaces sees a single
row and cannot tell which id it selects — on a security-scoping control. The second
consumer,
`packages/content/admin/src/lib/presentation/components/EntryFieldInput/index.tsx:336-338`,
renders a `multiselect` field's declared options, whose labels are author-controlled
and equally free to repeat. Severity raised from Low to Medium on that basis.
**Suggested fix:** `value={option.value}` and pass `keywords={[option.label]}`
so search still matches the label.

### 🐞 BUG-design-system-07 — The sidebar's `sidebar_state` cookie is written but never read, so the collapsed state does not survive a reload · Severity: Low

**Location:** `packages/design-system/src/lib/components/ui/sidebar.tsx:26-27, 87-102`
**Category:** ux-state

**What the code does:** `setOpen` writes
`document.cookie = 'sidebar_state=<bool>; path=/; max-age=604800'` on every
toggle. Nothing anywhere reads `SIDEBAR_COOKIE_NAME` back — the initial state
comes from `defaultOpen = true`, and `AppShell` mounts `<SidebarProvider>` with
no `defaultOpen` (`packages/shell/admin/src/lib/components/AppShell/index.tsx:48`).

**Why it is wrong:** this is the upstream shadcn pattern, where a server
component reads the cookie and passes `defaultOpen`. In a pure SPA there is no
such reader, so the write is dead code and the documented behaviour
("cookie-persisted", `packages/shell/admin/src/lib/components/AppShell/index.tsx:29`)
is false. Separately the cookie carries no `SameSite` or `Secure` attribute.

**Repro:** collapse the sidebar, reload. → Observed: expanded. Expected:
collapsed. Compare `PageChromeProvider`, which persists the right panel correctly
via `localStorage` (`packages/shell/admin/src/lib/utils/pageChrome/index.tsx:66-74, 112-122`).

**Blast radius:** cosmetic, but it makes the shell's own documentation wrong.
**Suggested fix:** read the cookie in `SidebarProvider`'s `useState` initialiser
(guarded like `readStoredTheme`), or drop the write and use `localStorage` the
way the right panel does.

### 🐞 BUG-design-system-08 — Clicking one toast dismisses the entire stack · Severity: Low

**Location:** `packages/design-system/src/lib/components/ui/sonner.tsx:27-38`
**Category:** ux-state

**What the code does:**

```tsx
<div onClick={(event) => { if (isToastBodyClick(event.target)) toast.dismiss(); }}>
```

`toast.dismiss()` with no argument dismisses **every** toast. The comment
acknowledges it ("Sonner doesn't expose a toast id in the DOM, so this dismisses
the (rarely more than one) visible stack") — but "rarely" is not "never": a bulk
action that toasts per item, or a mutation that toasts while an earlier toast is
still on screen, produces a stack.

**Why it is wrong:** a user dismissing the toast they have read also destroys the
one they have not, which may be the error message.

**Repro:** fire `toast.success('a'); toast.error('b'); toast.info('c')` from the
console, then click the body of the topmost one. → Observed: all three vanish.
Expected: one.

**Blast radius:** low frequency, but the lost message can be the error.
**Suggested fix:** read the toast id from the DOM
(`target.closest('[data-sonner-toast]')?.dataset` — sonner does expose an id in
recent versions) and pass it to `toast.dismiss(id)`; otherwise drop the
click-to-dismiss and rely on the close button, which already exists.

### 🐞 BUG-design-system-09 — `Stepper` keys steps by `label`, so two steps with the same label collide · Severity: Low

**Location:** `packages/design-system/src/lib/components/ui/wizard.tsx:59-69`
**Category:** correctness

**What the code does:** `steps.map((step, index) => …<li key={step.label}>)`.
`index + 1` is already computed on the previous line and is the natural key.

**Why it is wrong:** duplicate React keys produce a console warning and let React
reuse the wrong DOM node when the list changes — here, the wrong marker could
carry `aria-current="step"`.

**Repro:** pass `[{label:'Details',…},{label:'Details',…}]`. → Observed: a React
key warning; the second step's summary chip can render on the first.

**Blast radius:** the workspace-create wizard is the only consumer and its labels
are distinct, so nothing is broken today.
**Suggested fix:** `key={index}` (the list is static and ordered) or require a
step `id`.

### Checked and cleared (no defect found)

- **`SegmentedControl` deselect-to-empty.** Radix `ToggleGroup type="single"`
  emits `''` when the active item is re-pressed. Both consumers guard
  (`GroupNode/index.tsx:83-87`, `InsightsRangePicker/index.tsx:45-49`), and the
  control is fully controlled so the state never actually clears. Not a defect.
- **`SegmentedControl` ARIA claim.** The JSDoc claims "radiogroup semantics come
  for free"; verified true — `apps/admin-e2e/src/insights/a11y.spec.ts:90-103`
  asserts `aria-checked` on the items, which only exists under Radix's
  `role="radio"` rendering.
- **XSS.** No `dangerouslySetInnerHTML`, no `eval`, no `innerHTML` anywhere in
  `packages/design-system/src` (grepped).
- **`AppearanceProvider` storage failures.** Both read and write are `try/catch`ed
  and degrade to in-memory (`appearance/index.tsx:51-58, 116-126`).
- **`InputField` `aria-describedby` merging.** The consumer's value is appended,
  not clobbered (`input-field.tsx:61-69`) — correct, and better than most shadcn
  ports.
- **`TopBar` portal-vs-context.** The bar keeps its page's React context because
  `createPortal` moves DOM only (`top-bar.tsx:57`) — verified against the
  reasoning in `packages/shell/admin/AGENTS.md:44-53`.
- **`byOrder` mutation safety** (used by consumers of this unit's `Sidebar`):
  copies before sorting (`packages/utils/admin/src/lib/byOrder/index.ts:6-8`).

**Tally:** `9 🐞 — 0 Critical · 0 High · 5 Medium · 4 Low (0 🔒)` ·
`♿ 8 findings — 0 Supports · 4 Partially Supports · 3 Does Not Support · 1 Unverified`

---

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` mock | `src/shell/sidebar-shortcut.spec.ts` | With the caret inside a WYSIWYG body field, `⌘B` bolds the selection and the sidebar stays expanded; with focus on the page body, `⌘B` collapses it | `🐞 BUG-design-system-01`, F34 ⚠️ |
| 2 | `apps/admin-e2e` | `src/shell/sidebar-focus.spec.ts` | After activating the in-header trigger from the keyboard, `document.activeElement` is the reveal trigger — not `<body>` | `🐞 BUG-design-system-01`, `♿ A11Y-design-system-07` |
| 3 | `apps/admin-e2e` (new Playwright project) | `playwright.config.ts` gains `{ name:'chromium-dark', use:{ colorScheme:'dark' } }`; every existing `*/a11y.spec.ts` runs under both | axe `color-contrast` passes in the dark palette; focus rings clear 3:1 | `♿ A11Y-design-system-06`, F2 ❌ |
| 4 | `apps/admin-e2e` | `src/content/table-scroll.spec.ts` at a 600px viewport | The records table's scroll container is focusable and `ArrowRight` scrolls it; axe's `scrollable-region-focusable` is exercised | `🐞 BUG-design-system-04`, `♿ A11Y-design-system-04` |
| 5 | `apps/admin-e2e` | `src/users/dialog-focus.spec.ts` | Open the remove-member `ConfirmDialog` from the keyboard, `Esc`, assert focus is back on the row-menu trigger; repeat for Sheet and Drawer | F21/F22/F23 ⚠️ |
| 6 | `apps/admin-e2e` | `src/shell/toast.spec.ts` | Raise two toasts, click one body, assert exactly one is dismissed; assert the live region exists before the first toast | `🐞 BUG-design-system-08`, `♿ A11Y-design-system-05` |
| 7 | package unit (`jest`, node env — the pattern `packages/insights/admin` already uses) | `packages/design-system/src/lib/components/ui/date-picker.spec.ts` | `timeOf`/`withTimeOf` round-trip preserves seconds; a DST-transition instant is not shifted | `🐞 BUG-design-system-02`, F15 ❌ |
| 8 | package unit | `packages/design-system/src/lib/components/ui/field.spec.tsx` | `FieldError` renders nothing for `errors=[]` / `[{}]`; `InputField` composes `aria-describedby` from description + error + consumer value in that order | `🐞 BUG-design-system-05`, F6 ⚠️ |
| 9 | `apps/admin-e2e` | `src/shell/i18n-chrome.spec.ts` with the intl locale forced to `de` | The pager's visible labels, the dialog close button's accessible name and the sidebar trigger's name are all localized | `🐞 BUG-design-system-03`, `♿ A11Y-design-system-01` |
| 10 | `apps/admin-e2e` | `src/shell/tooltip.spec.ts` | A tooltip appears on **focus**, stays while hovered, and is dismissed by `Esc` without moving focus | `♿ A11Y-design-system-08`, F28 ❌ |
| 11 | `apps/admin-e2e` | `src/workspaces/wizard-stepper.spec.ts` | Step forward twice, jump back to step 1 from the keyboard, assert `aria-current="step"` moves and the summary chip renders | F46/F48 ⚠️ |
| 12 | `apps/admin-e2e` (new project) | `{ name:'chromium-forced-colors', use:{ forcedColors:'active' } }` on one representative page | The selected `SegmentedControlItem` and the active sidebar row remain distinguishable | `♿ A11Y-design-system-06` (503.2) |
