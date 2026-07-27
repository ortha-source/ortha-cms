# @ortha-cms/wysiwyg-admin

The **React block editor** — a Notion/Coda-shaped writing surface whose value is
plain HTML, in and out. The rendering half of `@ortha-cms/wysiwyg-core` (which
owns the model, the block schema, and the HTML pipeline).

```tsx
<WysiwygEditor value={html} onChange={setHtml} onBlur={touch} invalid={!!error} />
```

That is the whole required API. It is a **controlled form control**: the same
`value`/`onChange` contract as an `<input>`, so it drops into an existing form
without any editor concepts leaking into it. An empty document reports `''`, so a
`required` rule sees an untouched field as empty.

## What it does

- **Block-per-line editing** — every paragraph, heading and list item is its own
  block with its own caret, drag handle and menu.
- **Slash menu** (`/`) — a filtered command palette of every registered block
  type, grouped Basic · Media · Advanced.
- **Markdown input rules** — `# `, `## `, `- `, `1. `, `[] `, `[x] `, `> `,
  ` ``` `, `---`.
- **Selection toolbar** — bold · italic · underline · strikethrough · inline
  code · link, with ⌘B/I/U/D/E/K shortcuts.
- **Drag to reorder**, plus Move up / Move down / Duplicate / Turn into / Delete
  in the block menu.
- **Nesting** — Tab / Shift+Tab indent and outdent; toggles, quotes, callouts and
  columns hold child blocks.
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
  menus/                 # SlashMenu · BlockMenu · InlineToolbar (+ LinkForm)
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

**`InlineEditable` is the only contenteditable.** Every block that holds words
renders one, so Enter/Backspace/Tab/arrows/markdown/slash/paste are implemented
once. It is *uncontrolled* with a controlled model behind it: the DOM is written
to only when it genuinely differs from the model, never on the author's own
keystrokes — rewriting `innerHTML` under a live caret sends the caret to the end
of the block. The model holds whatever markup the browser produced; sanitization
happens on the way **out** (serialization), which is why typing never fights the
sanitizer.

## Things that look wrong and aren't

- **`document.execCommand` for inline marks** (`utils/marks.ts`). Deprecated, and
  chosen anyway: it is the only API every browser implements for "toggle this
  mark across whatever the user selected", including a selection spanning three
  existing marks. The alternative is hundreds of lines of range surgery with
  worse edge cases. Every mark passes through that one file, so replacing the
  mechanism later is a change there and nowhere else.
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
