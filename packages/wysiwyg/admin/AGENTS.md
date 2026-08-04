# @ortha-cms/wysiwyg-admin

The **rich-text editing plugin** for the Ortha CMS admin UI. It owns how a
`richtext` field looks and behaves in the entry form: the field shows the
content **as it reads**, and pressing it opens a full-size
[TipTap](https://tiptap.dev) editor with the formatting toolbar — text style and
size, colors and highlights, alignment, lists, links, callouts, tables, and
column layouts.

It is **not a place in the app**. It contributes no route, no navigation entry,
and no page. Its entire surface is one contribution to content-admin's
`ENTRY_FIELD_CONTROL_SLOT`, which is why it appears everywhere an entry form
does — a collection's records editor and a single (page) alike, on the General
tab and inside a localized type's Translated/Shared groups — without knowing
about any of them.

There is **no server counterpart**. `richtext` is an existing content field type
(`@ortha-cms/content-server`) that already stores HTML in a text column; this
plugin changes the *control*, not the schema, the wire format, or the API.

## Which fields it claims

Every `richtext` field, **by default**. A rich-text field that renders as a raw
HTML textarea is exactly what this plugin exists to replace, and requiring an
opt-in would leave the old control on every schema written before it existed.

The opt-out is per field, in the content schema:

```ts
// packages/…/your-collection.ts
body: field.richtext({ admin: { label: 'Body' } }), // → the WYSIWYG
raw: field.richtext({ admin: { widget: 'textarea' } }) // → content-admin's textarea
```

`widget: 'textarea'` is for a body that isn't authored prose — a hand-maintained
snippet, an email template, anything the author edits *as markup* on purpose,
which a WYSIWYG would reformat the moment it opened. `widget: 'wysiwyg'` is
accepted too, so a schema can state the intent rather than rely on the default.
Both live in `WYSIWYG_WIDGET` (the plugin's only other export).

## Layout — layered (ADR-0003)

Written layered from the start, like `content/admin`:

- **`domain/`** — pure TS, no React and no TipTap. `constants` (the widget
  values, callout tones, the color/size palettes, the prose class) and
  `richTextValue` (what "empty" means for a stored value, and the storage
  normalization that follows from it).
- **`infrastructure/`** — the TipTap layer. `editorExtensions` (the one place
  that decides what an author can write), `extensions/callout` +
  `extensions/columns` (nodes TipTap doesn't ship), and `renderRichText` (the
  read-only renderer — see **Trust boundary** below).
- **`presentation/`** — React. `wysiwygPlugin` (the `AdminPlugin` factory),
  `components/WysiwygFieldControl` (what the slot mounts), `WysiwygPreview`,
  `WysiwygEditorDialog`, and `WysiwygToolbar` with a folder per menu.

## Four decisions worth knowing before you change anything

### 1. Trust boundary: the preview never renders the stored HTML as-is

A `richtext` value is whatever some other CMS user typed, pasted, or wrote
straight through the API, and a preview renders it as **markup**. Handing that
string to `dangerouslySetInnerHTML` unchecked would make every rich-text field a
stored-XSS vector against anyone who opens the record: `<script>` doesn't run
via `innerHTML`, but `<img src=x onerror=…>` does, and a contributor could aim
it at an admin.

So `renderRichText` round-trips the value through the **editor's own ProseMirror
schema** — parsed out of an inert `DOMParser` document, re-serialized from the
parsed nodes. Only what the schema declares survives; event handlers are
dropped, and the Link extension blanks any href outside its protocol allowlist
(`javascript:`). The allowlist is therefore the *same definition* as "what this
editor can write", so the preview is exactly what the author sees with the
dialog open. A hand-kept tag list would be a second definition, free to drift.

**If you add a node or mark to `editorExtensions`, the preview supports it the
same day.** If you ever render rich text somewhere else, go through
`renderRichText` — never `innerHTML` on a raw value.

### 2. The control is a button *beside* the preview, not around it

Wrapping formatted content in a `<button>` puts headings, lists, and tables
inside a control — invalid HTML, and it flattens the whole body into the
button's accessible name. Instead the preview renders as ordinary content and a
transparent button is laid over it (`absolute inset-0`): assistive tech reads
the content, then offers one clearly-named action, and a pointer anywhere on the
card still opens the editor.

That only holds because `renderRichText` **flattens links to spans**, leaving no
focusable elements in the preview. A live `<a>` under the button would be a tab
stop the reader falls into on their way to it — and pressing it would navigate
out of the record. Don't "fix" the flattening.

The button carries the field's `id` (content-admin's `<label for>` points at
it), so its name is set with `aria-label`: a native label outranks a button's
own contents, which left it announcing just "Body". It carries no
`aria-invalid`/`aria-required` — neither applies to a button — so the error
reaches AT through `aria-describedby`, pointing at the `<FieldError>`
content-admin renders below.

### 3. Edits are written to the form as they're made

The dialog has no Save/Cancel. `onUpdate` writes straight back to the entry form
through the slot's `onChange`, exactly like typing in any other field, and the
record's own Save (plus the unsaved-changes guard) stays the only commit
boundary. That is what makes **every** way out of the dialog safe — Done, the ✕,
Escape, a click outside — instead of Escape being a work-losing trap.

The dialog panel mounts only while open (Radix unmounts its portal), so the
editor is seeded from the value once at mount and owns its state from then on.
There is no controlled-content sync, and therefore none of the caret-jumping
that comes with one.

### 4. "Empty" is defined as what empty *is*

`isEmptyRichText` matches the exact markup an emptied editor leaves behind —
paragraph wrappers, `<br>`, whitespace — and calls **everything else** content.
It is deliberately not the inverse rule ("no text and no `<img>/<hr>/<table>`"),
which has to name every element that can carry meaning without carrying words,
and will always be one short: it was, and a column layout the author had just
inserted but not yet typed into read as empty and was thrown away on save.

The normalization matters beyond that bug — a `required` field whose editor was
cleared has to fail validation, and it only does if what we store is `''` rather
than `<p></p>`.

## Bundle: keep TipTap out of the entry chunk

A plugin factory runs at boot — it has to, or its slot contribution isn't
registered before the first render — so anything it imports **statically** lands
in the app's entry chunk. TipTap and ProseMirror are ~460 kB of that, for a
control that only ever renders inside an entry editor (itself already behind a
lazy route).

So `wysiwygPlugin` reaches the control through `React.lazy`, and `src/index.ts`
exports **nothing but** `WysiwygPlugin` and `WYSIWYG_WIDGET`. Re-exporting the
preview or the dialog from the entry point would pull TipTap straight back in.
The guard is a number: the admin's entry chunk is ~255 kB, and
`WysiwygFieldControl-*.js` is ~460 kB of its own. If a change moves the first
number, the lazy boundary has been broken.

## Styling: one scope, shared by the editor and the preview

`src/styles.css` hangs everything off `.ortha-wysiwyg`, which the editor surface
and every preview both carry. The host imports it once
(`apps/admin/src/styles.css`), after the design-system's.

It is a stylesheet rather than Tailwind classes on components for two reasons.
Most of these elements are produced by ProseMirror from stored HTML, so there is
no JSX to put a `className` on — the alternative is baking admin class names
into `renderHTML`, which writes this app's styling into content that gets
published elsewhere. And the editor and preview **must** render identically;
sharing one scope makes that structural instead of a thing to keep in sync.

Colors come from the app's `--color-*` theme tokens, so the editor follows
light/dark. Colors the *author* picked (text color, highlight) are inline on the
content and stay put — those are content, not chrome. Same principle in the
custom nodes: a callout serializes to `<aside data-callout data-tone="warning">`
and a layout to `<div data-columns="3">`, so the consuming site styles the
structure however it likes.

## Adding a control

1. Add the extension to `infrastructure/editorExtensions` (or a new node under
   `infrastructure/extensions/`, if TipTap doesn't ship one).
2. Add a folder under `presentation/components/WysiwygToolbar/`, with its own
   co-located `defineMessages`. Reuse `ToolbarButton` (toggles/actions) or
   `ToolbarMenuTrigger` (dropdowns) so the bar stays one shape.
3. Subscribe to only the state you need with `useEditorState` — each menu owns
   its own slice, so the bar's shared selector doesn't become the thing every
   menu re-renders through.
4. Both must `preventDefault` on `mousedown`. Otherwise pressing the control
   moves focus out of the editor, collapsing the selection the command was about
   to act on — the classic "I selected a word, hit Bold, nothing happened".
5. If it introduces a new element in the stored HTML, style it in
   `src/styles.css` under `.ortha-wysiwyg`.

The bar is a `role="group"`, not `role="toolbar"`, on purpose: the ARIA toolbar
pattern promises arrow-key navigation with a single tab stop, and promising it
without implementing it strands screen-reader users. As a group, every control
is an ordinary tab stop.

## Commands

- `npx nx typecheck @ortha-cms/wysiwyg-admin`
- `npx nx lint @ortha-cms/wysiwyg-admin`
- `npx nx e2e admin-e2e -- --project=chromium wysiwyg-fields` — the suite that
  covers this plugin (`apps/admin-e2e/src/content/wysiwyg-fields.spec.ts`),
  including two axe scans and the saved-HTML assertions. The visible editor is
  only half the feature; what gets **stored** is the other half, and only the
  request body shows that — so a change here should be provable in that spec.
