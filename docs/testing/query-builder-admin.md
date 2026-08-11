# @ortha-cms/query-builder-admin — Test Artifact

> **Unit:** `packages/query-builder/admin` · **Package:** `@ortha-cms/query-builder-admin` · **Kind:** admin library (pure UI)
> **Source of truth:** `packages/query-builder/admin/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the visual filter-tree builder and its **wire grammar** — the state
shape (`FilterTree` = a recursive `FilterGroup` of `FilterRule`s), the
serialiser to the JSON `?filter=` payload the server's `parseFilterTree`
accepts, the inverse parser, the per-rule validation that gates Apply, and three
host shells (drawer, inline panel, collapsed summary).

**Does NOT own:** any data layer — it has no `apiClient`, no TanStack Query, no
router. The consumer supplies `fields` (a `FilterField[]` mirror of the server's
`FilterSchema`), owns the URL, owns whether Apply writes to the URL or to state,
and injects the relation record-picker via `renderRelationValue`. It also does
**not** own the server-side whitelist: any `field` string it emits is checked by
the server's `FilterSchema`, which is the real boundary.

- **Entry points** — `packages/query-builder/admin/src/index.ts:1-53`. Three
  components (`QueryBuilder`, `QueryBuilderDrawer`, `QueryBuilderPanel`), one
  read-out (`QueryBuilderSummary`), the type contracts (`FilterField`,
  `FilterTree`, `OpId`, `RuleValue`, `RelationValueEditor`), and six pure
  functions (`treeToJsonFilter`, `treeToJsonNode`, `jsonFilterToTree`,
  `countRules`, `validateRule`, `treeHasInvalidRules`) plus the tables
  `OPS_FOR_TYPE`, `OP_LABELS`, `UI_TO_WIRE`, `WIRE_TO_UI`, and the context hook
  `usePortalContainer`. No routes, no slots, no DI.
- **Runtime prerequisites** — a `react-intl` `IntlProvider` above it (every
  label goes through `defineMessages`); a `fields` array; for the field picker's
  popovers inside a scroll-locked host, a `portalContainer`. No env vars, no
  permissions, no network.
- **How to exercise it manually** — three shipped consumers:

    ```bash
    docker compose up -d && npm run dev
    ```

    - **Inline panel over a fetched schema** — `/workspaces/:id/content/<collection>`,
      the **Filters** toggle in the records toolbar
      (`packages/content/admin/src/lib/presentation/components/CollectionRecordsView/LoadedRecordsView/index.tsx:501`).
      This is the richest surface: relations, a fetched `fields` list with real
      pending/error states, and the record picker.
    - **Inline panel over a static schema** — `/activity`, the **Filters** toggle
      (`packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:243`).
    - **Drawer** — `/users` (Members), the filter button
      (`packages/users/admin/src/lib/presentation/pages/MembersPage/index.tsx:215`).

    All three read the tree from `?filter=` via
    `useMemo(() => jsonFilterToTree(filterParam), [filterParam])` and write it
    back on Apply, so a filter is a shareable deep link.
- **Dependencies that must be healthy** — `@ortha-cms/design-system`
  (`Select`, `Input`, `Checkbox`, `Popover`, `Drawer`, `Alert`, `Button`,
  `SegmentedControl`, `Spinner`), `react-intl`, `lucide-react`. On the server
  side, `parseFilterTree` in `@ortha-cms/utils-server` and each collection's
  `FilterSchema` — if the wire vocabulary drifts from `WIRE_OP`, every filter
  starts 400ing and nothing in this package would notice.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `QueryBuilder` — controlled recursive tree editor | `packages/query-builder/admin/src/lib/components/QueryBuilder/index.tsx:64-118` | ✅ E2E |
| F2 | `GroupNode` — AND/OR toggle, child list, Add rule / Add group, Remove group | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/index.tsx:63-161` | ⚠️ PARTIAL |
| F3 | Nested groups, unlimited FE depth (server caps via `maxGroupDepth`) | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/index.tsx:126-135`; `treeOps.addGroupTo:64-72` | ❌ NONE |
| F4 | `RuleRow` — field / operator / value cells + per-rule error line | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/index.tsx:100-202` | ✅ E2E |
| F5 | Changing the field resets the operator to the type's first and reseeds the value | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/index.tsx:140-151` | ✅ E2E |
| F6 | Changing the operator reseeds the value via `defaultValueForOp` | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/index.tsx:159-161`; `utils/defaultValueForOp.ts:19-34` | ⚠️ PARTIAL |
| F7 | Unknown-field handling — no `?? fields[0]` fallback; reports `UnknownField` unconditionally | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/index.tsx:115-126` | ❌ NONE |
| F8 | `FieldPicker` — relation-aware combobox, grouped Fields/Relations, flat search, `aria-activedescendant` | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/FieldPicker/index.tsx`; tree built by `utils/fieldTree.ts` | ✅ E2E |
| F9 | `OperatorPicker` — Select over `OPS_FOR_TYPE[field.type]` | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/OperatorPicker/index.tsx:25-44` | ✅ E2E |
| F10 | `ValueEditor` — per type/op control switch (text, number, `datetime-local`, boolean Select, enum Select, enum checkbox group, CSV, compound range, compound within-last, injected relation picker) | `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/ValueEditor/index.tsx:99-331` | ⚠️ PARTIAL |
| F11 | `CsvValueInput` — local draft, live parse, blur normalisation | `.../ValueEditor/CsvValueInput/index.tsx:29-83` | ⚠️ PARTIAL |
| F12 | `EnumMultiSelect` — constrained checkbox group for `is_one_of` on an enum | `.../ValueEditor/EnumMultiSelect/index.tsx:27-72` | ❌ NONE |
| F13 | `renderRelationValue` injection seam + `PortalContainerContext` | `packages/query-builder/admin/src/lib/components/portalContainer.ts:16-21`; used at `QueryBuilder/index.tsx:107` | ✅ E2E |
| F14 | `treeToJsonFilter` / `treeToJsonNode` — serialise, prune incomplete rules and empty groups | `packages/query-builder/admin/src/lib/utils/treeToJsonFilter.ts:35-77` | ✅ E2E |
| F15 | Operator → wire mapping incl. `contains`→`ilike` with `%…%`, LIKE-metachar escaping | `packages/query-builder/admin/src/lib/utils/treeToJsonFilter.ts:79-152`; `utils/wireOp.ts:33-43` | ✅ E2E |
| F16 | `between` → an `and` group of `gte`+`lte` | `packages/query-builder/admin/src/lib/utils/treeToJsonFilter.ts:114-122` | ❌ NONE |
| F17 | `within_last` → a resolved ISO `gte` cutoff, pinned at serialise time | `packages/query-builder/admin/src/lib/utils/treeToJsonFilter.ts:123-129` | ❌ NONE |
| F18 | `is_empty` / `is_not_empty` → `null:true` / `null:false` | `packages/query-builder/admin/src/lib/utils/treeToJsonFilter.ts:110-113` | ✅ E2E |
| F19 | `jsonFilterToTree` — parse `?filter=`, tolerate malformed JSON, wrap a bare rule in an AND root | `packages/query-builder/admin/src/lib/utils/jsonFilterToTree.ts:26-49` | ✅ E2E |
| F20 | `between` rehydration — a same-field `gte`+`lte` pair folds back into one Between rule | `packages/query-builder/admin/src/lib/utils/jsonFilterToTree.ts:78-81, 141-159` | ❌ NONE |
| F21 | `contains` rehydration — strip `%…%` and unescape `\%` / `\_` / `\\` | `packages/query-builder/admin/src/lib/utils/jsonFilterToTree.ts:116-129` | ❌ NONE |
| F22 | `validateRule` — per-type coercion mirror of the server's `resolve-leaf` | `packages/query-builder/admin/src/lib/utils/validateRule.ts:51-119` | ✅ E2E |
| F23 | `treeHasInvalidRules` — the Apply gate, treats an unresolvable field as invalid | `packages/query-builder/admin/src/lib/utils/validateRule.ts:126-145` | ✅ E2E |
| F24 | `countRules` — recursive leaf count for the "N conditions" badge | `packages/query-builder/admin/src/lib/utils/countRules.ts:15-23` | ✅ E2E |
| F25 | `treeOps` — `newGroup`, `newRule`, `addChild`, `addRuleTo`, `addGroupTo`, `removeNode`, `updateRule`, `updateCombinator` | `packages/query-builder/admin/src/lib/utils/treeOps.ts:17-117` | ⚠️ PARTIAL |
| F26 | `dateInput` — ISO ⇄ `datetime-local` in the viewer's timezone | `packages/query-builder/admin/src/lib/utils/dateInput.ts:17-36` | ❌ NONE |
| F27 | `QueryBuilderDrawer` — owns open state, staged draft, JSON preview, Apply/Reset; auto-wires `portalContainer` | `packages/query-builder/admin/src/lib/components/QueryBuilderDrawer/index.tsx:77-176` | ✅ E2E |
| F28 | `QueryBuilderPanel` — inline accordion, height animation, `role="region"`, Esc collapse, internal scroll cap, focus into the first field cell | `packages/query-builder/admin/src/lib/components/QueryBuilderPanel/index.tsx:93-250` | ✅ E2E |
| F29 | Panel's `fieldsPending` / `fieldsError` / `onRetryFields` states; Apply disabled, Reset stays enabled | `packages/query-builder/admin/src/lib/components/QueryBuilderPanel/index.tsx:142, 185-204, 231-244` | ✅ E2E |
| F30 | Draft sync on open; close-without-Apply discards | `packages/query-builder/admin/src/lib/components/QueryBuilderPanel/index.tsx:115-121`; `QueryBuilderDrawer/index.tsx:100-105` | ⚠️ PARTIAL |
| F31 | Errors surface only after a failed Apply, then fade as the draft becomes valid | `packages/query-builder/admin/src/lib/components/QueryBuilderPanel/index.tsx:123-127`; `QueryBuilderDrawer/index.tsx:109-113` | ✅ E2E |
| F32 | `QueryBuilderSummary` — one removable chip per condition + Clear all; flattens nested structure | `packages/query-builder/admin/src/lib/components/QueryBuilderSummary/index.tsx:75-146` | ✅ E2E |
| F33 | `JsonPreview` — collapsible live wire payload + copy | `packages/query-builder/admin/src/lib/components/QueryBuilderDrawer/JsonPreview/index.tsx:31-97` | ❌ NONE |

