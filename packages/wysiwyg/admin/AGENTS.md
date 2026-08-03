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
  field. Collapsing _does_ call `onBlur` — what a form means by "touched" — and
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
  side, delete, align the whole column or row horizontally and vertically), a
  header-row toggle, buttons that align the **table itself**, a drag grip on
  every column edge, and Tab/Shift+Tab along the cells; tabbing off the last
  cell adds a row.
- **Multi-block selection** — drag across blocks, or ⌘A from inside the editor;
  the toolbar's marks and "turn into" then act on the whole run, and
  Backspace/⌘C/⌘X apply to it.
- **Alignment** — left · centre · right · justify on paragraphs, headings, list
  items, quotes, callouts, images and table cells, from the toolbar, the block
  menu, or ⌘⇧L/E/R/J. Applies to a whole multi-block selection at once. A table
  has **three** separate alignments and they are deliberately kept apart: where
  the table's box sits, where a cell's content sits across, and where it sits
  down.
- **Text colour and highlight** — a ten-name palette each, plus a native colour
  well for a custom hex when a brand colour has to be exact.
- **Image width** — small · medium · large · full, combining with alignment,
  plus a grip on each edge for a width between the presets.
- **Undo/redo** (⌘Z / ⇧⌘Z) over the block model, with typing coalesced.
- **Structured paste** — multi-block HTML from another app becomes real blocks,
  sanitized; plain text is inserted as text.
- **The host's media library**, when it offered one (see below).

## Layout

