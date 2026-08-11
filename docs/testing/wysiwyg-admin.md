# @ortha-cms/wysiwyg-admin — Test Artifact

> **Unit:** `packages/wysiwyg/admin` · **Package:** `@ortha-cms/wysiwyg-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/wysiwyg/admin/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the control every `richtext` field renders — the collapsed preview card,
the expanded TipTap editor view, the one-row formatting toolbar and its three
menus, the custom `callout` / `columns` / `image` / `video` nodes, the alt-text
popover, the resize handle, the read-only "View" variant, the trust-boundary
renderer `renderRichText`, the "what is empty" rule, and the `WYSIWYG_MEDIA_SLOT`
seam that a media plugin fills.

**Does NOT own:** any route, page, or nav entry — its **entire surface is one
contribution to content-admin's `ENTRY_FIELD_CONTROL_SLOT`**. It owns no server
counterpart: `richtext` is an existing content field type storing HTML in a text
column, and this plugin changes the *control*, not the schema, the wire format, or
the API. It does not own the Media Library (that fills its slot from
`@ortha-cms/media-admin`; the dependency runs media → wysiwyg), nor the entry
form's Save/Publish, nor the unsaved-changes guard.

- **Entry points**
  - `WysiwygPlugin` and `WYSIWYG_WIDGET` — **the only two exports**
    (`packages/wysiwyg/admin/src/index.ts`; re-exporting anything else would pull
    TipTap back into the entry chunk).
  - Slot **filled**: `ENTRY_FIELD_CONTROL_SLOT` with `{ Component:
    WysiwygFieldControl, FullView: WysiwygFieldFullView }`, both behind
    `React.lazy` (`.../presentation/wysiwygPlugin/index.tsx`).
  - Slot **declared**: `WYSIWYG_MEDIA_SLOT`
    (`.../presentation/slots/wysiwygSlots/index.ts:97`).
  - Field opt-out: `field.richtext({ admin: { widget: 'textarea' } })` →
    content-admin's textarea; `'wysiwyg'` states the default explicitly.

- **Runtime prerequisites**
  - The admin running (`npm run dev`) with a content type declaring a `richtext`
    field; the reference fixture is `article.body`.
  - `apps/admin/src/styles.css` must import `packages/wysiwyg/admin/src/styles.css`
    **after** the design system's — every rule hangs off `.ortha-wysiwyg`.
  - `content:update` (or `content:create` on a create form) for the editable
    variant; without it the control renders the read-only **View** variant.
  - `@ortha-cms/media-admin` registered for the two media sources; without it the
    Insert ▸ Media menu offers only **From a URL**.

- **How to exercise it manually**
  ```bash
  docker compose up -d && npx nx run server:db:migrate && npm run dev
  ```
  Open `http://localhost:4200/workspaces/<id>/content/article/new`, fill **Title**,
  then press the **Body** card. The e2e path is
  `npx nx e2e admin-e2e -- --project=chromium wysiwyg-fields`.

- **Dependencies that must be healthy:** `@tiptap/*` (StarterKit, text-style,
  highlight, text-align, table, extensions), `@ortha-cms/design-system` (Button,
  Popover, DropdownMenu, Dialog, Tooltip, Checkbox, Input, Label),
  `@ortha-cms/content-admin` (`EntryFieldControlContext`, the slot, the
  `<FieldError>` the control points `aria-describedby` at),
  `@ortha-cms/utils-admin` (`createSlot`, `byOrder`), `react-intl`.

- **The bundle guard is a number:** the admin's entry chunk is ~255 kB with TipTap
  out in `editorExtensions-*.js` at ~420 kB. If the entry chunk moves, the lazy
  boundary has been broken.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | The collapsed field renders stored HTML as **content**, not markup | `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygFieldControl/index.tsx:122-137` | ✅ E2E |
| F2 | Sanitization: the value is round-tripped through the ProseMirror schema | `packages/wysiwyg/admin/src/lib/infrastructure/renderRichText/index.ts:53-69` | ⚠️ PARTIAL |
| F3 | Links are flattened to `<span data-link>` so the preview has no tab stop | `.../renderRichText/index.ts:77-84` | ✅ E2E |
| F4 | A transparent full-bleed button opens the editor, named `Edit {label}` | `.../WysiwygFieldControl/index.tsx:156-166` | ✅ E2E |
| F5 | Empty state: the field's `admin.placeholder`, else a default line | `.../WysiwygFieldControl/index.tsx:108-120` | ✅ E2E |
| F6 | `widget: 'textarea'` opts a field out entirely | `.../domain/constants` (`WYSIWYG_WIDGET`) | ✅ E2E |
| F7 | Expanding replaces the tab strip with the editor **view**, chrome intact | `.../WysiwygFieldFullView/index.tsx:38` | ✅ E2E |
| F8 | Two exits: **Back to fields** and **Done**; both `onBlur` the field | `.../WysiwygFieldFullView/index.tsx:55-58, 72-81` | ✅ E2E |
| F9 | Edits write straight to the entry form via `onChange` | `.../WysiwygEditorPanel/index.tsx:117-122` | ✅ E2E |
| F10 | `normalizeRichText` stores an emptied editor as `''`, not `<p></p>` | `.../domain/richTextValue/index.ts:41-43` | ✅ E2E |
| F11 | Toolbar fits one row; the budget is ~40px | `.../WysiwygToolbar/index.tsx` | ✅ E2E |
| F12 | Bold / italic / lists / undo / redo with `aria-pressed` | `.../WysiwygToolbar/ToolbarButton/index.tsx:36-64` | ✅ E2E |
| F13 | Block-type menu: paragraph + H1–H4 | `.../WysiwygToolbar/BlockTypeMenu/index.tsx` | ⚠️ PARTIAL |
| F14 | Font-size menu | `.../WysiwygToolbar/FontSizeMenu/index.tsx` | ❌ NONE |
| F15 | Colour + highlight menus (inline, author-chosen, kept on the content) | `.../WysiwygToolbar/ColorMenu/index.tsx` | ⚠️ PARTIAL |
| F16 | Align menu — 4 alignments, switching to `setMediaAlign` on a media node | `.../WysiwygToolbar/AlignMenu/index.tsx` | ✅ E2E |
| F17 | More-marks menu — underline, strike, code, quote, clear formatting | `.../WysiwygToolbar/MoreMarksMenu/index.tsx` | ❌ NONE |
| F18 | Link popover (`openOnClick: false`, `rel="noopener noreferrer nofollow"`) | `.../WysiwygToolbar/LinkPopover/index.tsx`, `.../editorExtensions/index.ts:39-43` | ❌ NONE |
| F19 | Insert ▸ Table (3×3 with a header row), plus row/column edits | `.../WysiwygToolbar/InsertMenu/TableItems/index.tsx:50,76` | ✅ E2E |
| F20 | Insert ▸ Columns (`<div data-columns="n">` of `<div data-column>`) | `.../infrastructure/extensions/columns/index.ts:88,127` | ✅ E2E |
| F21 | Insert ▸ Callout (`<aside data-callout data-tone>`) | `.../infrastructure/extensions/callout/index.ts:69-77` | ✅ E2E |
| F22 | Insert ▸ Divider | `.../WysiwygToolbar/InsertMenu/index.tsx` | ❌ NONE |
| F23 | Insert ▸ Media ▸ **From a URL** (built-in, `order: 100`) | `.../WysiwygToolbar/MediaUrlDialog/index.tsx` | ✅ E2E |
| F24 | `WYSIWYG_MEDIA_SLOT` — contributed sources mounted by the toolbar | `.../presentation/slots/wysiwygSlots/index.ts:97`, `.../WysiwygToolbar/index.tsx:34-39` | ✅ E2E |
| F25 | `src` vetted twice — on the dialog and on node insert **and parse** | `.../domain/mediaSrc/index.ts:27-43`, `.../extensions/media/index.ts:78-83` | ✅ E2E |
| F26 | Resizable image/video via the `width` attribute, keyboard-operable | `.../extensions/media/MediaNodeView/index.tsx:100-110, 166-172` | ✅ E2E |
| F27 | Media alignment via `data-align` + margins, never `text-align` | `.../extensions/media/index.ts:110-120` | ✅ E2E |
| F28 | Alt-text popover with a **decorative** checkbox and a warning chip | `.../extensions/media/MediaNodeView/AltTextPopover/index.tsx:63` | ✅ E2E |
| F29 | Every overlay `<form>` stops its own submit | `.../AltTextPopover/index.tsx:131-140`, `LinkPopover`, `MediaUrlDialog` | ✅ E2E |
| F30 | Read-only variant: **View {label}**, no toolbar, `role="region"`, no autofocus | `.../WysiwygEditorPanel/index.tsx:90, 105-111, 157` | ⚠️ PARTIAL |
| F31 | Word/character count footer, `aria-live="off"` | `.../WysiwygEditorPanel/index.tsx:125-150, 161-169` | ❌ NONE |
| F32 | `useLiveEditorState` survives StrictMode's destroyed-editor frame | `.../presentation/hooks/useLiveEditorState/index.ts` | ❌ NONE |
| F33 | Lazy boundary keeps TipTap out of the entry chunk | `.../presentation/wysiwygPlugin/index.tsx` | ❌ NONE |