---

## 3. Manual Test Plan

Unless stated, work on the **content records** surface —
`/workspaces/:id/content/article` in the relations seed — because it is the only
consumer with relations, a fetched `fields` list, and the record picker.
Open the panel with the toolbar's **Filters** button.

### F1 / F2 — the builder and a group

**Preconditions:** signed in; a collection with at least one string field.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click **Filters** | The panel expands (height animation, ~150ms) and shows an AND/OR segmented control, no rules, and **Add rule** / **Add group** |
| 2 | Click **Add rule** | One row appears: a field cell showing the first field, an operator Select showing that type's first operator, and a value control |
| 3 | Click the **OR** segment | `aria-checked` moves to OR; the group's combinator changes |
| 4 | Click the already-active **AND** segment | Nothing changes — Radix emits `''` and `GroupNode` guards it (`GroupNode/index.tsx:83-87`) |
| 5 | Add a second rule and click the first row's **Remove rule** (`×`) | The row disappears; the "N conditions" readout drops to 1 |
| 6 | Mount `QueryBuilder` with `fields=[]` and click **Add rule** | Nothing happens — `onAddRule` bails when `fields[0]` is undefined (`QueryBuilder/index.tsx:80-83`). The button stays enabled and silently does nothing |

**Keyboard-only path:** `Tab` to **Filters**, `Enter`. Focus is moved into the
first rule's field combobox by the panel (`QueryBuilderPanel/index.tsx:133-138`);
with no rules yet, focus stays on the toggle. `Tab` reaches AND → OR (one stop —
roving tabindex) → **Add rule** → **Add group** → Reset → Apply. Arrow keys move
between AND and OR without committing; `Enter` commits.
**Screen-reader expectation:** entering the panel announces "Filters, region"
(named by the toggle via `aria-labelledby`). The combinator announces
"Combinator, AND, radio button, 1 of 2, selected".

### F4 / F5 / F6 / F9 — a rule's three cells

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Add a rule; open the field picker | A popover with a search box, a **Fields** group, then a collapsed **Relations** group |
| 2 | Pick a `date` field | The operator Select **resets** to `greater than` (the first entry in `OPS_FOR_TYPE.date`, `operators.ts:42-51`) and the value becomes an empty `datetime-local` input |
| 3 | Note the absence of `equals` for dates | Deliberate — a minute-precision editor against a millisecond `timestamptz` would never match (`operators.ts:37-41`) |
| 4 | Change the operator to `between` | Two inputs appear joined by "and", seeded `{from:'', to:''}` (`defaultValueForOp.ts:21-22`) |
| 5 | Change it to `within the last` | A number input (seeded `7`) and a unit Select (seeded `days`) |
| 6 | Change it to `is empty` | The value cell **disappears entirely** (`RuleRow/index.tsx:165-167`) |
| 7 | Switch the field from a `date` to a `string` | The operator resets to `equals` and the value resets to `''` — no stale `{from,to}` survives |
| 8 | Switch a `boolean` field's operator | Only `equals` is offered (`operators.ts:28`) — there is no way to ask "is this nullable boolean null" |

**Keyboard-only path:** `Tab` reaches the field cell (`role="combobox"`),
`Enter`/`Space` opens the picker, arrows move the highlight, `Enter` selects,
`Esc` closes. `Tab` then reaches the operator Select, then the value control,
then the row's **Remove rule** button.
**Screen-reader expectation:** the field cell announces the selected path as its
accessible name ("Author · Name"); the operator Select announces "Operator,
equals, combo box". **Changing the field silently replaces the operator and the
value editor** — see `♿ A11Y-query-builder-admin-03`.

### F7 — an unknown field

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Apply a filter on `author.name`, copy the URL | `?filter={"and":[{"field":"author.name","op":"eq","value":"Ada"}]}` |
| 2 | Hand-edit the URL to `"field":"author.nonesuch"` and load it | The rule row still renders (the field cell is present so you can re-pick), and a red line reads **"This field is no longer available — pick another one"** — shown **regardless** of `showErrors` (`RuleRow/index.tsx:122-126`) |
| 3 | Press **Apply** | Nothing commits — `treeHasInvalidRules` returns `true` for an unresolvable field (`validateRule.ts:140-141`), and the error stays |
| 4 | Re-pick a real field | The error clears immediately (the `showErrors` fade effect, `QueryBuilderPanel/index.tsx:123-127`) |
| 5 | Confirm there is **no** `?? fields[0]` substitution | The operator list is empty and the value editor is absent while the field is unknown (`RuleRow/index.tsx:118, 154, 165`) — the row cannot look valid while being invalid |

**Keyboard-only path:** the error `<p role="alert">` is not focusable; the field
cell remains reachable so the rule is repairable.
**Screen-reader expectation:** because the alert is present **at mount** rather
than inserted later, `role="alert"` does not fire — the message is read only if
the user navigates to it. See `♿ A11Y-query-builder-admin-02`.