```
lib/
  editor/
    WysiwygEditor/       # the shell: slash state, key routing, focus boundary
    useEditorDocument/   # blocks + the HTML value contract + undo history
    useBlockCommands/    # every structural edit, over paths
    editorContext/       # schema · views · commands, shared down the tree
  blocks/
    BlockList / BlockRow # the recursive rendering + drag-and-drop
    BlockGutter/         # ONE add/drag control, travelling between blocks
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
edit vanishes. Anything that looks like two steps (convert _and_ keep the
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
once. It is _uncontrolled_ with a controlled model behind it: the DOM is written
to only when it genuinely differs from the model, never on the author's own
keystrokes — rewriting `innerHTML` under a live caret sends the caret to the end
of the block. The model holds whatever markup the browser produced; sanitization
happens on the way **out** (serialization), which is why typing never fights the
sanitizer.

## Two toolbars, on purpose

The floating toolbar is faster once you know the editor; the persistent one
(`EditorToolbar`, shown when `WysiwygEditor` is given `toolbar`) is how you find
out it can do any of this. Duplication between them is the feature — but only of
the _controls_, never of the state: both call `readMarkState()`, one definition
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

## The media port

The editor's value is HTML, so an image block ultimately needs one thing: a URL.
Everything else about media — where assets live, who may upload, what counts as
an image, whether an abandoned edit should leave a file behind — belongs to
whoever mounted the editor. So the seam is one method:

```tsx
<WysiwygField media={{ pick: () => Promise<WysiwygMediaAsset | null> }} … />
```

Given a port, the image block offers **Choose from library** beside the URL box
and **Replace from library** on a placed image; without one it shows neither, and
a pasted URL keeps working either way. A pick that carries alt text sets it; one
that doesn't leaves whatever the author already wrote, because an asset with no
alt must not wipe out a caption someone bothered to write.

What comes back is stored as the image's **`src`**, not as an asset id. That is
the field's whole contract — the value is HTML any consumer can render, with
nothing to resolve — and the honest cost is that an asset deleted from the
library leaves a dead image in a document. The alternative (an id the delivery
layer resolves) would make the stored value unusable outside this CMS.

content-admin fills the port from its `ASSET_PICKER_SLOT`, which the media plugin
registers into; see `WysiwygFieldControl`.

## The block clipboard

Copy/Cut put blocks on a **module-scoped** clipboard (`blocks/blockClipboard`),
not the system one: reading the system clipboard needs a permission the browser
may refuse, and it would hand back a string to re-parse, where holding the blocks
restores attributes and nested children exactly. Copy still _writes_ HTML to the
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
  line to have any height; inserting one by hand leaves the caret _before_ the
  break, so the next thing typed lands on the line the author just left.
- **The code block is a `<textarea>`**, not a contenteditable. Code is plain
  text; a contenteditable would let a browser insert markup into it (a `<div>`
  per line, a smart quote, a pasted `<b>`) which the author would then see as
  code they did not write.
- **There is one gutter, and it moves.** Not one hidden pair of controls per
  row: `BlockGutter` is a single element for the whole document that parks
  itself on the block under the pointer or the caret, positioned by a
  `transform` so crossing to the next block is a move the compositor animates.
  Per-row controls blinked out of one line and back into the next on every
  crossing, which reads as flicker down a page rather than as one thing
  following the cursor. It finds its row by the `data-block-path` `BlockRow`
  sets, and it lives inside the scrolling surface so it travels with the text.
- **The gutter is `z-10`, and that is load-bearing.** Every `BlockRow` is
  `relative` and renders _after_ the gutter, so on the default z-index the rows
  paint over it. At the top level the gutter hangs into the surface's own
  padding, where there is no row to paint over it, so the bug is invisible —
  put a row under it, which is exactly what a **column layout** does, and the
  controls are visible, hover correctly, and cannot be clicked, because the
  text is on top of them.
- **The gutter has a reach corridor** (`GUTTER_REACH`). It hangs off the _left_
  of the block it acts on, and for a block in a column that is over the column
  beside it — so moving the pointer towards the controls crossed rows belonging
  to the previous column, each of which re-parked the gutter. The controls fled
  leftwards the instant an author went for them, and no block in any column but
  the first could be added to or opened at all. Within the corridor the gutter
  stays put. Both of these are guarded by e2e cases that _press_ the control,
  because seeing it and reaching it are different things.
- **Columns are ruled, in the editor only.** Two paragraphs side by side with
  nothing between them read as one paragraph that has gone wrong; a gap does
  not say "columns", and an author who cannot see the boundary cannot tell
  which column they are typing in. The rule is chrome and is never serialized —
  whether columns are ruled on the delivery surface is that surface's decision.
- **The gutter's vertical position is measured, not styled.** It has to sit on
  the block's first line, and every renderer picks its own type scale and
  spacing — an `h1` is `text-3xl mt-6`, a paragraph `py-1 leading-7` — so the
  centring offset differs by ~30px across block types. A constant offset centred
  it on paragraphs and floated it above the words of every heading.
  `utils/first-line.ts` reads the laid-out line instead, which keeps each
  block's metrics in the one place that already has them (its own classes)
  rather than restated beside the affordance that must match them. Captions are
  excluded from the lookup — an image's caption shares its block's path but
  renders _under_ the picture.
- **The pointer selects blocks on the _document_, not on the root.** The root
  also holds the persistent toolbar, and its `mousedown` handler clears the
  block selection — so with the listener up there, pressing a toolbar button
  destroyed the very selection the button was about to format, and the toolbar's
  whole selection-aware half (`toggleMarkMany`, `setTypeMany`) was unreachable by
  mouse. The e2e suite is what caught it; an earlier hand-check had "passed"
  because turning one block into a list produces the same `<ul><li>` a run does.
- **Undo/redo are also handled on the root.** Selecting blocks takes the caret
  out of every editable, so `InlineEditable`'s shortcut handler is not listening
  — without a copy on the root, one ⌘B across a selection could not be taken
  back from the keyboard at all.
- **A mark that can't use `execCommand` must commit itself.** `execCommand`
  fires an `input` event and `InlineEditable` commits on that; inline code,
  re-pointing an existing link, removing one, and both colour marks edit the DOM
  directly and fire nothing. They showed in the editor and were **lost on save**
  unless the author happened to type again afterwards — a bug that predated the
  colour work and applied to inline code and links. Anything that mutates a
  block's HTML by hand now calls `commitActiveHtml()`, which commits through
  `replaceHtml` (a discrete history entry, not coalesced into the last
  keystroke — undoing a colour should take back the colour, not the sentence).
- **The colour and link overlays save and restore the selection.** A toolbar
  _button_ can just suppress `mousedown`; a Radix _menu or popover_ moves focus
  into itself, and the browser collapses the document selection when it goes —
  so by the time an item is chosen there is nothing left to colour or link.
- **The link popover latches what it found when it opened.** Same cause, one
  step further: focus moving into the popover ends the selection, so the
  toolbar's next `selectionchange` read reports _no link_ — and a Remove button
  driven by that live value unmounted itself the instant it became reachable.
- **The persistent toolbar has its own link popover**, rather than reaching for
  the floating toolbar's field. Pressing a button in the top bar and having a
  field appear over the text three inches below reads as something else
  happening; every other control up there opens where it was pressed.
- **Centring an image is auto margins, not `text-align`.** The CSS reset makes
  `<img>` a block, and a block box ignores `text-align` — so the attribute was
  on the figure, the rule was in the stylesheet, and the picture did not move.
  Both the figure (which the size presets give a width) and the wrapper around
  the image get the margins. The same is true of a **table**, which is why its
  `data-align` rules set margins and then put `text-align` back to `start`:
  without that reset the table's own alignment inherits into every cell, and
  "centre the table" silently becomes "centre everything in it".
- **The resize grips are labelled buttons, not `role="separator"`.** A focusable
  separator is the ARIA window-splitter pattern, and that pattern _requires_
  `aria-valuenow` — a number a grip does not have until something has been
  dragged, and would have to invent until then. axe flags the missing attribute
  (it is what caught this); inventing a value to satisfy it would have been
  worse than not making the claim.
- **A drag previews on one cell and commits on release.** Writing the model on
  every `pointermove` puts a hundred entries on the undo stack for one drag, so
  the grip sets `style.width` on the cell it lives in and calls a command once,
  at the end. One cell is enough because propagating a width down the column is
  exactly what a table's layout algorithm already does.
- **A resized table is pinned to `width: 100%`.** Column widths are percentages
  of the table, and a table with no width of its own is as wide as its content —
  so "40%" would be 40% of a number the author cannot see, and would move every
  time they typed. The cost is honest and visible: a table whose columns were
  resized has nowhere left to be aligned to.
- **Every toolbar control carries a tooltip.** The icon is the entire label;
  `ToolbarButton` shows the same string as its accessible name so the two
  cannot drift, and the dropdown triggers wrap their own.
- **The editor imports the inline half of the prose CSS.** Block styling in the
  editor comes from each React renderer, so it does not want `WYSIWYG_PROSE` —
  but a colour lives in the markup `InlineEditable` renders verbatim, and
  without `WYSIWYG_INLINE_PROSE` an author picked a colour and watched nothing
  happen while the _rendered_ document showed it correctly.
- **The slash menu does not claim a _shifted_ Enter.** It owns the navigation
  keys while it is open, and it opens on any `/` that follows a space — so a
  line as ordinary as "see /docs" leaves it up. Claiming Enter without looking
  at Shift meant a soft break inserted whatever the menu happened to be
  highlighting and started a new block, where the author had asked for a new
  line in the one they were writing. Shift+Enter now closes the menu and falls
  through to the block.
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
    blocks={[alertBlock]} // the model (wysiwyg-core)
    blockViews={{ alert: { Component: AlertBlock, Icon: TriangleAlert } }}
/>
```