## 3. Manual Test Plan

All blocks: a workspace open, a content type with `body: field.richtext(...)`, and
`content:update` unless stated. Quoted strings are real `defineMessages` defaults.

### F1–F3 — The collapsed field

**Preconditions:** an article whose `body` is
`<h2>Hello</h2><p>Some <a href="https://x.test">link</a></p>`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the record | the Body card shows a rendered heading and paragraph, **not** angle brackets |
| 2 | Inspect the DOM | `<h2>` and `<p>` inside `.ortha-wysiwyg`; the anchor is a `<span data-link>` |
| 3 | Tab through the form | focus goes from the previous field straight to the Body button — **no link is a tab stop** |
| 4 | Set the body to `<p><img src=x onerror="alert(1)"></p>` via the API and reopen | no alert; the `onerror` attribute is gone (only schema-declared attributes survive) |
| 5 | Set it to `<p><a href="javascript:alert(1)">x</a></p>` | rendered as a span; the href never reaches the DOM |
| 6 | Body longer than the clamp | the card clamps at `max-h-72` with a fade at the cut |

**Keyboard-only path:** Tab reaches one control, named "Edit Body"; Enter/Space
opens the editor. **Screen-reader expectation:** the content is read as ordinary
prose, then a single button "Edit Body"; a field error is announced on focus via
`aria-describedby`.

### F4–F6 — Opening, empty state, opt-out

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press the card | the work area swaps to the editor view; the caret is at the end of the text |
| 2 | On an empty field with `admin.placeholder: "Tell the story…"` | the card shows that string |
| 3 | On an empty field with no placeholder | "Nothing written yet — press Edit to start." |
| 4 | On a field declared `widget: 'textarea'` | content-admin's plain textarea, no card, no editor |

### F7–F9 — The expanded view

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Expand | a **Back to fields** link, an `<h2>` naming the field, "Required" if it is, then toolbar / document / footer |
| 2 | Look around | the app sidebar, record title, Save/Publish and the Properties rail are all still on screen |
| 3 | Type | the Properties rail's publish gate updates live |
| 4 | Press **Done** | back to the form; the field is `touch`ed, so a required-but-empty field now complains |
| 5 | Press **Back to fields** | identical |
| 6 | Press **Escape** | **nothing happens** — deliberate (`WysiwygFieldFullView` JSDoc); menus and popovers answer Escape themselves |
| 7 | Type, leave, re-enter, then Save | the typed content is in the request body — `onUpdate` writes to the form as you type |

### F10 — "Empty"

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Clear a body completely and save | the request body carries `body: ""`, not `<p></p>` (`wysiwyg-fields.spec.ts:333`) |
| 2 | Insert a column layout and type nothing, then save | the layout **survives** — `isEmptyRichText` treats anything that is not paragraph/`<br>`/whitespace as content |
| 3 | On a `required` field, clear it and Publish | the publish gate blocks |

### F11–F12 — Toolbar

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Expand at 1280px viewport | every control on **one row** (`wysiwyg-fields.spec.ts:171`) |
| 2 | Select a word, press **Bold** | the word is bold; the button's `aria-pressed` becomes `true` and it gains a filled background |
| 3 | Put the caret outside any bold run | `aria-pressed` returns to `false` |
| 4 | Press **Undo** with nothing to undo | the button is `disabled` and has **no** `aria-pressed` |
| 5 | Press Bold with a selection using the mouse | the selection is preserved (`onMouseDown` → `preventDefault`) |

### F13–F18 — The menus

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Block type → **Heading 2** | the paragraph becomes `<h2>`; the trigger shows "H2" |
| 2 | Block type → **Heading 4** directly from a paragraph following an `<h2>` | it becomes `<h4>` — **no warning about the skipped level** (see `♿ A11Y-wysiwyg-admin-05`) |
| 3 | Font size → a value | the run is wrapped in a `textStyle` mark with a `font-size` |
| 4 | Colour → a swatch | an inline colour, kept on the content (it is content, not chrome) |
| 5 | Align → Justify with text selected | `text-align: justify` on the paragraph |
| 6 | Align → with an **image** selected | the menu switches to `setMediaAlign` and **drops Justify** |
| 7 | More formatting → toggle underline | a checkbox item reflecting state |
| 8 | Link → enter `https://x.test` | `<a href rel="noopener noreferrer nofollow">`; clicking it in the editor does **not** navigate |
| 9 | Link → enter `javascript:alert(1)` | the href is blanked by the Link extension's protocol allowlist |