### F8 — the field picker

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the picker on a collection with a relation | Idle: **Fields** (the collection's own scalars) first, then **Relations** (collapsed) |
| 2 | Press `Enter`/click on the **Author** relation row | It expands, revealing "Author fields" and its own nested relations |
| 3 | Type `Author Name` | The list flattens into one searchable set; token-AND over breadcrumb + leaf + path. Asserted at `apps/admin-e2e/src/content/records-filter.spec.ts:56-66` |
| 4 | Inspect the roles | The trigger is `role="combobox"`; every navigable row is `role="option"`; a relation row carries `aria-expanded` instead of a value; group headings are `role="presentation"` |
| 5 | Inspect focus while arrowing | Focus stays in the search box, which owns `aria-controls` and a live `aria-activedescendant`; rows are `tabIndex={-1}` |
| 6 | Select the relation's own `id` field | The value editor becomes the injected record picker, not a uuid text box. Asserted at `records-filter.spec.ts:119-144` |
| 7 | Open the picker from inside the **drawer** (Members) and use the mouse wheel over the list | It scrolls — the popover is portaled into the drawer element (`QueryBuilderDrawer/index.tsx:135, 159`), inside react-remove-scroll's allow-list |

**Keyboard-only path:** exactly step 5 — this picker is the one control in the
repo that documents the pattern in full
(`packages/query-builder/admin/AGENTS.md:106-117`).
**Screen-reader expectation:** "Field, combo box, expanded"; arrowing announces
each option's leaf label plus its position. The type tag on each row is
`aria-hidden` on purpose.

### F10 / F11 / F12 — the value editors

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `string` + `equals` | A plain text input, `aria-label` "Value" |
| 2 | `number` + `equals`, type `abc` | `type="number"` rejects the characters; the model gets `''` and Apply reports "Value required" |
| 3 | `number` + `equals`, type `1e5` | Accepted — `Number.isFinite(Number('1e5'))` is true (`validateRule.ts:161-162`). The server receives the string `"1e5"` |
| 4 | `uuid` + `equals`, type `not-a-uuid` and Apply | "Must be a valid UUID". The regex is the **canonical** 8-4-4-4-12 form, deliberately stricter than the server's (`validateRule.ts:147-155`) |
| 5 | `enum` + `equals` | A Select constrained to the declared members |
| 6 | `enum` + `is one of` | A bordered checkbox group (`EnumMultiSelect`), so an invalid member cannot be typed |
| 7 | `string` + `is one of`, type `a,,b, c ` then blur | The model is `['a','b','c']` — parsed live on every keystroke, normalised to `a,b,c` on blur (`CsvValueInput/index.tsx:54-62, 78-83`) |
| 8 | Type only `,` | The model is `[]`; Apply reports "Add at least one value" |
| 9 | `boolean` + `equals` | A Select offering only `true`/`false` |
| 10 | `date` + `greater than` | A `datetime-local` input; the stored value is a full ISO instant (`dateInput.ts:17-36`) |
| 11 | `date` + `between` | Two `datetime-local` inputs labelled "From" and "To" |
| 12 | `date` + `within the last`, clear the number field | **Suspected defect:** it snaps to `1` rather than staying empty — `Math.max(1, Number('') || 1)` (`ValueEditor/index.tsx:199`). You cannot backspace to retype |
| 13 | `date` + `within the last`, type `99999999999` | **Suspected defect:** the panel crashes — see `🐞 BUG-query-builder-admin-01` |
| 14 | A relation `id` field + `is one of` | The injected picker stays open across picks; `Esc` closes it. Asserted at `records-filter.spec.ts:146-172` |

**Keyboard-only path:** every editor is reachable by `Tab` in DOM order (from,
to; amount, unit). The enum checkbox group is a `role="group"` of native
checkboxes, so `Tab` visits **each** checkbox — correct for a multi-select,
though verbose with many members.
**Screen-reader expectation:** every control carries an explicit `aria-label`
("Value", "From", "To", "Amount", "Unit") because there is no visible label —
which satisfies `3.3.2` but means the field name is **not** part of any control's
accessible name. See `♿ A11Y-query-builder-admin-01`.

### F14 / F15 / F16 / F17 / F18 — serialisation

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `author.name equals Ada`, Apply | `?filter={"and":[{"field":"author.name","op":"eq","value":"Ada"}]}`. Asserted at `records-filter.spec.ts:86-93` |
| 2 | `contains Ada` | `{"field":"author.name","op":"ilike","value":"%Ada%"}`. Asserted at `records-filter.spec.ts:112-116` |
| 3 | `does not contain Ada` | `op:"nilike"`. Asserted at `records-filter.spec.ts:200-204` |
| 4 | `contains 50%` | The `%` is escaped before wrapping: `"%50\\%%"` (`treeToJsonFilter.ts:149-152`) |
| 5 | `is not empty` | `{"op":"null","value":false}`. Asserted at `records-filter.spec.ts:226-230` |
| 6 | `is one of` with two relation ids | `op:"in"` with the array intact. Asserted at `records-filter.spec.ts:167-171` |
| 7 | `between 2026-01-01T00:00 and 2026-02-01T00:00` | An **AND sub-group**: `{"and":[{op:"gte",…},{op:"lte",…}]}` nested inside the root's `and` |
| 8 | `within the last 7 days`, Apply, then read the URL | An absolute ISO `gte` cutoff — the relative window is resolved at Apply time (`treeToJsonFilter.ts:123-129`) |
| 9 | Add a rule but leave its value empty, then Apply with another valid rule | Blocked — the Apply gate rejects the incomplete rule before the serialiser's pruning ever runs |
| 10 | Add an empty sub-group and Apply | The group is pruned at serialise time (`treeToJsonFilter.ts:72-76`), so the server never sees `{or:[]}` |
| 11 | Remove the last rule and Apply | The URL param is dropped entirely — `hasRules` is false so `onApply(null)` (`QueryBuilderPanel/index.tsx:150-151`) |

**Keyboard-only path:** `Tab` to Apply, `Enter`. **Screen-reader expectation:**
the panel stays open after Apply and nothing announces that the table refetched —
see `♿ A11Y-query-builder-admin-04`.

### F19 / F20 / F21 — deserialisation and round-trip

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Load a URL with a valid `filter` param | The panel opens pre-populated. Asserted at `apps/admin-e2e/src/activity/activity-filter.spec.ts:77` and `users/members-filter.spec.ts:67` |
| 2 | Load `?filter=not-json` | `jsonFilterToTree` returns `null`; the page renders unfiltered rather than crashing (`jsonFilterToTree.ts:32-37`) |
| 3 | Load `?filter={"field":"name","op":"eq","value":"x"}` (a bare rule, no root group) | Wrapped in an AND root (`jsonFilterToTree.ts:41-48`) |
| 4 | Round-trip `contains 50%_x` | Serialised `"%50\\%\\_x%"`, parsed back to `50%_x` (`jsonFilterToTree.ts:116-129`) |
| 5 | Round-trip a `between` | Serialised as `{and:[gte,lte]}`, rehydrated as **one** Between rule (`jsonFilterToTree.ts:78-81`) so the compound editor returns and the "N conditions" badge says 1, not 2 |
| 6 | Hand-build `created gte X` AND `created lte Y` as two separate rules and reload | **Documented lossy behaviour:** they fold into one Between rule (`jsonFilterToTree.ts:71-77`). The WHERE clause is identical; only the editor differs |
| 7 | Round-trip `within the last 7 days` | It comes back as an absolute `greater than or equal to <ISO>` rule — one-way by design (`wireOp.ts:45-53`). The **summary chip's text changes** after a reload, which reads as a bug to a user |
| 8 | Load `?filter={"and":[]}` | `walk` returns `null` for an empty child list, so the whole filter is dropped |
| 9 | Load `?filter={"and":[…],"or":[…]}` | `and` wins (`jsonFilterToTree.ts:59-60`); the `or` branch is silently discarded |
| 10 | Load `?filter=[1,2,3]` | `null` — arrays are rejected at the top of `walk` (`jsonFilterToTree.ts:55`) |

**Keyboard-only path / Screen-reader expectation:** N/A (pure functions).

### F22 / F23 — the Apply gate

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Add a rule, leave the value empty, click **Apply** | Nothing commits; a red "Value required" appears under the row; `showErrors` flips on (`QueryBuilderPanel/index.tsx:145-148`) |
| 2 | Fill the value | The error clears without a second Apply (`QueryBuilderPanel/index.tsx:123-127`) |
| 3 | `uuid` + `is one of` with `abc,def` | Blocked with "Must be a valid UUID" — every item is validated, not just presence (`validateRule.ts:91-104`). Asserted at `apps/admin-e2e/src/activity/activity-filter.spec.ts:95` |
| 4 | `between` with only a `from` | "Both bounds required" |
| 5 | `between` with `from` after `to` | **Accepted.** `validateRule` checks each bound's *type*, never their order (`validateRule.ts:57-70`); the server returns zero rows for an inverted range |
| 6 | `within the last` with `0` | "Enter a positive count" (`validateRule.ts:77-79`) |
| 7 | Hand-edit the URL to `{"field":"createdAt","op":"ilike","value":"%2020%"}` | **Suspected defect:** the gate passes it and Apply commits an `ilike` against a `timestamptz`. See `🐞 BUG-query-builder-admin-02` |
| 8 | Hand-edit to `{"field":"published","op":"eq","value":"yes"}` on a boolean field | **Suspected defect:** accepted — the boolean branch of the scalar check falls through without returning a code (`validateRule.ts:111-117`). See `🐞 BUG-query-builder-admin-03` |

**Keyboard-only path:** the Apply button is reachable; when Apply is refused, focus
stays on Apply and nothing points at the offending row.
**Screen-reader expectation:** the errors are inserted as `role="alert"` nodes, so
they *do* announce on a failed Apply — but with several invalid rows, several
alerts fire at once and none of them names its rule. See
`♿ A11Y-query-builder-admin-02`.

### F24 — the condition count

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Add three rules, two of them inside a sub-group | The readout says "3 conditions" — `countRules` recurses (`countRules.ts:20-23`) |
| 2 | Add an empty sub-group | The count does not change |
| 3 | Collapse the panel | The toolbar's trigger shows the same count. Asserted at `apps/admin-e2e/src/activity/activity-filter.spec.ts:63` and `users/members-filter.spec.ts:54` |
| 4 | Apply a `between` and reload | Still 1 — the pair folds back into one rule (F20) |

### F25 / F26 — tree ops and date conversion

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Remove the only rule from a sub-group | The **empty group stays** in the tree (`treeOps.removeNode:78-83` only removes the named node). It renders as an empty bordered box with its own Add buttons |
| 2 | Apply with that empty group present | It is pruned from the wire payload; the user still sees the box |
| 3 | Pick `2026-03-29T02:30` on a `date` field in `Europe/Berlin` | **Suspected defect:** that local time does not exist (DST). `new Date('2026-03-29T02:30')` resolves forward and the field redisplays `03:30`. See `🐞 BUG-query-builder-admin-06` |
| 4 | Round-trip an instant carrying seconds | The seconds are lost — `isoToLocalInput` slices to minute precision (`dateInput.ts:25`) |

### F27 / F28 / F29 / F30 / F31 — the two host shells

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Members: click the filter button | A right-side drawer opens with a title, a description, the builder, the JSON preview and an Apply/Reset footer. Asserted at `apps/admin-e2e/src/users/members-filter.spec.ts:18` |
| 2 | Drawer: click **Apply** | The drawer **closes** and the URL updates (`QueryBuilderDrawer/index.tsx:120-122`) |
| 3 | Panel: click **Apply** | The panel **stays open** (`QueryBuilderPanel/index.tsx:152-154`) — deliberate, so you can keep editing |
| 4 | Panel: press `Esc` | It collapses (`QueryBuilderPanel/index.tsx:162-168`), but only if no popover swallowed the key first |
| 5 | Panel: press `Esc` with the field picker open | The picker closes; the panel stays — `event.defaultPrevented` is checked |
| 6 | Open the panel, edit a rule, close without Apply, reopen | The draft is discarded and re-synced from the applied filter (`QueryBuilderPanel/index.tsx:115-121`) |
| 7 | Panel: Apply, then watch the rows | **Suspected defect:** the URL changes → `value` is re-parsed with **fresh ids** → the sync effect replaces the draft → every rule row remounts and focus is lost. See `🐞 BUG-query-builder-admin-05` |
| 8 | Content records with `/filter-fields` returning 500 | An `Alert` with "Couldn't load the filterable fields", a **Try again** button, and Apply **disabled**. Asserted at `records-filter.spec.ts:299-309` |
| 9 | In that state, click **Reset** | It still works — Reset is never disabled (`QueryBuilderPanel/index.tsx:231-237`), because clearing an applied filter needs no definitions |
| 10 | While `/filter-fields` is pending | A spinner + "Loading filterable fields…" in place of the builder (`QueryBuilderPanel/index.tsx:205-209`) — a **third** state, distinct from error and from "no filterable fields" |
| 11 | Cap: add 15 rules | The rules list scrolls internally at `max-h-[22rem]` (`QueryBuilderPanel/index.tsx:211`) so the table is never pushed off screen |
| 12 | Enable "Reduce motion" and toggle the panel | The height transition is disabled (`motion-reduce:transition-none`, `QueryBuilderPanel/index.tsx:173`) |

**Keyboard-only path:** panel — `Enter` on the toggle moves focus into the first
field cell; `Esc` collapses. **The collapse leaves focus inside an `inert`
section** (`QueryBuilderPanel/index.tsx:182`) — see
`♿ A11Y-query-builder-admin-05`. Drawer — vaul restores focus to the trigger on
close.
**Screen-reader expectation:** the panel is `role="region"` named by the toggle
via `aria-labelledby`; if the consumer omits `labelledBy` the region is unnamed.

### F32 — the applied-filter summary

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Apply `author.name equals Ada`, collapse the panel | A chip reads "Author · Name equals Ada". Asserted at `records-filter.spec.ts:257-268` |
| 2 | Click the chip's `×` | The narrowed tree re-commits at once; with no conditions left the URL param is dropped. Asserted at `records-filter.spec.ts:270-280` |
| 3 | Click **Clear all** | Every condition goes. Asserted at `records-filter.spec.ts:282-290` |
| 4 | Apply two rules inside an OR group, then read the chips | The nesting is **flattened** — two chips with no indication they were OR-ed. Removing one silently changes the semantics of the remaining filter |
| 5 | Read a chip's `aria-label` | "Remove condition Author · Name equals" — genuinely unique per condition (`QueryBuilderSummary/index.tsx:378-380` in the file's `messages.remove` template) |
| 6 | Remove a chip with the keyboard | **Suspected defect:** the button unmounts and focus falls to `<body>`. See `♿ A11Y-query-builder-admin-05` |
| 7 | Apply a filter on a field the schema no longer offers, then collapse | The chip falls back to the raw `fieldId` (`QueryBuilderSummary/index.tsx:349-351`) — readable, if unlovely |