The slash menu picks the new type up automatically (from the definition's
`descriptor`), and a type the consumer _removed_ from the schema disappears from
the menu rather than producing a command that does nothing. A block whose type
has no renderer falls back to `UnknownBlock` — editable text with a notice,
because the author's words are the one thing that must survive a schema
mismatch.

## Accessibility

Every editable region is a labelled `role="textbox"`; the toolbar is a
`role="toolbar"` whose toggles carry `aria-pressed`; the slash menu is a
`role="listbox"` driven by `aria-activedescendant`; the gutter follows the caret
as well as the pointer, so it never disappears mid-keyboard-use.

One known cost of the single travelling gutter: because the controls no longer
render _inside_ the row they act on, they are no longer the next thing Tab
reaches from a block. Keyboard users get to the same operations through the
slash menu and the shortcuts, but a way back to Tab-adjacency (without losing
the animation, which a portal between rows would) is still open. The image
block shows its **alt text** field inline rather than behind a menu — an image
published with no alt text is a defect, and the moment to fix it is while the
author is looking at the picture.

## End-to-end cover

`apps/admin-e2e/src/content/wysiwyg-field.spec.ts` (page object:
`WysiwygFieldPage`) drives the field in a real browser — the work-area takeover,
typing and the markdown rules, the slash menu, multi-block selection, tables,
the media picker, the text-length limit, keyboard operability, and axe scans of
the expanded editor / open slash menu / a table.

Wherever it can, it asserts the **saved HTML** rather than the DOM: that string
is the field's contract, and a serializer regression behind a green-looking
editor is exactly the failure a DOM assertion misses. Its seeds are `WYSIWYG_*`
in `support/api/content.ts`.

Where the result is _computed_ — centring, a dragged width — it asserts the
**laid-out geometry** instead, and as an outcome rather than a mechanism: the
picture's gap from each edge of its figure, not which element ended up carrying
`margin: auto`. Which box carries it has already changed once, and a test
written against the mechanism failed on a refactor that broke nothing.

## Conventions

Follows the admin-plugin conventions: `<Name>/index.tsx` folders, **one
component per file**, co-located `defineMessages` namespaced `wysiwyg.<area>.<key>`,
UI from `@ortha-cms/design-system` only, no magic strings (keys, drag payload
and caret positions are constants in `utils/constants.ts`).

## Commands

- `npx nx typecheck @ortha-cms/wysiwyg-admin`
- `npx nx lint @ortha-cms/wysiwyg-admin`