### F19–F22 — Insert

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Insert ▸ Table ▸ **Insert table** | a 3×3 table whose first row is `<th>` cells (`INITIAL_TABLE`, `TableItems:50`) |
| 2 | Save and inspect the request | the HTML contains `<table`, `<th`, and three `<tr>` (`wysiwyg-fields.spec.ts:284-287`) |
| 3 | Add a row / column from the submenu | the table grows |
| 4 | Insert ▸ Columns ▸ 3 | `<div data-columns="3">` containing three `<div data-column>` |
| 5 | Insert ▸ Callout ▸ Warning | `<aside data-tone="warning" data-callout="">` (`wysiwyg-fields.spec.ts:262`) |
| 6 | Insert ▸ Divider | an `<hr>` |
| 7 | Insert a callout as the last block | a trailing paragraph exists after it (StarterKit's TrailingNode) |

### F23–F25 — Media sources and `src` vetting

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Insert ▸ Media | **Media Library…**, **Upload files…**, then **From a URL** (`order: 100` last) |
| 2 | With `media-admin` **not** registered | only **From a URL** — the editor still embeds media |
| 3 | From a URL → `https://x.test/a.png` | an `<img>` is inserted |
| 4 | From a URL → `/api/media/assets/<id>/raw` | inserted — same-origin paths are allowed |
| 5 | From a URL → `//evil.test/a.png` | **refused**, with an explanation (protocol-relative inherits a scheme the editor cannot vouch for) |
| 6 | From a URL → `javascript:alert(1)` | refused (`wysiwyg-fields.spec.ts:409`) |
| 7 | Paste stored HTML containing `<img src="data:...">` and reopen | the `src` is emptied on **parse** (`extensions/media/index.ts:78-83`) |
| 8 | Media Library… → pick an image | inserted with the library asset's own `alt` (`wysiwyg-fields.spec.ts:608`) |

### F26–F27 — Resize and align

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Select an image, Tab to the handle | a focusable button named "Resize — drag, or use the arrow keys" |
| 2 | Press → several times | the width grows by `MEDIA_RESIZE_STEP` each press; Shift multiplies by 4 |
| 3 | Press ← below the floor | the width clamps at `MEDIA_MIN_WIDTH` |
| 4 | Press Backspace on the handle | the width resets to natural (`width: null`) |
| 5 | Save | the HTML carries `width="<n>"` — never a `style`, never a `height` (`wysiwyg-fields.spec.ts:449`) |
| 6 | Align → Centre on the image | `data-align="center"`; **left is never written** |

### F28 — Alt text

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Insert an image with no alt | a **warning-tinted chip reading "Add alt text"** with a warning triangle |
| 2 | Press it, type a description, Save | the chip becomes a neutral "Alt text" chip; the stored HTML carries `alt="…"` (`wysiwyg-fields.spec.ts:515`) |
| 3 | Press it, tick **Decorative — it carries no information**, Save | `alt=""` **and** `data-decorative`; the chip stops warning (`wysiwyg-fields.spec.ts:549`) |
| 4 | Tick decorative with text already typed | the alt is emptied — a screen reader must not read text behind a ticked box |
| 5 | Reopen the popover after abandoning an edit | it reseeds from the node, not from the abandoned draft |
| 6 | Insert a **video** | there is **no** alt control (correct — `<video>` has no `alt`) and **no captions control at all** (see `♿ A11Y-wysiwyg-admin-04`) |

### F29 — Overlay forms

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | In the alt popover, press **Enter** | the alt saves; the **record is not saved or published** |
| 2 | Same in the link popover and the media URL dialog | same — pinned by "never saves the record from an overlay's own form" (`wysiwyg-fields.spec.ts:578`), which fired three saves before the fix |

### F30 — Read-only

**Preconditions:** a user without `content:update`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a record | the card's chip reads **View** with an eye icon; the button is named "View Body" |
| 2 | Press it | the same view opens with **no toolbar** |
| 3 | Try to type | nothing is inserted (`editable: false`) |
| 4 | Check focus on open | focus is **not** dropped at the end of the document |
| 5 | Inspect the surface | `role="region"`, no `aria-multiline`, no `aria-required` |
| 6 | Read the footer | real word/character counts, not "0 words · 0 characters" |
| 7 | Empty field | "Nothing written yet." — never "press Edit to start" |
| 8 | The footer button | reads **Back to fields**, not **Done** |

### F31–F33 — Counts, StrictMode, bundle

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type in the editor | the footer count updates; a screen reader is **not** interrupted (`aria-live="off"`) |
| 2 | Run the admin in dev (StrictMode) and open a field | the toolbar renders and stays — `useLiveEditorState` returns `TOOLBAR_INERT` for the destroyed-editor frame instead of throwing during render |
| 3 | `npx nx build admin` and inspect `dist/assets` | the entry chunk is ~255 kB; `editorExtensions-*.js` is ~420 kB |
| 4 | Open a page with no rich-text field | no TipTap chunk is requested |

## 4. Edge Cases & Negative Paths

### The trust boundary (stored XSS)

- **EC-01 — `<img src=x onerror=alert(1)>` in the stored value.** `❌ NONE`
  `renderRichText` parses through the ProseMirror schema, so only declared
  attributes survive; `onerror` is dropped. **Checked and cleared** by reading
  `renderRichText/index.ts:53-69`.
- **EC-02 — `<script>` in the stored value.** `❌ NONE` Not in the schema → dropped.
  (It would not execute via `innerHTML` anyway.)
- **EC-03 — `<a href="javascript:…">`.** `❌ NONE` The Link extension blanks it,
  **and** `flattenLinks` removes the anchor entirely from the preview. Cleared.
- **EC-04 — `<iframe>` / `<object>` / `<embed>` / `<svg onload>`.** `❌ NONE`
  None is a schema node → dropped. Cleared.
- **EC-05 — The **editor** is seeded with the raw value, not the sanitized one.** `❌ NONE`
  `WysiwygEditorPanel` passes `content: initialHtml` (`:391`), i.e. the raw stored
  string. TipTap parses it through the same schema, and modern `@tiptap/core`
  parses via `DOMParser`, so this should be equally inert. **Unverified — I did not
  read `node_modules/@tiptap/core`'s `elementFromString`.** If it ever used
  `div.innerHTML`, an `<img onerror>` would fire while the editor is opening. See
  `🐞 BUG-wysiwyg-admin-01` for the concrete, verified half of this.
- **EC-06 — A `<style>` block or CSS `expression()`.** `❌ NONE` Not a schema node.
  Author-chosen inline colours **are** preserved by design (they are content), which
  is a narrow, attribute-level allowance rather than arbitrary CSS.
- **EC-07 — `data-*` attributes crafted to look like a callout/columns node.** `❌ NONE`
  `parseHTML` matches `aside[data-callout]` / `div[data-columns]` and coerces the
  attributes through `asMediaAlign`-style readers, so a hostile `data-tone` becomes
  a known tone or the default. Cleared.
- **EC-08 — A `src` of `//evil.test/x.png` in stored HTML.** `❌ NONE`
  `isSafeMediaSrc` refuses protocol-relative explicitly (`mediaSrc:162`), on
  **parse** as well as insert. Cleared — this is the pass that protects stored
  content.
- **EC-09 — `renderRichText` runs in a non-DOM environment.** `❌ NONE`
  It calls `window.DOMParser` and `document.createElement` unguarded (`:58, 61`).
  Fine in the browser; it would throw in any SSR or node-side render. Worth knowing
  before anyone reuses the module.

### Non-string and corrupt values

- **EC-10 — The field value is not a string (a number, an object, `null`).** `❌ NONE`
  `isEmptyRichText` returns `false` for a non-string (`richTextValue:115`), so the
  card takes the **content** branch; `renderRichText` returns `''` for a non-string
  (`renderRichText:54`), so it renders an **empty div with a fade** — a card that
  looks like it has content, showing nothing, with no error state.
  `asRichTextHtml` then seeds the editor with `''`, and the first keystroke writes
  the new HTML over the old value. → `🐞 BUG-wysiwyg-admin-01`.
- **EC-11 — The value is well-formed HTML the schema cannot represent** (e.g. a
  `<details>` element). `❌ NONE` Silently dropped from the preview; opening and
  touching the field then persists the lossy version. Same bug, second face.
- **EC-12 — Truncated HTML (`<p>hello`).** `❌ NONE` `DOMParser` recovers; the
  paragraph renders. No crash.
- **EC-13 — Deeply nested markup (10 000 nested `<div>`).** `❌ NONE`
  ProseMirror's parse is iterative for depth in practice, but nothing bounds it. Not
  measured; flagged rather than claimed.
- **EC-14 — Hand-crafted node attributes out of range.** `❌ NONE`
  `width` is coerced: `Number(...)`, `Number.isFinite`, `>= MEDIA_MIN_WIDTH`, else
  `null` (`extensions/media/index.ts:86-94`). So `width="-5"`, `width="0"`,
  `width="1e999"` (→ `Infinity`, not finite) and `width="abc"` all become "no
  explicit width". `width="99999999"` **is** finite and above the floor, so it is
  kept and rendered — the figure is `max-w-full` in the editor, but the stored
  attribute goes out to the published page as-is. Minor; see EC-20.

### Size and performance

- **EC-15 — A 2 MB rich-text body.** `❌ NONE`
  Every keystroke calls `instance.getHTML()` and writes the whole string into the
  entry form (`WysiwygEditorPanel:429`), which re-renders the form. That is an
  O(document) serialize + a full form re-render per character.
  → `🐞 BUG-wysiwyg-admin-02`.
- **EC-16 — The same 2 MB body in the collapsed preview.** `❌ NONE`
  `WysiwygPreview` memoizes on the raw value (`WysiwygPreview:516`), so the
  *surrounding* form re-rendering is cheap — but any change to this field
  re-parses and re-serializes the whole document twice. Only matters while
  collapsed, which is when the value is not changing. Cleared as designed.
- **EC-17 — `EMPTY_DOCUMENT_RE` on a very long string.** `❌ NONE`
  `/^(?:\s|&nbsp;|<p(?:\s[^>]*)?>|<\/p>|<br\s*\/?>)*$/i` — the alternatives are
  disjoint on their first character (`\s`, `&`, `<p`, `</`, `<b`), so there is no
  ambiguity for the `*` to backtrack through. **Checked and cleared: not a ReDoS.**
- **EC-18 — `maxLength` on a `richtext` field.** `❌ NONE`
  Validated server-side against the **HTML** string, tags included; the editor's
  character count is informational and does not cap
  (`editorExtensions:237-241`). So an author can exceed the limit with formatting
  alone and only learn at publish. Documented in the comment; genuinely confusing.

### Paste and interoperability

- **EC-19 — Paste from Microsoft Word.** `❌ NONE`
  Word's clipboard HTML is `<p class=MsoNormal style="...">` plus `<o:p>` and
  `mso-*` CSS. The schema keeps paragraphs, headings, lists and tables; `class` and
  `style` are not schema attributes, so they are dropped — which is the desired
  cleanup. **What is lost with them:** Word list *levels* expressed only through
  `mso-list` styles rather than real `<ul>` nesting, and any `<th>` that Word
  exported as a styled `<td>`. Untested end to end.
- **EC-20 — Paste from Google Docs.** `❌ NONE`
  Docs exports real `<h2>`/`<ul>`/`<table>`, so structure survives; inline `<span
  style="font-weight:700">` becomes plain text unless it maps to a mark. Untested.
- **EC-21 — Paste an image from the clipboard.** `❌ NONE`
  No paste handler for image blobs exists; a pasted screenshot arrives as a
  `data:` URL, which `isSafeMediaSrc` **refuses** (it has a scheme, and `data:` is
  not in the allowlist). So nothing is inserted and nothing is said. A common
  authoring expectation, silently unmet.
- **EC-22 — Round-trip: save, reload, re-save.** `❌ NONE`
  `alt`, `data-decorative`, `data-align`, `width`, `data-tone`, `data-columns` all
  have `parseHTML`/`renderHTML` pairs, so they survive. **Checked** by reading each
  node's attribute definitions. Not asserted by any spec.
- **EC-23 — A locale sibling inherits a shared `richtext` field.** `❌ NONE`
  The i18n extension copies the column value verbatim, so the HTML — alt included —
  travels intact. Nothing here needs to act.

### UI state, focus and concurrency

- **EC-24 — Undo across the collapse/expand transition.** `❌ NONE`
  `WysiwygEditorPanel` is **mounted only while expanded**, so the TipTap history is
  destroyed on collapse. Re-expanding gives a fresh editor with an empty history:
  **Undo cannot reach edits made before the last collapse**, and the toolbar's Undo
  is simply disabled. The record's own form state still holds the value, so nothing
  is lost — but the affordance silently changes meaning across a transition the
  user did not think of as a boundary. → `🐞 BUG-wysiwyg-admin-03`.
- **EC-25 — Navigate away with unsaved rich-text edits.** `❌ NONE`
  Handled: `onUpdate` writes to the form on every keystroke, so the app-wide
  unsaved-changes guard sees the change. **Checked and cleared** — this is the
  explicit reason the design has no Save/Cancel of its own.
- **EC-26 — Expand a field, then switch locale from the sidebar widget.** `❌ NONE`
  `i18n-admin`'s `LocaleWidget` routes through `guard.confirmNavigation`, so the
  unsaved-changes prompt fires. Cleared (see `docs/testing/i18n-admin.md`).
- **EC-27 — Two rich-text fields on one record, both expanded in turn.** `❌ NONE`
  Only one `FullView` is rendered at a time (content-admin owns `expanded`), and
  `editorExtensions(placeholder)` is a **function** so the two never share
  configured extension instances (`editorExtensions:206`). Cleared.
- **EC-28 — Open a menu, then press Escape.** `❌ NONE`
  The menu closes and the editor stays — the reason there is deliberately no
  Escape handler on the view. Cleared.
- **EC-29 — Resize handle drag with the right mouse button.** `❌ NONE`
  `if (event.button !== 0) return` (`MediaNodeView:81`). Cleared.
- **EC-30 — A media source's `Source` component unmounting mid-pick.** `❌ NONE`
  Sources are mounted by the **toolbar**, for the editor's whole life, and told
  whether they are `open` — precisely so a dialog does not open into a
  `DropdownMenuContent` being torn down. Cleared.

### 4A. Accessibility & Section 508 Conformance

**This is the highest-risk unit in the repo for Section 508 § 504 (Authoring
Tools).** A CMS's rich-text editor is the machine that decides whether the
organisation's published content can conform at all: 504.2 asks that the tool be
*able* to produce conformant content, 504.2.1 that it preserve accessibility
information, and 504.3 that it *prompt* authors to supply it.

**Baseline:** there is **no `apps/admin-e2e/src/content/wysiwyg-a11y.spec.ts`** and
no dedicated keyboard suite. What exists, inside the feature spec, is two axe scans
(`apps/admin-e2e/src/content/wysiwyg-fields.spec.ts:645` collapsed, `:654`
expanded) and **one** keyboard case (`:663`, "the field is reachable and openable
from the keyboard" — it asserts the surface is focused after opening and nothing
more). Axe cannot see keyboard traps, focus return, roving tabindex, heading-level
skips, or whether a `<th>` carries a `scope`. So the honest position is: **two
snapshots green, conformance unproven, and the single most important question —
can a keyboard user get back out of the editor — is untested.**

Credit where due, verified from source: every toolbar control has an `aria-label`
and toggles carry `aria-pressed` (`ToolbarButton:47-48`); the editing surface is
`role="textbox" aria-multiline aria-required` with a label naming its field
(`WysiwygEditorPanel:413-423`); the read-only variant correctly becomes
`role="region"` and drops `aria-required`; the preview is deliberately left with
**no focusable elements** so the overlay button is safe; the resize handle is a real
`<button>` with arrow-key support; the count is `aria-live="off"` so it does not
talk over the author; and callouts serialize to a real `<aside>`.

#### ♿ A11Y-wysiwyg-admin-01 — Tab is consumed inside tables and lists, and there is no documented way out of the editor
**WCAG:** 2.1.2 No Keyboard Trap (A) · **508:** 504.2, 502.2 · **Verdict: Partially Supports**
**Location:** `packages/wysiwyg/admin/src/lib/infrastructure/editorExtensions/index.ts:31-74` (`StarterKit` + `TableKit`), `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygFieldFullView/index.tsx:33-35` ("There is deliberately no Escape shortcut")
`TableKit` binds Tab/Shift-Tab to next/previous cell and StarterKit's list keymap
binds Tab to sink a list item. **Unverified —** I did not read the keymaps in
`node_modules`, so I cannot state from source whether `goToNextCell` returns
`false` at the last cell (letting Tab fall through to the browser) or swallows it.
What **is** verifiable from this repo's source is the part that decides the
verdict: `WysiwygEditorPanel` installs **no `keydown` handler of its own**, the view
**deliberately refuses Escape**, and nothing anywhere documents an escape gesture.
WCAG 2.1.2 permits a component to consume Tab *provided the user is advised of the
method to move focus away*; no such advice exists in the UI, the placeholder, the
label, or any help text.
**Repro (keyboard only, no mouse):** Tab to the Body card → Enter → the caret lands
at the end of the document → Insert ▸ Table → put the caret in a middle cell →
press Tab repeatedly.
→ Observed: focus walks the table's cells. Escape does nothing. The documented
exits (**Back to fields**, **Done**) are DOM-adjacent to the surface, so
Shift-Tab/Tab from a *non-table* position does reach them — but from inside a table
or a nested list the user must first navigate out of the structure with the arrow
keys, which nothing tells them.
→ Expected: either Tab is not consumed, or the editor advertises its escape (a
visually-hidden instruction on the surface, plus a conventional `Ctrl`/`Cmd`+`M`
toggle, is the standard remedy — ARIA APG's recommendation for exactly this
editor pattern).
**Keyboard / SR experience:** a screen-reader user entering a table hears cells and
has no announced way out; the surface's `aria-label` is "{field} content" and says
nothing about exiting.
**Remediation:** add a `Ctrl+M` / `Cmd+M` "escape the editor" keymap that moves
focus to the **Back to fields** button, and put the instruction in an `sr-only`
description referenced from the textbox's `aria-describedby`.

#### ♿ A11Y-wysiwyg-admin-02 — The toolbar is 20 sequential tab stops between the author and the text
**WCAG:** 2.4.3 Focus Order (A) — advisory; 2.1.1 Keyboard (A) is met · **508:** 504.2 · **Verdict: Supports (with a serious usability caveat)**
**Location:** `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygToolbar/index.tsx:86-90, 128-131` (`role="group"`, not `role="toolbar"` — every control is an ordinary tab stop, and the JSDoc says so)
```tsx
<div role="group" aria-label={intl.formatMessage(messages.toolbar)}>
```
The bar is a `role="group"`, **not** `role="toolbar"`, and the JSDoc explains why:
"the ARIA toolbar pattern promises arrow-key navigation with a single tab stop, and
promising it without implementing it strands screen-reader users. As a group, every
control is an ordinary tab stop." **That reasoning is correct** — a lying
`role="toolbar"` is worse than an honest group, and this is a deliberate, defensible
choice rather than an oversight, which is why the verdict is Supports.
The cost is real all the same: an author who Shift-Tabs backwards out of the
document passes ~20 controls before reaching **Back to fields**, and one who Tabs
forward from the top of the view passes all of them before reaching the text. On a
long-form editor used all day that is the difference between usable and not.
**Remediation:** implement the roving-tabindex toolbar pattern properly (one tab
stop, arrow keys within, Home/End to the ends) and *then* adopt `role="toolbar"` —
the two must land together, exactly as the JSDoc argues.

#### ♿ A11Y-wysiwyg-admin-03 — Alt text is prompted, never required, and the prompt is invisible to a screen-reader author
**WCAG:** 1.1.1 Non-text Content (A) · **508:** 504.3 (prompts), 504.2 · **Verdict: Partially Supports**
**Location:** `packages/wysiwyg/admin/src/lib/infrastructure/extensions/media/MediaNodeView/AltTextPopover/index.tsx:88, 102-125`; `packages/wysiwyg/admin/src/lib/infrastructure/extensions/media/MediaNodeView/index.tsx:139-149`
This is the best-designed part of the unit and still not a Supports. The **prompt
exists**: `needsAlt = !alt && !decorative` renders a warning-tinted chip labelled
"Add alt text" with a `TriangleAlert` icon, and "decorative" is a real recorded
answer (`data-decorative`) rather than an ambiguous empty string — which is more
than most authoring tools do, and directly addresses 504.3.
Two gaps:
1. **Insertion never blocks.** `insertMedia` writes the node with `alt: ''`
   (`extensions/media/index.ts:138-142`); nothing requires the author to answer
   before the image is in the document, and nothing surfaces the outstanding count
   at Save or Publish time. An author can publish a body of ten undescribed images.
2. **The prompt is visual only for the person who most needs it.** Inside the
   editor an un-alt'd image renders `alt={alt || 'Embedded image'}`
   (`MediaNodeView:147`) — a deliberate asymmetry so the *author's* screen reader
   does not meet an unlabelled graphic. The consequence is that a blind author
   hears a perfectly plausible "Embedded image" and gets **no signal that alt is
   missing**: the warning lives in the chip's colour, its icon, and its label, and
   the chip is a separate control they must find. The `needsAlt` state is not on
   the image, not in a live region, and not in the surface's accessible
   description.
**Repro:** insert an image from the library, save, publish. → the stored HTML is
`<img src="…" alt="">` with no `data-decorative` — i.e. "nobody wrote this yet",
published.
**Remediation:** carry the missing-alt state into the image's own accessible name
inside the editor (e.g. `alt="Image — alt text missing"`), announce it in a polite
live region on insert, and add an outstanding-alt count to the publish gate the
way `required` fields already block.

#### ♿ A11Y-wysiwyg-admin-04 — Video is inserted as a bare `<video controls>`; captions, subtitles and audio description cannot be authored at all
**WCAG:** 1.2.2 Captions (Prerecorded) (A), 1.2.3 Audio Description or Media Alternative (A) · **508:** 503.4, 504.2 · **Verdict: Does Not Support**
**Location:** `packages/wysiwyg/admin/src/lib/infrastructure/extensions/media/MediaNodeView/index.tsx:136-138`, node definition at `.../extensions/media/index.ts` (`ResizableVideo`), embed contract at `.../presentation/slots/wysiwygSlots/index.ts:29-42`
```tsx
{isVideo ? (
    <video src={src} controls className="block" />
) : ( … )}
```
The node's attribute set is `src` / `width` / `align` — inherited from
`sizingAttributes()`, with `alt` and `decorative` added **only** to
`ResizableImage`. There is no `track` child, no `captions` attribute, no
`crossorigin`, and `WysiwygMediaEmbed` (the slot contract every source must satisfy)
carries only `{ kind, src, alt?, width? }` — so even a media source that *had* a
caption file could not pass it in.
**Repro:** Insert ▸ Media ▸ Media Library… → pick an MP4 → save.
→ Observed: `<video src="/api/media/assets/<id>/raw" controls></video>` in the
stored body. There is no control anywhere in the editor, the alt popover, or the
insert dialogs that mentions captions.
→ Expected: an authoring path to a `<track kind="captions" srclang label src>`, and
a prompt when none is present (504.3, the same treatment images get).
**Keyboard / SR experience:** a deaf or hard-of-hearing reader of the published page
receives audio-only information. `<video controls>` gives native keyboard controls,
so 2.1.1 is met for playback; there is simply nothing to caption with. This is the
editor half of a two-part failure — the other half is that `media_asset` cannot
store a caption file either (`♿ A11Y-media-server-02`), so the fix spans both units.
**Remediation:** add a `tracks` attribute to `ResizableVideo` serializing to
`<track>` children, extend `WysiwygMediaEmbed` with an optional `tracks` array, and
add a captions control to the node view mirroring `AltTextPopover` — including its
warning chip when a video has none.

#### ♿ A11Y-wysiwyg-admin-05 — Heading levels can be skipped freely, and the editor offers H1 inside a page that already has one
**WCAG:** 1.3.1 Info and Relationships (A), 2.4.6 Headings and Labels (AA) · **508:** 504.2 · **Verdict: Partially Supports**
**Location:** `packages/wysiwyg/admin/src/lib/infrastructure/editorExtensions/index.ts:19, 34` (`HEADING_LEVELS = [1, 2, 3, 4]`), `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygToolbar/BlockTypeMenu/index.tsx:60-80`
The block-type menu offers Paragraph and H1–H4 as a flat, always-enabled list. An
author can turn a paragraph following an `<h2>` straight into an `<h4>`, or into a
second `<h1>` — and the expanded view itself renders the field label as an `<h2>`
(`WysiwygFieldFullView:267`), so an `<h1>` typed in the body is a level jump inside
the record page too. Nothing warns, and the stored HTML is what gets published.
**Repro:** expand Body → type two lines → make the first H2 and the second H4 →
save. → the stored body contains `<h2>` then `<h4>`, with no `<h3>`.
→ Expected: at minimum a non-blocking warning; ideally the menu greys out levels
more than one below the preceding heading, and omits H1 (a page's `<h1>` is the
record title, not a body block).
**Keyboard / SR experience:** heading navigation (a primary screen-reader
wayfinding mechanism) reports a structure that misdescribes the document, and
"skipped level" is one of the most common real-world audit findings.
**Remediation:** drop `1` from `HEADING_LEVELS` (or make it opt-in per field), and
add an inline advisory in the block-type menu when the chosen level skips one.

#### ♿ A11Y-wysiwyg-admin-06 — Tables get real `<th>` cells but no `scope` and no caption, and there is no way to add either
**WCAG:** 1.3.1 Info and Relationships (A) · **508:** 504.2 · **Verdict: Partially Supports**
**Location:** `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygToolbar/InsertMenu/TableItems/index.tsx:50, 76` (`INITIAL_TABLE = { rows: 3, cols: 3, withHeaderRow: true }`), asserted at `apps/admin-e2e/src/content/wysiwyg-fields.spec.ts:285`
The default insert is genuinely good: `withHeaderRow: true` means the first row is
`<th>` rather than `<td>`, and the e2e pins `expect(body).toContain('<th')`. That is
the hard half of 1.3.1 for data tables and it is done.
What is missing: TipTap's `TableHeader` renders `<th colspan rowspan colwidth>` with
**no `scope`**, so a screen reader must infer the association; there is **no
`<caption>`** and no UI to add one; and there is no control to mark a *column*
header (only the first row is `<th>`), so a table whose headers run down the left
edge cannot be expressed. The submenu offers add/remove row and column but no
header toggle.
**Repro:** insert a table, save, inspect the stored HTML.
→ Observed: `<table><tbody><tr><th colspan="1" rowspan="1" colwidth="…">…`
→ Expected: `scope="col"` on the header row (and `scope="row"` where applicable),
plus an authorable `<caption>`.
**Keyboard / SR experience:** cell-by-cell table navigation announces header text by
proximity heuristics rather than by declared association — usually right for a
simple table, unreliable as soon as a cell spans.
**Remediation:** extend the `TableHeader` extension's `renderHTML` to emit
`scope="col"` (and `scope="row"` for a first-column header mode), add a "Header
row / Header column" toggle to the table submenu, and add a caption field.

#### ♿ A11Y-wysiwyg-admin-07 — No mechanism to mark the language of a passage
**WCAG:** 3.1.2 Language of Parts (AA) · **508:** E205.4 · **Verdict: Does Not Support**
**Location:** `packages/wysiwyg/admin/src/lib/infrastructure/editorExtensions/index.ts:31-74`
The extension list has no `lang` mark and the toolbar has no control for one, so a
body containing a quotation in another language cannot declare it. `grep -rn
"lang=" packages/wysiwyg` returns nothing. The published HTML therefore inherits
whatever `lang` the consuming page sets — and the admin's own preview inherits
`<html lang="en">`, which `apps/admin/index.html:2` hardcodes and never updates,
so even a German entry's body is announced with an English voice in the CMS.
**Repro:** type an English paragraph, then a French sentence; save; inspect. → no
`lang` anywhere. Open the record with a screen reader → the French is read with
English pronunciation rules.
**Remediation:** add a `lang` mark (a `<span lang="…">` mark with a small language
picker in the More-formatting menu), and set the preview container's `lang` from
the entry's locale — which requires `i18n-admin` to expose it (see
`♿ A11Y-i18n-admin-01`).