### F33 — the JSON preview

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click **JSON PREVIEW** | It expands to a `<pre>` of the pretty-printed wire node |
| 2 | Edit a rule | The preview updates live |
| 3 | With no complete rules | "No conditions yet — add a rule to see the wire payload." |
| 4 | Click **Copy** | The JSON goes to the clipboard and the button flips to "Copied" for 1.5s |
| 5 | Click **Copy** over plain HTTP or with clipboard permission denied | **Suspected defect:** `navigator.clipboard.writeText` is unawaited-unguarded (`JsonPreview/index.tsx:42-47`) — an unhandled promise rejection and no user feedback |
| 6 | Add a `within the last` rule and watch the preview while typing in *another* rule | The cutoff timestamp changes on every keystroke — the `useMemo(() => new Date(), [tree])` (`JsonPreview/index.tsx:37`) does not pin anything, because `tree` is a new object on every edit. See `🐞 BUG-query-builder-admin-07` |
| 7 | Inspect the toggle | `aria-expanded` is set but there is no `aria-controls` pointing at the `<pre>` |

---

## 4. Edge Cases & Negative Paths

**Empty / zero / null**

- **EC-01 — `value=null` tree passed to `QueryBuilder`.** `✅` A memoised empty
  group is substituted so a fresh id is not minted on every render
  (`QueryBuilder/index.tsx:72-77`) — a real bug the code already guards against.
- **EC-02 — `fields=[]`.** `⚠️ PARTIAL` Add rule is a no-op; the panel renders an
  empty builder. The consumer is expected to pass `fieldsPending`/`fieldsError`
  instead, but "the type genuinely has no filterable fields" renders identically
  to "nothing loaded", with no message.
- **EC-03 — `enumValues` missing on an `enum` field.** `❌ NONE` `ValueEditor`
  falls through to the CSV/text editor (`ValueEditor/index.tsx:230`), so a
  constrained field silently becomes free-text.
- **EC-04 — Empty string as a scalar value.** `✅` `isRuleComplete` drops it from
  the wire (`isRuleComplete.ts:40-41`) and `validateRule` reports
  `ValueRequired` (`validateRule.ts:108-110`).
- **EC-05 — `is one of` with `['']`.** `❌ NONE` `CsvValueInput.parse` filters
  empties, so it is unreachable from the UI — but a hand-edited URL delivers it,
  and `validateRule` accepts it for a string field (`isScalarValid` returns
  `true` for `String`), so `in ('')` reaches the server.
- **EC-06 — A group whose every child is an empty group.** `✅` Recursively pruned
  (`treeToJsonFilter.ts:72-76`).

**Boundary**

- **EC-07 — `within_last` with `n` at the DST boundary.** `❌ NONE` The cutoff is
  computed in pure milliseconds (`treeToJsonFilter.ts:154-162`), so "last 7 days"
  is a rolling 168 hours, not 7 calendar days. Across a DST change the window is
  167 or 169 wall-clock hours. Defensible, but undocumented and invisible.
- **EC-08 — `within_last` with a huge `n`.** `❌ NONE` → `🐞 BUG-query-builder-admin-01`.
- **EC-09 — `within_last` with `n = 1` and unit `minutes`.** `✅` Valid; cutoff is
  60s ago.
- **EC-10 — Nesting depth 20.** `❌ NONE` The FE has no limit
  (`QueryBuilder/index.tsx:60-62` says so explicitly); the server caps via
  `maxGroupDepth`. So a user can build a tree the server will reject, and the
  Apply gate will not catch it — the failure arrives as a 400 after commit.
- **EC-11 — 500 rules.** `❌ NONE` No cap. `treeHasInvalidRules` walks the whole
  tree on **every keystroke** (it runs in an effect keyed on `draft`,
  `QueryBuilderPanel/index.tsx:123-127`), so editing gets quadratic-ish. Perf only.
- **EC-12 — A URL `filter` param of 100 KB.** `❌ NONE` Parsed without a size
  guard; the browser's own URL limit bites first.

**Size & encoding**

- **EC-13 — A value containing `%` and `_`.** `✅ E2E`-adjacent: escaping is
  asserted for the wrapper (`records-filter.spec.ts:112-116`) but **not** for a
  value that itself contains a metacharacter. The round-trip
  (escape → `%…%` → strip → unescape) is correct by inspection
  (`treeToJsonFilter.ts:149-152` ↔ `jsonFilterToTree.ts:116-129`) but untested.
- **EC-14 — A value ending in a single backslash.** `❌ NONE` `a\` → `a\\` →
  `%a\\%` → strip → `a\\` → unescape → `a\`. Correct by inspection.
- **EC-15 — Emoji / RTL / combining marks in a value.** `❌ NONE` Passed through
  verbatim; `JSON.stringify` handles the encoding.
- **EC-16 — `<script>alert(1)</script>` as a value.** `❌ NONE` React escapes it in
  the chip and in the `<pre>` preview. It reaches the wire as a plain string; the
  server parameterises. No injection path in this unit.
- **EC-17 — 🔒 A hand-crafted `field` naming a column the UI never offers.**
  `❌ NONE` `jsonFilterToTree` accepts **any** string as `field`
  (`jsonFilterToTree.ts:89-101`) with no whitelist check. `treeHasInvalidRules`
  then rejects it as `UnknownField` and Apply is blocked — but only because it is
  not in `fields`. If a consumer ever bypassed the Apply gate (e.g. applied the
  parsed tree directly on load), an arbitrary `field` would go to the server.
  **The server's `FilterSchema` whitelist is the real boundary and it is
  intact** — this is a defence-in-depth note, not a defect.
- **EC-18 — A `field` with 500 dotted segments.** `❌ NONE` Accepted client-side;
  the server's relation-cycle guard handles it.

**Permission matrix**

- **EC-19 — Not applicable.** This unit has no permission awareness at all. The
  consumer decides whether to render the filter UI; the server decides what a
  filter may reach. Explicitly checked: no `useHasPermission`, no auth import
  anywhere in `packages/query-builder/admin/src`.

**Tenant isolation**

- **EC-20 — Not applicable directly**, with one note: the injected
  `renderRelationValue` picker is the only thing that fetches, and it is supplied
  by `content-admin`. Whether it lists records from another workspace is that
  package's concern.

**Concurrency**

- **EC-21 — Apply twice quickly.** `❌ NONE` The panel's Apply is idempotent (it
  writes the same URL); the drawer closes on the first, so the second cannot fire.
- **EC-22 — Editing while the fields list refetches.** `❌ NONE` `fields` changing
  identity re-runs the `showErrors` effect and re-validates, but the **draft is
  not re-synced**, so a rule whose field vanished from the new list becomes
  `UnknownField` mid-edit with no explanation beyond the inline message.
- **EC-23 — Two `QueryBuilderPanel`s on one page.** `❌ NONE` Each owns its own
  draft; the shared `PortalContainerContext` is per-`QueryBuilder`. Fine.

**State after mutation**

- **EC-24 — Filters surviving pagination.** `⚠️ PARTIAL` The tree lives in the URL
  and pagination is a separate param, so the filter survives — but **the page is
  not reset to 1 on Apply by this unit**; that is the consumer's job. Applying a
  narrowing filter while on page 4 of 5 can land on an empty page. This is
  BUGBOT's "stale page after mutation" pattern
  (`.cursor/BUGBOT.md:31-34`) and it is invisible from inside this package.
- **EC-25 — Filters surviving a refetch.** `✅` URL-driven, so yes.
- **EC-26 — URL-state vs component-state divergence.** `⚠️ PARTIAL` The draft is a
  *copy* that is re-synced only on open (drawer) or on open **and on any `value`
  change** (panel). Because the panel stays open after Apply, the second path
  fires — see `🐞 BUG-query-builder-admin-05`.
- **EC-27 — Browser Back after Apply.** `❌ NONE` The URL changes, so Back restores
  the previous filter — but the panel's sync effect only fires when `open`, so a
  Back while the panel is **closed** leaves the draft stale until it is reopened.
  Harmless because reopening re-syncs.

**Failure & partiality**

- **EC-28 — `/filter-fields` 500.** `✅ E2E` (`records-filter.spec.ts:299-309`).
- **EC-29 — `/filter-fields` pending forever.** `⚠️ PARTIAL` The loading branch
  renders; Apply is disabled; Reset works. No timeout.
- **EC-30 — The injected relation picker throws.** `❌ NONE` No boundary — it takes
  the whole panel down, and on the content records page that is the whole view.
- **EC-31 — `treeToJsonNode` throws inside `JsonPreview`.** `❌ NONE`
  → `🐞 BUG-query-builder-admin-01`. This is the path that makes the crash
  reachable *while typing*, not only on Apply.

**Idempotency & replay**

- **EC-32 — Applying the identical filter twice.** `✅` Same URL, no-op.
- **EC-33 — Reloading a `within_last` deep link.** `⚠️ PARTIAL` Deliberately pinned
  to the original instant (`treeToJsonFilter.ts:31-33`), so the link is stable —
  but the UI now says `greater than or equal to <date>` instead of
  `within the last 7 days`.

**UI-specific**

- **EC-34 — Loading / error / empty are three distinct states in the panel.** `✅`
  `fieldsError` → `Alert`; `fieldsPending` → spinner + text; neither → the
  builder. This is the one place in the repo where the ladder is explicit outside
  `insights-admin`, and `AGENTS.md:44-47` explains why it is required rather than
  polish.
- **EC-35 — Every branch has an i18n message.** `✅` Verified by reading all five
  `defineMessages` blocks — panel, drawer, group, row (+ 9 error codes),
  value editor, summary, preview, operator labels. **No hard-coded user-facing
  string exists in this package.** The only English literals are default
  parameter values in `CsvValueInput` (`placeholder = 'value1,value2'`,
  `CsvValueInput/index.tsx:33`), and every call site passes a localized one.

---

### 4A. Accessibility & Section 508 Conformance

**Standards tested against:** WCAG 2.1 AA, with the Revised Section 508 provision
cited alongside (E205.4 incorporates WCAG 2.0 A+AA for content; 502.2/502.3 cover
AT interoperability; 503.2 covers platform preferences; 504.2 applies because
this is authoring-tool UI).

**Why axe is not enough here.** This is the hardest surface in the repo for
accessibility precisely because everything axe *can* check is already right —
roles, names, `aria-activedescendant`, `aria-invalid`, `aria-describedby` — while
everything it *cannot* check is where the problems are: what happens to focus
when a row is removed, whether an added row is announced, whether the operator
Select silently changing meaning is a change of context, and whether five
identically-named "Remove rule" buttons are usable. Two suites do scan this
surface with the panel **open and holding a rule**
(`apps/admin-e2e/src/activity/activity-filter.spec.ts:122`,
`apps/admin-e2e/src/users/members-filter.spec.ts:81`) — which is more than most
units get — and they pass. That proves nothing about the findings below.

#### ♿ A11Y-query-builder-admin-01 — Every rule row's controls carry identical generic names; the field being filtered is in none of them

**WCAG:** `2.4.6 Headings and Labels (AA)`, `4.1.2 Name, Role, Value (A)`, `1.3.1 Info and Relationships (A)` · **508:** `E205.4 / 502.3.1 (Object Information), 502.3.9 (Modification of Text)` · **Verdict: Does Not Support**

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/index.tsx:180-189` (remove button); `.../OperatorPicker/index.tsx:31` (`aria-label` "Operator"); `.../ValueEditor/index.tsx:161, 177, 202, 214, 240, 253, 279, 295, 326` (`aria-label` "Value" / "From" / "To" / "Amount" / "Unit"); `.../GroupNode/index.tsx:88, 102, 148, 157`

