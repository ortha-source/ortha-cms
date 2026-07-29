# @ortha-cms/wysiwyg-admin

The **React block editor** — a Notion/Coda-shaped writing surface whose value is
plain HTML, in and out. The rendering half of `@ortha-cms/wysiwyg-core` (which
owns the model, the block schema, and the HTML pipeline).

```tsx
// In a form — a preview that expands into the editor in place.
<WysiwygField label="Body" value={html} onChange={setHtml} onBlur={touch} />

// The raw writing surface, when you want it inline.
<WysiwygEditor value={html} onChange={setHtml} onBlur={touch} invalid={!!error} />
```

Both are **controlled form controls**: the same `value`/`onChange` contract as an
`<input>`, so they drop into an existing form without any editor concepts leaking
into it. An empty document reports `''`, so a `required` rule sees an untouched
field as empty.

## Two surfaces, one value

`WysiwygField` is what a form should render: a **miniature of the document** plus
its title and word count, expanding into the editor when pressed.

A long document inside a form field is a bad trade — it either dominates the form
or grows a scrollbar of its own, and neither leaves room to actually write. Split
in two, each surface does one job: the field shows what is in there, the expanded
surface gives the writing a comfortable measure and room for the gutter and the
menus.

**The editor becomes the work area — it is not a modal.** Given an `expandTo`
region, the editor fills it and the host hides everything else in it: the other
fields go away, and the app chrome (sidebar, top bar, the record's own tabs)
stays. Writing a body is a mode, not a detour — every other field is noise while
it is happening, and none of the chrome you navigate with is. Without a region
(any form that offers none) it expands in place instead, so the control is never
tied to one page's layout.

It gets there by **portal**, which is what keeps it honest: the control stays
inside the form's React tree, so the value it edits is still the form's state
and collapsing puts the form back untouched — only the DOM moved. An earlier
version was a full-screen dialog; it was replaced, and the two problems it had
are worth remembering if anyone proposes one again:

- A modal makes everything outside its content **inert**, so the slash menu and
  the format toolbar rendered and then silently refused to be clicked.
- `DialogContent` centres itself with a **transform**, and a transformed ancestor
  becomes the containing block for `position: fixed` — re-basing both overlays'
  viewport coordinates onto the dialog box.

The overlays now portal into the **editor root**: never clipped by a scroll
container, and always in whatever tree the editor is mounted in.

The host side of the contract is two props — `expandTo` (where to render) and
`onExpandedChange` (when to hide/restore what was there). See content-admin's
`WorkAreaRegion` for the reference implementation.

- Edits commit **live** to the same `onChange`. Collapsing is not a save; the
  form's own Save remains the only commit point, exactly as for every other
  field. Collapsing *does* call `onBlur` — what a form means by "touched" — and
  returns focus to the preview card.
- **Escape collapses**, unless something inside claimed it first (the slash menu
  and the link field both do).
- The document's **first heading** is its title, falling back to the field label.
  A post-mortem is known by its heading, not by the name of the field it lives in.

## What it does

- **Block-per-line editing** — every paragraph, heading and list item is its own
  block with its own caret, drag handle and menu.
- **Slash menu** (`/`) — a filtered command palette of every registered block
  type, grouped Basic · Media · Advanced.
- **Markdown input rules** — `# `, `## `, `- `, `1. `, `[] `, `[x] `, `> `,
  ` ``` `, `---`.
- **Two toolbars.** A **floating** one over a selection (bold · italic ·
  underline · strikethrough · inline code · link, ⌘B/I/U/D/E/K), and a
  **persistent** one at the top of the expanded editor: undo/redo, a block-type
  picker naming the block the caret is in, the same marks, and Insert. They read
  the same state (`readMarkState`), so they can never disagree about whether the
  selection is bold.
- **A menu on every block's own line** — the gutter handle opens Turn into,
  Insert above/below, Copy, Cut, Paste above/below, Duplicate, Move up/down and
  Delete; dragging the same handle reorders the block.
- **Nesting** — Tab / Shift+Tab indent and outdent; toggles, quotes, callouts and
  columns hold child blocks.
- **Tables** — a handle above every column and beside every row (insert either
  side, delete), a header-row toggle, and Tab/Shift+Tab along the cells; tabbing
  off the last cell adds a row.
- **Multi-block selection** — drag across blocks, or ⌘A from inside the editor;
  the toolbar's marks and "turn into" then act on the whole run, and
  Backspace/⌘C/⌘X apply to it.
- **Undo/redo** (⌘Z / ⇧⌘Z) over the block model, with typing coalesced.
- **Structured paste** — multi-block HTML from another app becomes real blocks,
  sanitized; plain text is inserted as text.

## Layout

```
lib/
  editor/
    WysiwygEditor/       # the shell: slash state, key routing, focus boundary
    useEditorDocument/   # blocks + the HTML value contract + undo history
    useBlockCommands/    # every structural edit, over paths
    editorContext/       # schema · views · commands, shared down the tree
  blocks/
    BlockList / BlockRow # the recursive rendering + gutter + drag-and-drop
    InlineEditable/      # THE contenteditable primitive (see below)
    renderers/<Name>/    # one component per block type
    defaultBlockViews/   # type → renderer + icon
  field/                 # WysiwygField (preview + full-page) · WysiwygPreviewCard
  render/                # WysiwygContent + WYSIWYG_PROSE — reading, not editing
  menus/                 # SlashMenu · BlockMenu · EditorToolbar · InlineToolbar
  utils/                 # dom-selection · marks · input-rules · constants
```

Three ideas carry most of the design:

**The behavior is in `useBlockCommands`, not in the components.** What Enter does
at the end of a list item, what Backspace does at the start of a heading, what
Tab does to a bullet — all of it is pure functions over the block tree, with a
focus request as the only side effect. The renderers stay presentational.

**One command per user action.** Each command is built from the block list the
hook closed over, so calling two in the same event handler computes the second
from a tree the first already replaced — the second silently wins and the first
edit vanishes. Anything that looks like two steps (convert *and* keep the
leftover text) is therefore one command (`applyBlockType`).

**A block type that needs different keys supplies them.** `InlineEditable` takes
an optional `keys` map (`EditableKeyHandlers`) that runs before its own handling
and can claim a key. The table cell is what forced it: Enter must not split the
block (a paragraph among the cells of a row is not a table), Tab moves along the
row rather than indenting, and Backspace/Delete at the edges must not merge one
cell into the next — every table operation assumes the grid is a rectangle.
Teaching the primitive about tables would have been the other option; this way
the table's specifics stay in the table's files.

**`InlineEditable` is the only contenteditable.** Every block that holds words
renders one, so Enter/Backspace/Tab/arrows/markdown/slash/paste are implemented
once. It is *uncontrolled* with a controlled model behind it: the DOM is written
to only when it genuinely differs from the model, never on the author's own
keystrokes — rewriting `innerHTML` under a live caret sends the caret to the end
of the block. The model holds whatever markup the browser produced; sanitization
happens on the way **out** (serialization), which is why typing never fights the
sanitizer.

## Two toolbars, on purpose

The floating toolbar is faster once you know the editor; the persistent one
(`EditorToolbar`, shown when `WysiwygEditor` is given `toolbar`) is how you find
out it can do any of this. Duplication between them is the feature — but only of
the *controls*, never of the state: both call `readMarkState()`, one definition
of "is the selection bold".

Two things it needs that a floating toolbar doesn't:

- **The last focused block**, not the caret's current one. Pressing a toolbar
  button is itself a focus event and the dropdowns take focus outright, so
  `InlineEditable` publishes its path on focus (`setActivePath`) and the toolbar
  acts on that.
- **The block's attributes**, not just its type, to name what the caret is in.
  Three heading levels share `type: 'heading'`; matching on type alone labelled
  every heading "Heading 1". A block whose exact attrs aren't on the menu (an
  `h4`) still falls back to its type's first entry rather than to nothing.

With `toolbar` on, the editor also **owns its scrolling**: it fills its parent as
a flex column with the bar pinned and the document moving under it. The bar
staying put while the document scrolls only works if one component holds both.

## The block clipboard

Copy/Cut put blocks on a **module-scoped** clipboard (`blocks/blockClipboard`),
not the system one: reading the system clipboard needs a permission the browser
may refuse, and it would hand back a string to re-parse, where holding the blocks
restores attributes and nested children exactly. Copy still *writes* HTML to the
system clipboard so content can leave the app — that direction needs no
permission. Module scope is deliberate: copying in one field and pasting in
another is what a writer expects. Paste actions appear only when something has
been copied, so the menu never shows a row that does nothing.

## Rendering a stored value

`WysiwygContent` renders stored HTML read-only, styled by `WYSIWYG_PROSE` — the
one CSS definition of what the blocks look like when no React renderer is
involved. It sanitizes on every render. That is redundant on the happy path,
which is the point: `dangerouslySetInnerHTML` is defensible only when the string
reaching it cannot be anything else, and "the server already sanitized it" is an
assumption about a different process.

## Things that look wrong and aren't

- **`document.execCommand` for inline marks** (`utils/marks.ts`). Deprecated, and
  chosen anyway: it is the only API every browser implements for "toggle this
  mark across whatever the user selected", including a selection spanning three
  existing marks. The alternative is hundreds of lines of range surgery with
  worse edge cases. Every mark passes through that one file, so replacing the
  mechanism later is a change there and nowhere else.
- **Table rows and cells don't go through `BlockRow`.** They must be real `<tr>`
  and `<td>` elements, and `BlockRow`'s gutter and drop targets are `<div>`s, so
  the table renders its own children (`rendersChildren`). Its row and column
  handles live in an extra, borderless row and column **of the table itself** —
  that keeps them aligned with what they act on for free, where an absolutely
  positioned strip would have to re-measure every column on every edit and be
  wrong for the frame in between.
- **A soft break is `execCommand('insertLineBreak')`**, not `insertHTML('<br>')`.
  At the end of a block a browser needs a second, trailing `<br>` for the new
  line to have any height; inserting one by hand leaves the caret *before* the
  break, so the next thing typed lands on the line the author just left.
- **The code block is a `<textarea>`**, not a contenteditable. Code is plain
  text; a contenteditable would let a browser insert markup into it (a `<div>`
  per line, a smart quote, a pasted `<b>`) which the author would then see as
  code they did not write.
- **The slash menu never takes focus.** The caret stays in the block so the query
  can keep narrowing; the editable forwards ↑/↓/Enter/Escape to it
  (`handleOverlayKey`) and announces the active option via
  `aria-activedescendant`. The menu and the toolbar render in **portals** at
  viewport coordinates so they are never clipped by a scroll container.
- **The value contract ignores its own echo.** `useEditorDocument` remembers the
  last HTML it emitted; an incoming `value` equal to it is our own change coming
  back and is ignored, while a genuinely different one re-parses (and clears the
  undo stack — a replaced value is a different document, and Ctrl+Z must not
  paste the previous record into this one).

## Adding a block type

Two halves, keyed by the same `type` string:

```tsx
<WysiwygEditor
    value={html}
    onChange={setHtml}
    blocks={[alertBlock]}                       // the model (wysiwyg-core)
    blockViews={{ alert: { Component: AlertBlock, Icon: TriangleAlert } }}
/>
```

The slash menu picks the new type up automatically (from the definition's
`descriptor`), and a type the consumer *removed* from the schema disappears from
the menu rather than producing a command that does nothing. A block whose type
has no renderer falls back to `UnknownBlock` — editable text with a notice,
because the author's words are the one thing that must survive a schema
mismatch.

## Accessibility

Every editable region is a labelled `role="textbox"`; the toolbar is a
`role="toolbar"` whose toggles carry `aria-pressed`; the slash menu is a
`role="listbox"` driven by `aria-activedescendant`; the gutter appears on hover
**and** on `focus-within`, so it never disappears mid-keyboard-use. The image
block shows its **alt text** field inline rather than behind a menu — an image
published with no alt text is a defect, and the moment to fix it is while the
author is looking at the picture.

## Conventions

Follows the admin-plugin conventions: `<Name>/index.tsx` folders, **one
component per file**, co-located `defineMessages` namespaced `wysiwyg.<area>.<key>`,
UI from `@ortha-cms/design-system` only, no magic strings (keys, drag payload
and caret positions are constants in `utils/constants.ts`).

## Commands

- `npx nx typecheck @ortha-cms/wysiwyg-admin`
- `npx nx lint @ortha-cms/wysiwyg-admin`