#### ♿ A11Y-wysiwyg-admin-08 — Focus placement on expand is right; focus **return** on collapse is unspecified
**WCAG:** 2.4.3 Focus Order (A) · **508:** 502.2 · **Verdict: Unverified**
**Location:** `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygEditorPanel/index.tsx:90` (`autofocus: readOnly ? false : 'end'`), `.../WysiwygFieldFullView/index.tsx:55-58` (`collapse`)
On **expand**, focus lands in the document — correct, deliberate, and asserted
(`wysiwyg-fields.spec.ts:672`, `toBeFocused()` on the surface). On **collapse**,
`collapse()` calls `setExpanded(false)` and `onBlur?.()` and **does nothing about
focus**; content-admin re-renders the tab strip and form. Where focus lands is
therefore whatever the browser does with a removed active element — typically
`<body>`. I did not run the app to confirm, so this is **Unverified**, but no code
in this package moves focus back to the field's button, and no spec asserts it.
**Repro (to run):** open the field from the keyboard, press **Done**, then Tab.
→ Expected: focus on the "Edit Body" button, so the next Tab continues through the
form.
**Remediation:** have `WysiwygFieldControl` focus its button when `expanded` goes
false, mirroring the dialog-close restoration pattern the design system already
implements elsewhere.

#### ♿ A11Y-wysiwyg-admin-09 — Reduced motion, forced colours, and contrast in both themes are unverified for the editor surface
**WCAG:** 1.4.3 Contrast (AA), 1.4.11 Non-text Contrast (AA), 1.4.12 Text Spacing (AA), 1.4.10 Reflow (AA) · **508:** 503.2, E205.4 · **Verdict: Unverified**
**Location:** `packages/wysiwyg/admin/src/styles.css`, `.../MediaNodeView/index.tsx:130` (`outline-2 outline-offset-2 outline-ring` on selection), `.../AltTextPopover/index.tsx:110` (`border-warning bg-warning-soft text-warning-soft-foreground`)
The stylesheet takes colours from the app's `--color-*` tokens, so it should follow
light/dark — but **colours the author picked are inline and stay put** by design
(they are content). That is the right call for published output and means the
editor can display author text at any contrast, including unreadable, with no
warning. The warning chip's `warning-soft` pairing and the media selection outline
are not covered by the two axe scans (both run on states without a selected image
or a warning chip). `grep -rn "motion-reduce" packages/wysiwyg/admin` → no matches.
**Remediation:** extend the a11y suite to scan the expanded editor with an image
selected, a warning chip visible, and every menu open, in both themes; consider a
contrast advisory in the colour menu, since author-chosen colour is exactly where
a CMS can help an author not publish a 508 failure.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 collapsed preview | `apps/admin-e2e/src/content/wysiwyg-fields.spec.ts:80` | stored HTML renders as content, not markup | ✅ E2E |
| F2 sanitization | — | — | ❌ NONE — **no spec feeds hostile HTML through the preview**; the trust boundary the AGENTS.md calls the plugin's most important property is unasserted |
| F3 link flattening | `wysiwyg-fields.spec.ts:99` | "offers no link to fall into on the way to the editor" | ✅ E2E |
| F4 open button | `wysiwyg-fields.spec.ts:136`, `:663` | pressing takes over the work area; keyboard-reachable and openable | ✅ E2E |
| F5 placeholder | `wysiwyg-fields.spec.ts:111` | the field placeholder shows while empty | ✅ E2E |
| F6 textarea opt-out | `wysiwyg-fields.spec.ts:120` | an opted-out field keeps a plain textarea | ✅ E2E |
| F7 expanded view | `wysiwyg-fields.spec.ts:136`, `:153` | caret in the text; record and chrome stay on screen | ✅ E2E |
| F8 two exits | `wysiwyg-fields.spec.ts:183` | both return to the form | ✅ E2E |
| F9 live write-back | `wysiwyg-fields.spec.ts:198` | edits reach the form as they are made | ✅ E2E |
| F10 empty normalisation | `wysiwyg-fields.spec.ts:333` | an emptied field stores `''`, not a blank paragraph | ✅ E2E |
| F11 one-row toolbar | `wysiwyg-fields.spec.ts:171` | children grouped by vertical **centre** stay on one row | ✅ E2E |
| F12 marks | `wysiwyg-fields.spec.ts:216` | the applied formatting is in the saved HTML | ⚠️ PARTIAL — `aria-pressed` state is never asserted |
| F13 headings | `wysiwyg-fields.spec.ts:216` (indirectly) | — | ⚠️ PARTIAL — no per-level case, no skip case |
| F14 font size | — | — | ❌ NONE |
| F15 colour/highlight | `wysiwyg-fields.spec.ts:216` (indirectly) | — | ⚠️ PARTIAL |
| F16 alignment | `wysiwyg-fields.spec.ts:290`, `:476` | paragraph `text-align`; a selected image centres via `data-align` | ✅ E2E |
| F17 more marks | — | — | ❌ NONE |
| F18 links | — | — | ❌ NONE — neither the popover nor the `rel`/`javascript:` handling is driven |
| F19 tables | `wysiwyg-fields.spec.ts:266` | `<table`, `<th`, three `<tr>` in the saved HTML | ✅ E2E |
| F20 columns | `wysiwyg-fields.spec.ts:313` | nested divs in the saved HTML | ✅ E2E |
| F21 callouts | `wysiwyg-fields.spec.ts:241` | `<aside data-tone="warning" data-callout="">` — semantic, not admin classes | ✅ E2E |
| F22 divider | — | — | ❌ NONE |
| F23 media by URL | `wysiwyg-fields.spec.ts:378`, `:409` | an image named by URL is stored; a refused URL inserts nothing | ✅ E2E |
| F24 media slot | `wysiwyg-fields.spec.ts:354` | contributed sources appear beside the built-in URL entry | ✅ E2E |
| F25 `src` vetting | `wysiwyg-fields.spec.ts:409` | a `javascript:` URL is refused | ⚠️ PARTIAL — protocol-relative and the **parse**-time pass are untested |
| F26 resize | `wysiwyg-fields.spec.ts:449` | resized **from the keyboard**, and the width is stored | ✅ E2E |
| F27 media align | `wysiwyg-fields.spec.ts:476` | where it sits is stored | ✅ E2E |
| F28 alt text | `wysiwyg-fields.spec.ts:515`, `:549`, `:608` | prompts and stores what the author writes; decorative recorded as answered; a library asset's alt carries in | ✅ E2E |
| F29 overlay submit | `wysiwyg-fields.spec.ts:578` | "never saves the record from an overlay's own form" — three overlays | ✅ E2E |
| F30 read-only | `apps/admin-e2e/src/content/entry-read-only.spec.ts` | the read-only entry editor generally | ⚠️ PARTIAL — the **View** variant's no-toolbar / `role="region"` / real-count behaviour is not asserted in the wysiwyg spec |
| F31 counts | — | — | ❌ NONE |
| F32 StrictMode guard | — | — | ❌ NONE — the bug `useLiveEditorState` exists to prevent (the toolbar vanishing) is unpinned |
| F33 lazy boundary | — | — | ❌ NONE — the ~255 kB entry-chunk guard is prose, not a check |
| **a11y** | `wysiwyg-fields.spec.ts:645`, `:654`, `:663` | axe on the collapsed field and the expanded editor; one keyboard-reachability case | ⚠️ PARTIAL — **no keyboard-trap test, no focus-return test, no menu/dialog scan, no dark-theme scan, no heading/table semantics assertion** |