With three rules on screen a screen-reader user's forms list reads:

```
Field, combo box            Field, combo box            Field, combo box
Operator, combo box         Operator, combo box         Operator, combo box
Value, edit text            Value, edit text            Value, edit text
Remove rule, button         Remove rule, button         Remove rule, button
```

Nothing distinguishes row 2 from row 3. The same applies to nested groups:
every group offers an identical "Add rule", "Add group", "Remove group" and
"Combinator". The one place this is done **correctly** is
`QueryBuilderSummary`, whose remove buttons are
`Remove condition {path} {op}` (`QueryBuilderSummary/index.tsx:17-20, 126-128`) —
so the pattern exists in the package and was simply not applied to the builder.

**Keyboard-only user:** can operate everything, but cannot tell from the focus
ring alone which row they are in once the rows scroll inside the
`max-h-[22rem]` container.
**Screen-reader user:** must read the whole row's contents to identify it, and
after activating one of five "Remove rule" buttons has no way to confirm which
one went.
**Remediation:** compose the row's accessible names from the resolved field label
— "Remove condition: Author · Name", "Operator for Author · Name" — using the
`path` string `QueryBuilderSummary` already builds. Give each `GroupNode` an
index-based name ("Group 2 combinator").

#### ♿ A11Y-query-builder-admin-02 — Adding and removing rules is not announced, and the validation alerts do not name their rule

**WCAG:** `4.1.3 Status Messages (AA)`, `3.3.1 Error Identification (A)`, `3.3.3 Error Suggestion (AA)` · **508:** `E205.4 / 502.3.14 (Event Notification)` · **Verdict: Partially Supports**

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/index.tsx:111-138` (the child list); `.../RuleRow/index.tsx:191-200` (the error `<p role="alert">`)

Three distinct problems:

1. **Insertion is silent.** Pressing "Add rule" appends a row to a plain `<div>`
   with no live region. A screen-reader user hears nothing and must go hunting.
   The condition count ("3 conditions", `QueryBuilderPanel/index.tsx:225-228`)
   updates but is not a live region either.
2. **Removal is silent**, and focus is destroyed (see
   `♿ A11Y-query-builder-admin-05`).
3. **The error alerts are unnamed and can fire in a burst.** Each invalid row
   renders `<p role="alert" id={useId()}>` with a bare message like "Value
   required". Pressing Apply with three invalid rows inserts three assertive
   alerts simultaneously — screen readers coalesce or drop them, and none says
   *which* rule it belongs to. `3.3.1` requires the item in error to be
   identified.

    One subtlety in the other direction: the `UnknownField` alert renders
    **at mount** (`RuleRow/index.tsx:122-124`), and a `role="alert"` that is
    present when the region is first rendered does not fire at all. So the one
    error the user did not cause is also the one they are least likely to hear.

**Keyboard-only user:** the count readout is visible, so add/remove is
observable; the errors are visible under their rows.
**Screen-reader user:** as described.
**Remediation:** add a polite live region announcing "Condition 3 added" /
"Condition 2 removed, 2 conditions remain"; prefix each error with the rule's
field path; and on a failed Apply move focus to the first invalid row rather than
relying on the alert burst.

#### ♿ A11Y-query-builder-admin-03 — Changing the field silently swaps the operator and replaces the value editor

**WCAG:** `3.2.2 On Input (A)`, `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3.14` · **Verdict: Partially Supports**

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/index.tsx:140-151, 159-161`

Selecting a field runs
`onUpdate({ fieldId, op: OPS_FOR_TYPE[nextField.type][0], value: defaultValueForOp(nextOp) })`.
Switching from a `string` field to a `date` field therefore replaces the operator
(`equals` → `greater than`) *and* swaps the value control from a text input to a
`datetime-local` input — two changes of context the user did not request, neither
announced.

This is the right *behaviour* — the alternative is a rule in an invalid
op-for-type state, which is the hole `🐞 BUG-query-builder-admin-02` describes.
`3.2.2` is not violated by the change itself (the user did initiate an input);
it is violated by doing it without warning or announcement.

**Keyboard-only user:** after picking a field, focus returns to the field cell,
so the changed controls are two `Tab`s away and visible. Low impact.
**Screen-reader user:** hears the field selection confirmed and nothing else; the
next `Tab` lands on an operator with a different value than before.
**Remediation:** announce the reset in the same live region as
`♿ A11Y-query-builder-admin-02` — "Operator reset to greater than", or document
the behaviour in the panel's description text.

#### ♿ A11Y-query-builder-admin-04 — Applying a filter does not announce that the results changed

**WCAG:** `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3.14` · **Verdict: Does Not Support (at the boundary)**

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilderPanel/index.tsx:144-155`; `onApplied` hook at `:57`

`apply()` calls `onApply(next)` and `onApplied?.()`, and the panel deliberately
stays open. The table behind it refetches and its row count changes, with no
announcement from either side. The `onApplied` callback exists precisely so the
consumer can toast — but nothing in this package requires it, and whether the
consumers use it for an *announcement* rather than a visual toast is outside this
unit.

**Keyboard-only user:** must scroll past the panel to see the new results.
**Screen-reader user:** presses Apply and hears nothing at all.
**Remediation:** document `onApplied` as an accessibility obligation, or have the
panel itself render a polite live region reporting the new condition count and
prompting the consumer to report the row count.

#### ♿ A11Y-query-builder-admin-05 — Focus is destroyed when a rule or chip is removed and when the panel collapses

**WCAG:** `2.4.3 Focus Order (A)` · **508:** `E205.4 / 502.3.12 (Focus Cursor)` · **Verdict: Does Not Support**

**Location:** `.../RuleRow/index.tsx:180-189`; `.../QueryBuilderSummary/index.tsx:124-133`; `.../QueryBuilderPanel/index.tsx:162-168, 182`

Three instances of the same defect:

1. **Remove rule.** The focused button unmounts with its row. Focus falls to
   `<body>`; the next `Tab` restarts at the top of the document.
2. **Remove chip.** Identical — `remove(rule.id)` re-commits a tree without that
   rule, unmounting the button that was activated.
3. **Esc collapses the panel.** `onOpenChange(false)` makes the `<section>`
   `inert` (`QueryBuilderPanel/index.tsx:182`) while focus is inside it. The
   panel does **not** return focus to the toggle that opened it, even though it
   deliberately moves focus *into* the panel on open
   (`QueryBuilderPanel/index.tsx:133-138`) — so the entry side is handled and the
   exit side is not.

**Keyboard-only user:** removing the third of five conditions costs a full
re-traverse of the page to get back. Doing it five times is punishing.
**Screen-reader user:** the same, plus no announcement of what was removed.
**Remediation:** before removing, move focus to the next row's remove button (or
the previous one, or "Add rule" when the list empties); on Esc, return focus to
the element named by `labelledBy`. `QueryBuilderDrawer` gets this free from vaul,
which is why only the inline panel is affected.

#### ♿ A11Y-query-builder-admin-06 — `aria-invalid` on a `role="group"` is not a permitted attribute

**WCAG:** `4.1.2 Name, Role, Value (A)` · **508:** `E205.4 / 502.3.6 (Values)` · **Verdict: Partially Supports**

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/ValueEditor/EnumMultiSelect/index.tsx:45-50`

```tsx
<div role="group" aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedById}>
```

ARIA 1.2 does not list `aria-invalid` among the attributes supported by
`role="group"` — it is a widget attribute for inputs. axe's `aria-allowed-attr`
rule should flag this; the two suites that scan an open panel
(`activity-filter.spec.ts:122`, `members-filter.spec.ts:81`) apply a rule to a
**string/uuid** field, so the enum editor is never in the scanned DOM.

The practical effect is that the group's invalid state is not conveyed at all:
the individual checkboxes carry no `aria-invalid`, so a screen-reader user is
told the value is required only by the separate error paragraph.

**Remediation:** drop `aria-invalid` from the group and put it on each checkbox,
or convert the group to a `fieldset`/`legend` with the error associated via
`aria-describedby` (which it already has).

#### ♿ A11Y-query-builder-admin-07 — The field picker is the reference implementation and Supports

**WCAG:** `4.1.2 (A)`, `2.1.1 (A)`, `1.3.1 (A)` · **508:** `E205.4 / 502.3.6, 502.3.13` · **Verdict: Supports**

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilder/GroupNode/RuleRow/FieldPicker/index.tsx`; contract documented at `packages/query-builder/admin/AGENTS.md:106-117`

Recorded deliberately, because it is unusual: the picker implements the full
combobox-with-listbox pattern — focus never leaves the search box, the box owns
`aria-controls` and a live `aria-activedescendant`, every navigable row is an
`option` (including relation rows, which carry `aria-expanded` rather than a
value), group headings are `role="presentation"` so they are not invalid listbox
children, and rows are `tabIndex={-1}` so they cannot be reached by `Tab` in a
position the keyboard cannot act on. `AGENTS.md` explains why **both** halves
matter. Nothing here needs remediation; it is the standard the rest of the unit
should be held to.

#### Advisory (WCAG 2.2 — not referenced by 508)

- **2.5.8 Target Size (Minimum, AA).** The row remove button is `size-7` (28px)
  and the summary chips' `×` is a bare `size-3.5` icon in a button with no
  padding (`QueryBuilderSummary/index.tsx:129-132`) — well under 24×24 once
  spacing is counted.
- **2.4.11 Focus Not Obscured (Minimum, AA).** With the rules list scrolled inside
  `max-h-[22rem]`, a focused control can sit half-clipped at the container edge.

---

## 5. E2E Coverage Map

Three suites drive this unit, all through consumers: `content/records-filter.spec.ts`
(the panel + relations, the richest), `activity/activity-filter.spec.ts` (the
panel over a static schema), `users/members-filter.spec.ts` (the drawer).
**There are no unit tests in this package** — verified by glob; the only
`*.spec.ts` under `packages/*/admin` is `insights-admin`'s layout fold.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1/F4 builder + rule row | `apps/admin-e2e/src/content/records-filter.spec.ts:44-67` | adding a rule and opening the field picker works | ✅ E2E |
| F5 field change resets the operator | `apps/admin-e2e/src/content/records-filter.spec.ts:78-81` | the comment states it and the assertion at `:91` proves `op === 'eq'` after picking a string field | ✅ E2E |
| F8 field picker — relation grouping + search | `apps/admin-e2e/src/content/records-filter.spec.ts:56-66` | searching "Author Name" surfaces the related type's `Name` as a `role="option"` | ✅ E2E — asserts the role, not `aria-activedescendant` |
| F13 injected relation picker | `apps/admin-e2e/src/content/records-filter.spec.ts:119-144` | the picker writes the target's **id**, and a single-valued op narrows the set to one | ✅ E2E |
| F13 multi-valued relation | `apps/admin-e2e/src/content/records-filter.spec.ts:146-172` | the popover stays open across picks; `op:'in'` with both ids in order | ✅ E2E |
| F14/F15 serialisation — `eq` on a dotted path | `apps/admin-e2e/src/content/records-filter.spec.ts:86-93` | the exact `{field,op,value}` triple in the URL | ✅ E2E |
| F15 `contains` → `ilike` with wildcards | `apps/admin-e2e/src/content/records-filter.spec.ts:109-117` | `toEqual({field,op:'ilike',value:'%Ada%'})` — an exact-shape assertion, not a partial | ✅ E2E |
| F15 `not_contains` → `nilike` | `apps/admin-e2e/src/content/records-filter.spec.ts:197-205` | exact shape | ✅ E2E |
| F18 `is not empty` → `null:false` | `apps/admin-e2e/src/content/records-filter.spec.ts:223-231` | exact shape, and that no value editor renders | ✅ E2E |
| F19 deep-link restore | `apps/admin-e2e/src/activity/activity-filter.spec.ts:77`; `apps/admin-e2e/src/users/members-filter.spec.ts:67` | a filter in the URL is reflected in the UI on load | ✅ E2E |
| F22/F23 Apply gate | `apps/admin-e2e/src/activity/activity-filter.spec.ts:95` | a `uuid is one of` rule with a non-UUID item blocks Apply | ✅ E2E — the strongest validation assertion, and it covers the per-item loop at `validateRule.ts:91-104` |
| F24 condition count | `apps/admin-e2e/src/activity/activity-filter.spec.ts:63`; `apps/admin-e2e/src/users/members-filter.spec.ts:54` | the trigger reflects the active count | ✅ E2E — flat trees only; never a nested group |
| F27 drawer | `apps/admin-e2e/src/users/members-filter.spec.ts:18, 28` | opens from the toolbar; filtering deep-links the choice | ✅ E2E |
| F28 panel | `apps/admin-e2e/src/activity/activity-filter.spec.ts:19, 35` | expands from the toolbar; filtering by kind deep-links | ✅ E2E |
| F29 fields pending/error | `apps/admin-e2e/src/content/records-filter.spec.ts:299-309` | a 500 on `/filter-fields` renders an error state instead of an empty picker | ✅ E2E — the loading state and the Retry button are not asserted |
| F31 Reset | `apps/admin-e2e/src/activity/activity-filter.spec.ts:133`; `apps/admin-e2e/src/users/members-filter.spec.ts:93` | Reset clears the filter and restores the full list | ✅ E2E |
| F32 summary chips | `apps/admin-e2e/src/content/records-filter.spec.ts:257-290` | the chip text; removing the last chip drops the URL param entirely; Clear all | ✅ E2E — a genuinely good set; the "last chip drops the param rather than leaving an empty group" case is exactly the right thing to pin |
| a11y (panel/drawer open, one rule) | `apps/admin-e2e/src/activity/activity-filter.spec.ts:122`; `apps/admin-e2e/src/users/members-filter.spec.ts:81` | axe-clean with the surface **open and holding a rule** | ⚠️ PARTIAL — scans one string-field rule in the light theme. The enum editor, the compound editors, the relation picker, the error state, nested groups and the dark theme are never in the scanned DOM |
| F2 AND/OR toggle | — | — | ⚠️ PARTIAL — the control is present in scanned DOM but no spec flips it and asserts the wire `or` |
| F3 nested groups | — | — | ❌ NONE — "Add group" is never clicked in any spec, so the entire nesting feature, the recursive serialiser branch, and `addGroupTo`/`mapGroup` are unexercised |
| F6 operator change reseeds the value | — | — | ⚠️ PARTIAL — implied by F5's coverage, never asserted directly for `between`/`within_last` |
| F7 unknown field | — | — | ❌ NONE |
| F10 value editors | — | — | ⚠️ PARTIAL — only the plain text editor is driven. Number, boolean, enum-Select, `EnumMultiSelect`, `datetime-local`, `between` and `within_last` are all untouched |
| F11 CsvValueInput | — | — | ⚠️ PARTIAL — reached indirectly by the `uuid is one of` validation test, but its draft/normalisation behaviour is never asserted |
| F12 EnumMultiSelect | — | — | ❌ NONE |
| F16 `between` serialisation | — | — | ❌ NONE — the compound `and` sub-group shape is never asserted |
| F17 `within_last` serialisation | — | — | ❌ NONE — including the crash in `🐞 BUG-query-builder-admin-01` |
| F20 `between` rehydration | — | — | ❌ NONE — the lossy fold is documented at length and tested nowhere |
| F21 `contains` unescaping | — | — | ❌ NONE — only the forward direction is asserted |
| F25 tree ops | — | — | ⚠️ PARTIAL — `addRuleTo`/`removeNode`/`updateRule` on the root are exercised through the UI; the nested-parent paths are not |
| F26 dateInput | — | — | ❌ NONE |
| F30 draft discard on close-without-Apply | — | — | ❌ NONE |
| F33 JsonPreview | — | — | ❌ NONE |

**Coverage tally:** `33 features · 17 ✅ · 7 ⚠️ · 9 ❌`

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-query-builder-admin-01 — A large `within the last` count throws `RangeError` and crashes the filter surface while the user is still typing · Severity: High

**Location:** `packages/query-builder/admin/src/lib/utils/treeToJsonFilter.ts:123-129, 154-162`; reached from `packages/query-builder/admin/src/lib/components/QueryBuilderDrawer/JsonPreview/index.tsx:38`; input at `.../ValueEditor/index.tsx:192-205`
**Category:** correctness / ux-state (crash)

**What the code does:**

```ts
case OP.WithinLast: {
    const v = rule.value as { n: number; unit: WithinUnit };
    const cutoff = new Date(now.getTime() - msFor(v.n, v.unit)).toISOString();
    return { field: f, op: WIRE_OP.Gte, value: cutoff };
}
…
function msFor(n: number, unit: WithinUnit): number {
    return MS_PER_UNIT[unit] * n;
}
```

and the editor that produces `n`:

```tsx
<Input type="number" min={1} value={String(v.n)}
    onChange={(e) => onChange({ ...v, n: Math.max(1, Number(e.target.value) || 1) })} />
```

`min={1}` is the **only** bound — there is no `max`, and `Number()` accepts any
magnitude. `MS_PER_UNIT.days = 86_400_000`, so `n = 99_999_999_999` gives roughly
`8.6e18` ms. `now.getTime() - 8.6e18` is far outside the ±8.64e15 ms range a
`Date` can represent, so `new Date(...)` is an Invalid Date and
**`.toISOString()` throws `RangeError: Invalid time value`**.

**Why it is wrong:** an uncaught throw during render. And it is not confined to
Apply: `JsonPreview` calls `treeToJsonNode(tree, now)` on **every render of the
draft** (`JsonPreview/index.tsx:38`), and `JsonPreview` is mounted
unconditionally by both hosts (`QueryBuilderPanel/index.tsx:221`,
`QueryBuilderDrawer/index.tsx:163`). So the throw happens as soon as the digits
are typed, before any button is pressed. Neither host has an error boundary, and
neither does the shell (`🐞 BUG-shell-admin-01`), so the whole page unmounts.

The package's own code anticipated this class of failure —
`defaultValueForOp`'s JSDoc says leaving a compound op's value unseeded
"throws `RangeError` from `new Date(NaN)` on Apply"
(`utils/defaultValueForOp.ts:13-14`) — and then seeded the value without bounding
it.

**Repro:**
1. `/activity` → **Filters** → **Add rule**.
2. Pick a date field; set the operator to **within the last**.
3. In the amount box, type `99999999999` (or paste it).
4. → Observed: `RangeError: Invalid time value`; the page goes blank. Expected:
   the value is clamped, or the rule is reported invalid.

**Blast radius:** any user of the Activity log or the content records filter who
types a large number into that box — reachable by a fat-fingered paste, not only
by malice. The failure is a full page crash with data loss (the whole draft).
**Suggested fix:** clamp `n` to a sane ceiling in the editor **and** guard
`ruleToJson` — if the computed cutoff is not finite, treat the rule as incomplete
so the serialiser prunes it and `validateRule` reports `CountRequired`.

### 🐞 BUG-query-builder-admin-02 — `validateRule` never checks that the operator is legal for the field's type, so a hand-edited URL commits an impossible filter · Severity: Medium

**Location:** `packages/query-builder/admin/src/lib/utils/validateRule.ts:51-119`; the operator table it ignores is `packages/query-builder/admin/src/lib/utils/operators.ts:6-60`; the picker that renders it is `.../OperatorPicker/index.tsx:25-44`
**Category:** correctness

**What the code does:** `validateRule(rule, field)` branches on `rule.op` and
validates the *value* against `field.type`. There is no
`OPS_FOR_TYPE[field.type].includes(rule.op)` check anywhere — not in
`validateRule`, not in `treeHasInvalidRules`, not in `RuleRow`.

`jsonFilterToTree` will happily produce such a rule: `WIRE_TO_UI.ilike` is
`OP.Contains` (`wireOp.ts:57`), so `?filter={"field":"createdAt","op":"ilike","value":"%2020%"}`
parses to `{fieldId:'createdAt', op:'contains', value:'2020'}` on a `date` field.
`validateRule` then falls into the scalar branch, finds a non-empty string, and
runs `isScalarValid('2020', 'date')` → `new Date('2020')` is valid → returns
`null`. **The rule passes the Apply gate.**

**Why it is wrong:** `OPS_FOR_TYPE` exists precisely so a rule can never be in an
"operator valid on the previous type but not this one" state — `RuleRow`'s JSDoc
says so in as many words (`RuleRow/index.tsx:92-98`). That invariant is enforced
on the *edit* path (changing field or operator reseeds) and not at all on the
*load* path, which is the one an attacker or a stale bookmark controls.

The user-visible symptom compounds it: `OperatorPicker` renders a Radix `Select`
whose `value` is `contains` while its items are only the date operators, so the
trigger renders **blank**. The row looks half-empty, gives no error, and commits.

**Repro:**
1. Apply any filter on a date field so the URL has a `filter` param.
2. Hand-edit it to `{"and":[{"field":"createdAt","op":"ilike","value":"%2020%"}]}`
   and load.
3. → Observed: the rule row renders with an empty operator box and no error;
   **Apply** commits and the request goes out as `ilike` against a `timestamptz`.
   Expected: the rule reports an invalid-operator error and Apply is blocked.

**Blast radius:** anyone who shares or bookmarks a filter URL and edits it, plus
any future consumer that feeds a saved view through `jsonFilterToTree`. The
server rejects the request, so the impact is a 400 rather than bad data — but the
package's whole contract is "a rule that passes here is one the server accepts"
(`validateRule.ts:44-47`), and that is now false.
**Suggested fix:** first line of `validateRule` —
`if (!OPS_FOR_TYPE[field.type].includes(rule.op)) return RULE_VALIDATION.UnknownField`
(or a new `OperatorInvalid` code with its own message).

### 🐞 BUG-query-builder-admin-03 — A boolean rule with a non-boolean value passes the Apply gate · Severity: Medium

**Location:** `packages/query-builder/admin/src/lib/utils/validateRule.ts:108-118`
**Category:** correctness

**What the code does:**

```ts
if (typeof rule.value !== 'string' || rule.value.length === 0) {
    return RULE_VALIDATION.ValueRequired;
}
if (!isScalarValid(rule.value, field.type)) {
    if (field.type === FIELD_TYPE.Uuid) return RULE_VALIDATION.NotUuid;
    if (field.type === FIELD_TYPE.Number) return RULE_VALIDATION.NotNumber;
    if (field.type === FIELD_TYPE.Date) return RULE_VALIDATION.NotDate;
    // string / boolean / enum are unconstrained beyond presence at
    // this layer — Select-driven editors enforce membership.
}
return null;
```

`isScalarValid` for `FIELD_TYPE.Boolean` requires exactly `'true'` or `'false'`
(`validateRule.ts:165-166`) — so the guard **does** fire for a bad boolean — but
the `if` chain has no boolean arm and no `else`, so execution falls through to
`return null` and the rule is reported valid.

**Why it is wrong:** the comment justifies the fall-through for `string` and
`enum`, where `isScalarValid` always returns `true` and the branch is
unreachable. For `boolean` it is reachable, and the justification ("Select-driven
editors enforce membership") holds only on the edit path — the load path accepts
any string.

**Repro:** load `?filter={"and":[{"field":"published","op":"eq","value":"yes"}]}`
against a boolean field. → Observed: no error; Apply commits `eq 'yes'` against a
`boolean` column. Expected: a validation error.

**Blast radius:** the same URL-editing surface as
`🐞 BUG-query-builder-admin-02`, and the same 400-not-corruption outcome.
**Suggested fix:** add a `Boolean` arm returning a `NotBoolean` code (or reuse
`ValueRequired`), and make the chain exhaustive so a future field type cannot
fall through silently.

### 🐞 BUG-query-builder-admin-04 — `is_one_of` on a UUID or number field reports the wrong error code for a non-string item · Severity: Low

**Location:** `packages/query-builder/admin/src/lib/utils/validateRule.ts:91-104`
**Category:** correctness (ux)

**What the code does:** inside the multi-value loop, a non-string item (reachable
from a URL like `{"op":"in","value":[1,2]}`) fails the `typeof item !== 'string'`
test and is then mapped to a type-specific code — `NotUuid`, `NotNumber`,
`NotDate` — or falls through to `MultiRequired` for `string`/`enum`/`boolean`.
For a **string** field with a numeric item, the user sees "Add at least one
value" when the list is in fact non-empty.

**Why it is wrong:** `MultiRequired`'s message is "Add at least one value"
(`RuleRow/index.tsx:58-61`), which is actively misleading — the user has values
and is told to add some. `3.3.3 Error Suggestion` asks for a message that helps
fix the problem.

**Repro:** load `?filter={"and":[{"field":"title","op":"in","value":[1,2]}]}`.
→ Observed: "Add at least one value" under a rule showing `1,2`. Expected:
something like "Values must be text".

**Blast radius:** URL-edited filters only; cosmetic.
**Suggested fix:** distinguish "empty" from "invalid item" with a separate code.

### 🐞 BUG-query-builder-admin-05 — Applying from the inline panel remounts every rule row and loses focus · Severity: Low

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilderPanel/index.tsx:115-121, 152-154`; the consumers' parse at `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/LoadedRecordsView/index.tsx:269` and `packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:102`
**Category:** ux-state

**What the code does:**

```ts
useEffect(() => {
    if (open) {
        setDraft(value);
        setShowErrors(false);
    }
}, [open, value]);
```

The panel deliberately stays open after Apply. Apply writes the tree to the URL;
the consumer re-derives `value` with
`useMemo(() => jsonFilterToTree(filterParam), [filterParam])`; `jsonFilterToTree`
mints **fresh ids** for every node (`jsonFilterToTree.ts:96-101`,
`newId()` per call). The effect then replaces the draft with that new tree.
Every `RuleRow`'s React key changes, so every row unmounts and remounts.

**Why it is wrong:** the ids are documented as "Stable client id for React keys"
(`filter-tree.type.ts:58-59`), and the round-trip breaks that stability. The
visible symptoms are a flicker of the whole rule list on Apply, loss of focus,
and loss of any un-normalised `CsvValueInput` draft (its `useEffect` re-syncs
from the new canonical value, `CsvValueInput/index.tsx:46-52`).

Note the drawer is **not** affected: it closes on Apply, so the remount is
invisible.

**Repro:** open the records filter, add a rule, put focus in the value box, press
Apply. → Observed: the rows blink and focus is gone. Expected: the panel is
unchanged and focus is preserved.

**Blast radius:** cosmetic-to-annoying on the two panel consumers.
**Suggested fix:** skip the re-sync when the incoming `value` serialises
identically to the current draft (compare `treeToJsonFilter` output), or derive
ids deterministically from the node's position so a round-trip is id-stable.

### 🐞 BUG-query-builder-admin-06 — `localInputToIso` shifts a non-existent local time across a DST spring-forward · Severity: Low

**Location:** `packages/query-builder/admin/src/lib/utils/dateInput.ts:17-36`
**Category:** correctness

**What the code does:** `localInputToIso` is `new Date(localString).toISOString()`;
`isoToLocalInput` shifts by `getTimezoneOffset()` and slices to 16 characters.

Two consequences. (a) On a spring-forward day the wall-clock hour 02:00–02:59 does
not exist; `new Date('2026-03-29T02:30')` resolves to 03:30 local in
`Europe/Berlin`, so the field silently redisplays a different time than the user
typed. (b) `slice(0, 16)` truncates seconds, so an instant that arrived with
seconds (from a `between` bound written elsewhere) loses them on display and on
the next edit.

**Why it is wrong:** the module's own docstring is emphatic that "the value on
the wire must be a precise instant" and that "`datetime-local` + ISO keeps every
date operator exact" (`dateInput.ts:5-9`). A one-hour shift is not exact, and
neither is a truncation.

**Repro:** set the browser timezone to `Europe/Berlin`, filter a date field with
`between`, and type `2026-03-29T02:30` in the From box. → Observed: the box shows
`2026-03-29T03:30` after the round-trip. Expected: either the typed value, or a
validation message that the time does not exist.

**Blast radius:** one hour per year per timezone, on a range bound. Small, but
it silently changes what the filter means.
**Suggested fix:** detect the shift (`isoToLocalInput(localInputToIso(x)) !== x`)
and report `NotDate`, or accept and document minute-and-DST imprecision in the
`RuleRow` hint.

### 🐞 BUG-query-builder-admin-07 — `JsonPreview`'s `now` memo does not pin anything · Severity: Low

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilderDrawer/JsonPreview/index.tsx:34-38`
**Category:** correctness (doc drift)

```ts
// Pin `now` to the tree itself so `within_last` cutoffs don't drift
// every render (e.g. as the user types in another rule).
const now = useMemo(() => new Date(), [tree]);
```

The dependency is the `tree` **object identity**, and every `treeOps` helper
returns a brand-new object (`treeOps.ts:44-117` — every function spreads). So the
memo invalidates on literally every edit, which is the exact case the comment
says it prevents. The preview's `within_last` cutoff advances on every keystroke
anywhere in the tree.

**Why it is wrong:** harmless in effect (the preview is informational and Apply
resolves a fresh `now` regardless), but the comment asserts a guarantee the code
does not provide, which is how a real bug gets built on top of it later.

**Repro:** add a `within the last 7 days` rule, expand the preview, then type in
a second rule's value box. → Observed: the `gte` timestamp changes character by
character. Expected (per the comment): it holds still.

**Suggested fix:** either drop the memo and the comment, or key it on something
stable — e.g. `useMemo(() => new Date(), [])` refreshed only when the panel opens.

### 🐞 BUG-query-builder-admin-08 — `JsonPreview`'s copy handler is an unguarded promise · Severity: Low

**Location:** `packages/query-builder/admin/src/lib/components/QueryBuilderDrawer/JsonPreview/index.tsx:42-47`

```ts
const onCopy = async () => {
    if (!json) return;
    await navigator.clipboard.writeText(json);
    setCopied(true);
    …
};
```

`navigator.clipboard` is undefined in an insecure context and `writeText` rejects
when the permission is denied. Either way the `onClick` handler rejects
unhandled, the button never flips to "Copied", and the user gets no feedback.
Low severity because the admin runs on `localhost`/HTTPS in practice.

**Suggested fix:** `try/catch` with a failure state, and feature-detect
`navigator.clipboard` to hide the button when it is unavailable.

### Checked and cleared (no defect found)

- **LIKE-metacharacter round-trip.** `escapeLike` → `%…%` → strip → `unescapeLike`
  is correct for `%`, `_`, `\`, and for values containing several of them.
  Traced by hand for `50%`, `a\`, `%%`, `a_b`.
- **`SegmentedControl` deselect.** `GroupNode` guards the empty string Radix emits
  when the active segment is re-pressed (`GroupNode/index.tsx:83-87`), and the
  control is fully controlled so the combinator can never become `''`.
- **Empty-group and incomplete-rule pruning.** Symmetric and recursive
  (`treeToJsonFilter.ts:67-77`); the server never receives `{or:[]}` or a rule
  with an undefined value.
- **`byOrder`-style mutation hazards.** `treeOps` is entirely immutable — every
  helper spreads rather than mutating (`treeOps.ts:44-117`).
- **`useMemo` on the empty tree.** `QueryBuilder` memoises `newGroup()` so a
  fresh id is not minted per render, with a comment explaining the bug it avoids
  (`QueryBuilder/index.tsx:72-77`). Correct.
- **Unknown-field handling.** No `?? fields[0]` fallback anywhere; the rationale
  in `AGENTS.md:119-126` matches the code exactly.
- **i18n completeness.** Every user-facing branch has a `defineMessages` entry —
  including all nine validation codes, both host shells' loading/error copy, and
  the JSON preview's empty text. No hard-coded English reaches a user.
- **Injection.** No `dangerouslySetInnerHTML`; values are rendered as text and
  serialised with `JSON.stringify`. The `field` string is not sanitised, but the
  server's `FilterSchema` whitelist is the boundary (EC-17).
- **`CsvValueInput` draft/echo loop.** The re-sync effect compares *canonical*
  forms, so it does not fight its own `onChange` echo
  (`CsvValueInput/index.tsx:46-52`). Traced for `a,`, `,`, `a,,b`.

**Tally:** 8 🐞 (0 Critical · 1 High · 2 Medium · 5 Low) · 7 ♿
(1 Supports · 3 Partially Supports · 3 Does Not Support)

---

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | package unit (`jest`, node env — the pattern `packages/insights/admin` uses) | `packages/query-builder/admin/src/lib/utils/treeToJsonFilter.spec.ts` | `within_last` with an out-of-range `n` does not throw; `between` emits the `{and:[gte,lte]}` sub-group; `contains` escapes `%`/`_`/`\`; incomplete rules and empty groups are pruned | `🐞 BUG-query-builder-admin-01`, F16/F17 ❌ |
| 2 | package unit | `packages/query-builder/admin/src/lib/utils/validateRule.spec.ts` | an operator not in `OPS_FOR_TYPE[field.type]` is rejected; a boolean value of `'yes'` is rejected; a non-string item in `is_one_of` on a string field reports an "invalid item" code, not "add a value" | `🐞 BUG-query-builder-admin-02`, `-03`, `-04` |
| 3 | package unit | `packages/query-builder/admin/src/lib/utils/jsonFilterToTree.spec.ts` | round-trip property: `jsonFilterToTree(treeToJsonFilter(t))` preserves every leaf's field/op/value for each of the 14 operators; malformed JSON returns `null`; a bare rule is wrapped; `{and:[gte,lte]}` folds to Between | F19–F21 ❌ |
| 4 | `apps/admin-e2e` POM + `page.route` mock | `src/content/records-filter-groups.spec.ts` | Add group → a rule inside it → OR at the root → the URL carries a nested `{"or":[…]}`; the condition badge counts leaves across nesting; removing the group's last rule leaves an empty box that is still pruned from the wire | F3 ❌, F2 ⚠️, F24 ⚠️ |
| 5 | `apps/admin-e2e` | `src/content/records-filter-value-editors.spec.ts` | Each editor produces the right wire value: number, boolean Select, enum Select, `EnumMultiSelect`, `datetime-local`, `between`, `within_last` | F10/F12 ❌ |
| 6 | `apps/admin-e2e` | `src/content/records-filter-a11y.spec.ts` | axe with **each** editor variant on screen, with the error state showing, and with a nested group — plus a `colorScheme:'dark'` run | `♿ A11Y-query-builder-admin-06`, F10 ⚠️ |
| 7 | `apps/admin-e2e` | `src/content/records-filter-keyboard.spec.ts` | After removing rule 2 of 3, `document.activeElement` is rule 3's remove button (not `<body>`); `Esc` collapsing the panel returns focus to the Filters toggle; removing a summary chip keeps focus in the chip strip | `♿ A11Y-query-builder-admin-05` |
| 8 | `apps/admin-e2e` | `src/content/records-filter-unknown-field.spec.ts` | Loading a URL whose `field` is not in the schema renders the "no longer available" message **without** pressing Apply, blocks Apply, and clears once the field is re-picked | F7 ❌ |
| 9 | `apps/admin-e2e` | extend `src/content/records-filter.spec.ts` | Apply from the inline panel preserves focus and does not remount the rows (assert a stable `data-testid` or focus after Apply) | `🐞 BUG-query-builder-admin-05` |
| 10 | `apps/admin-e2e` | `src/activity/activity-filter.spec.ts` — extra case | With three invalid rules, Apply moves focus to the first invalid row and each error names its field | `♿ A11Y-query-builder-admin-01`, `-02` |
| 11 | `apps/server-e2e` testcontainer + supertest | extend `src/server/content/list-entries-relation-filter.spec.ts` | For each of the 11 wire ops this package can emit, the server accepts the exact payload shape the FE produces — a contract test pinning `WIRE_OP` against `parseFilterTree` | cross-unit drift risk named in §1 |
| 12 | package unit | `packages/query-builder/admin/src/lib/utils/dateInput.spec.ts` | `isoToLocalInput`/`localInputToIso` round-trip at a DST spring-forward and fall-back boundary in a fixed `TZ` | `🐞 BUG-query-builder-admin-06`, F26 ❌ |