**Coverage tally:** `33 features · 18 ✅ · 7 ⚠️ · 8 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-wysiwyg-admin-01 — A `richtext` value that is not a string renders as a blank card with no error state, and the first edit destroys it · Severity: Medium

**Location:** `packages/wysiwyg/admin/src/lib/domain/richTextValue/index.ts:29-33, 41-48`; `packages/wysiwyg/admin/src/lib/infrastructure/renderRichText/index.ts:53-54`; `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygFieldControl/index.tsx:94, 108`
**Category:** data-loss / ux-state

**What the code does:**
```typescript
export function isEmptyRichText(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value !== 'string') return false;   // ← a non-string is "not empty"
    return EMPTY_DOCUMENT_RE.test(value);
}
export function asRichTextHtml(value: unknown): string {
    return typeof value === 'string' ? value : '';  // ← a non-string is ""
}
```
and
```typescript
export function renderRichText(value: unknown): string {
    if (typeof value !== 'string' || value === '') return '';  // ← a non-string is ""
```
The three disagree. For a non-string value the control takes the **content**
branch (`empty === false`), so it renders the preview container plus the
gradient fade — but `renderRichText` returns `''`, so the container is empty. The
user sees a card that looks like it holds something, showing nothing, with **no
"unreadable content" state**. Expanding seeds the editor with `''`
(`WysiwygFieldFullView:296` → `asRichTextHtml`), and the first keystroke calls
`onChangeRef.current(normalizeRichText(instance.getHTML()))`
(`WysiwygEditorPanel:429`), writing the new HTML over whatever was stored.

**Why it is wrong:** the three functions are the plugin's own definition of what a
value *is*, and they are inconsistent about the one case they all guard for. The
design intent is explicit — `isEmptyRichText` is documented as "Defined as what
empty *is*" precisely so an unrecognised shape counts as content and is not thrown
away on save — but the rendering path then throws it away anyway, silently, and
the collapsed card gives the author no reason to think anything was there.

**Repro:**
1. Write a non-string into a `richtext` column — e.g. via a data migration, a
   restored backup from a schema where the field was `json`, or
   `UPDATE content_article SET body = '123'` (the column is `text`, so a numeric
   string is a string; the reachable case is a **stale revision snapshot** whose
   jsonb `values.body` is an object, restored through
   `POST .../revisions/:n/restore`).
2. Open the record.
→ Observed: a Body card of the right height, empty, with a fade at the bottom and
an "Edit" chip. No error, no placeholder.
3. Expand it and type one character, then Save.
→ Observed: the stored value is now `<p>x</p>`; the previous value is gone (a
revision preserves it, but nothing told the author to look).
→ Expected: either the empty state (if a non-string is "nothing"), or an explicit
"this field's stored value could not be read" state that refuses to overwrite.

**Blast radius:** narrow — it needs a non-string to reach the column, which the
normal write path prevents. But the failure mode is silent overwrite of content, in
the field that carries the most content, which is why it is Medium rather than Low.

**Suggested fix:** make the three agree. Have `WysiwygFieldControl` detect
`value != null && typeof value !== 'string'` and render an explicit unreadable
state with the editor disabled, rather than letting `asRichTextHtml`'s `''`
fallback silently become the new truth.

---

### 🐞 BUG-wysiwyg-admin-02 — Every keystroke serializes the whole document and writes it into the entry form · Severity: Medium

**Location:** `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygEditorPanel/index.tsx:117-122`
**Category:** perf

**What the code does:**
```typescript
onUpdate: ({ editor: instance }) => {
    if (readOnly) return;
    onChangeRef.current(normalizeRichText(instance.getHTML()));
}
```
`instance.getHTML()` re-serializes the entire ProseMirror document to a string on
**every** transaction, and `onChange` writes that string into the entry form's
state, re-rendering the form (and therefore the Properties rail, the publish gate,
and every other field's control) once per character. `normalizeRichText` then runs
the empty-document regex over the full string as well.

**Why it is wrong:** the design decision this implements is right — "Edits are
written to the form as they're made … the record's own Save stays the only commit
boundary" — but it is implemented with no debounce and no incremental path. The
cost is O(document) per keystroke, and rich-text bodies are the largest values a
CMS holds. Nothing in the plugin bounds document size either: `maxLength` on a
`richtext` field is validated server-side at publish, and `CharacterCount` is
explicitly informational (`editorExtensions:237-241`).

**Repro:**
1. Paste ~2 MB of prose (a book chapter, or a long docs page) into a Body field.
2. Type continuously in the middle of it and watch the profiler.
→ Observed: a `getHTML()` serialize plus a full entry-form re-render per keystroke;
input latency grows with document length until typing visibly lags.
→ Expected: the write debounced (say 150–300 ms) or coalesced, so latency is
independent of length.

**Blast radius:** long-form authoring — precisely this plugin's use case. No data
risk; the value is correct, just expensively computed.

**Suggested fix:** debounce the `onChange` write, flushing on blur and on
`collapse()` so the unsaved-changes guard and Save still see the latest value.

---

### 🐞 BUG-wysiwyg-admin-03 — Undo history is destroyed on every collapse, so Undo silently stops reaching earlier edits · Severity: Low

**Location:** `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygEditorPanel/index.tsx:81-123` (the editor is created per mount), `packages/wysiwyg/admin/src/lib/presentation/components/WysiwygFieldControl/index.tsx:165` / `.../WysiwygFieldFullView/index.tsx:55-58` (the view mounts only while expanded)
**Category:** ux-state

**What the code does:** `WysiwygFieldFullView` renders `WysiwygEditorPanel` only
while the field is expanded — content-admin unmounts it on collapse. `useEditor`
therefore constructs a **new** editor, with a fresh `history` plugin, on every
expand. The design note is explicit and correct about *why*: "The view mounts only
while expanded, so the editor is seeded from the value once at mount and owns its
state from then on — no controlled-content sync, and none of the caret-jumping that
comes with one." Undo history is the unremarked casualty.

**Why it is wrong:** collapse is not, to the author, a commit — the record has not
been saved, the Save button is still sitting in the top bar, and the plugin's own
documentation stresses that "leaving the view — by either exit — can never lose
work." Undo is the one operation for which leaving the view *does* lose something.
Worse, it is silent: the Undo button is simply `disabled` on re-entry, which reads
as "there is nothing to undo" rather than "the history was discarded."

**Repro:**
1. Expand Body, type a paragraph, press **Done**.
2. Expand Body again and press **Undo** (or `Ctrl+Z`).
→ Observed: Undo is disabled; the paragraph cannot be undone from the editor. The
browser-level undo does not reach it either (the field is not an `<input>`).
→ Expected: either the history survives the transition, or the author is not
offered an Undo control that cannot reach the edit they just made.

**Blast radius:** annoyance, recoverable via the record's revision history. It bites
hardest in the exact flow the design encourages — expand, edit, collapse to check
the rail, expand again.

**Suggested fix:** either keep the editor mounted (hidden) while the field is
"collapsed but touched", or persist the ProseMirror history state across the
transition; failing both, note the boundary in the view's copy so the disabled Undo
is not read as "nothing happened".

---

### 🐞 BUG-wysiwyg-admin-04 — A pasted image silently does nothing · Severity: Low

**Location:** `packages/wysiwyg/admin/src/lib/infrastructure/editorExtensions/index.ts:31-74` (no `handlePaste`/`editorProps.handleDrop` anywhere in the package — grep confirms zero matches for `handlePaste`), `packages/wysiwyg/admin/src/lib/domain/mediaSrc/index.ts:27-43`
**Category:** ux-state

**What the code does:** `isSafeMediaSrc` allows `http:`/`https:` and same-origin
paths and refuses everything else — including `data:`. There is no `handlePaste`
anywhere in the extension list, so a clipboard image has no path into the document
at all: pasting a screenshot yields either nothing, or HTML whose `src` is a
`data:` URL that `parseHTML` empties (`extensions/media/index.ts:78-83`), leaving a
node with `src=""`.

**Why it is wrong:** the refusal is correct — a `data:` URL in stored content is
exactly the kind of value the trust boundary exists to keep out, and inlining
megabytes of base64 into a `richtext` column would be worse. The bug is that
nothing **says so**. The URL dialog explains a refusal ("The dialogs check it to
explain *why* nothing happened" — AGENTS.md), and paste, the far more common
gesture, does not. Pasting a screenshot into a body is a baseline expectation of
every modern editor, and here it fails silently.

**Repro:** copy an image to the clipboard (screenshot tool, or right-click → Copy
image), put the caret in a Body field, press `Ctrl+V`.
→ Observed: nothing appears, and nothing is said.
→ Expected: the image is uploaded through the media slot and inserted, or a message
explaining that images must be added via **Insert ▸ Media**.

**Blast radius:** authoring friction; users conclude the editor is broken.

**Suggested fix:** add a `handlePaste`/`handleDrop` that routes image files to the
registered `WYSIWYG_MEDIA_SLOT` upload source when one exists, and shows an
explanatory message when none does.

---

**Tally:** 4 🐞 — 0 Critical, 2 Medium, 2 Low.
**♿ tally:** 9 — 1 Supports · 4 Partially Supports · 2 Does Not Support · 0 Not Applicable · 2 Unverified.

**Checked and cleared:** `renderRichText` genuinely parses out of an inert
`DOMParser` document and re-serializes from schema nodes, so event handlers and
undeclared attributes are dropped and the Link protocol allowlist is the same
definition as "what the editor can write"; `flattenLinks` genuinely leaves the
preview with no focusable elements, which is what makes the overlay button legal;
`EMPTY_DOCUMENT_RE` is not vulnerable to catastrophic backtracking (its alternatives
are disjoint on the first character); `isSafeMediaSrc` refuses protocol-relative
`//host/…` on **parse** as well as insert; `width` coercion rejects negative, zero,
non-finite and non-numeric values; media sources are mounted by the toolbar rather
than by the menu item, so a picker never opens into a tree being torn down; all
three overlay `<form>`s call `stopPropagation` on submit; `editorExtensions` is a
function so two fields on one record never share configured instances; `TrailingNode`
is not double-registered; the unsaved-changes guard is reached because edits land in
the form on every keystroke; and every toolbar control has an accessible name with
`aria-pressed` on toggles only.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` mock | **`src/content/wysiwyg-keyboard.spec.ts`** (new) | a mouse-free journey: Tab to the field → Enter → type → Tab **out** of a table and out of a nested list → reach **Back to fields** → press it → assert focus returns to the "Edit Body" button; assert no state where Tab cannot leave the surface | ♿ A11Y-wysiwyg-admin-01, ♿ A11Y-wysiwyg-admin-08, F32 ❌ |
| 2 | `apps/admin-e2e` | **`src/content/wysiwyg-a11y.spec.ts`** (new), using `support/a11y.ts` | axe over the expanded editor with: each of the three menus open, the link popover open, the alt popover open (both warning and neutral states), the media URL dialog open, an image selected, and a table focused — in **both** themes | ♿ A11Y-wysiwyg-admin-09, the ⚠️ a11y row |
| 3 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | seed the field with `<img src=x onerror="…">`, `<script>`, `<iframe>`, `<a href="javascript:…">`, `<svg onload>` and a `//host/x.png` image; assert the rendered preview contains none of them and that no dialog/alert fires | F2 ❌, EC-01…EC-08 |
| 4 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | insert a table → assert the saved HTML carries `scope="col"` on header cells; make an H2 then an H4 → assert a level-skip advisory is shown | ♿ A11Y-wysiwyg-admin-05, ♿ A11Y-wysiwyg-admin-06, F13 ⚠️ |
| 5 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | insert a video → assert a captions control exists and that the saved HTML carries a `<track>` when one is supplied; assert an un-captioned video shows a warning chip | ♿ A11Y-wysiwyg-admin-04 |
| 6 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | insert an image and **do not** describe it → assert the editor's own accessible name signals the gap (not "Embedded image"), and that a polite live region announces it | ♿ A11Y-wysiwyg-admin-03 |
| 7 | package unit (`*.spec.ts` beside the source, jsdom) | `src/lib/domain/richTextValue.spec.ts` | `isEmptyRichText` / `normalizeRichText` / `asRichTextHtml` agree on `null`, `undefined`, `''`, `'<p></p>'`, `'<p><br></p>'`, whitespace, a number, an object, an array | 🐞 BUG-wysiwyg-admin-01 |
| 8 | package unit (jsdom) | `src/lib/infrastructure/renderRichText.spec.ts` | the sanitizer as a pure function over the hostile corpus from row 3, plus a round-trip case proving `alt`, `data-decorative`, `data-align`, `width`, `data-tone`, `data-columns` all survive save → parse → re-serialize | EC-22, F2 ❌ |
| 9 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | paste Word-flavoured and Google-Docs-flavoured HTML; assert headings, list nesting and table header cells survive and that `mso-*`/`class` do not | EC-19, EC-20, 508 504.2.1 |
| 10 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | expand → type → **Done** → expand → assert Undo either reaches the edit or is accompanied by an explanation | 🐞 BUG-wysiwyg-admin-03 |
| 11 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | link popover: a normal URL stores `rel="noopener noreferrer nofollow"`; `javascript:` is blanked; clicking a link in the editor does not navigate | F18 ❌ |
| 12 | build check (CI script, not a spec) | `tools/check-entry-chunk.mjs` | the admin's entry chunk stays under a threshold and `editorExtensions-*.js` exists as a separate chunk | F33 ❌ |
