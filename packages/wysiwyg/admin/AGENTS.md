# @ortha-cms/wysiwyg-admin

The **React block editor** — a Notion/Coda-shaped writing surface whose value is
plain HTML, in and out. Built on **TipTap 3** (ProseMirror); the rendering half
of `@ortha-cms/wysiwyg-core`, which owns the HTML pipeline both runtimes share.

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

## Where the document lives

**TipTap owns it.** The schema, the commands, undo, selection, paste, and every
contenteditable edge case are its job. What is left in this package is the wiring
TipTap has no opinion about: the form-control contract, the chrome, the block
catalogue, and the seam to the host's media library.

That division is the whole reason for the rewrite. The behaviour this package
used to own — what Enter does at the end of a list item, what Backspace does at
the start of a heading, how a mark survives a selection spanning three others —
is not product design, it is contenteditable, and every hour spent on it was an
hour not spent on the editor itself. The block model, the per-block
`contenteditable`, the command layer, the drag-and-drop and the clipboard that
implemented it came to about 8,000 lines, and they are gone.

**The value still leaves through `normalizeWysiwygHtml`** — the same parse →
sanitize → serialize pass the server runs on every write. Two consequences worth
stating:

- The TipTap schema only has to be **parseable** by core, never byte-identical
  with it. That is a much weaker thing to get right, and it is what made the
  migration safe: no content migration, no dual-writing, and core stays the one
  authority on what HTML is storable. `tiptap/roundTrip.spec.ts` holds 25 cases
  proving stored HTML survives a trip through the editor's schema unchanged.
- An editor bug cannot widen what a document may contain. The sanitizer is the
  security boundary and it is not in this package.

## Two surfaces, one value

`WysiwygField` is what a form should render: a **miniature of the document** plus
its title and word count, expanding into the editor when pressed.

A long document inside a form field is a bad trade — it either dominates the form
or grows a scrollbar of its own, and neither leaves room to actually write. Split
in two, each surface does one job: the field shows what is in there, the expanded
surface gives the writing a comfortable measure and room for the menus.

**The editor becomes the work area — it is not a modal.** Given an `expandTo`
region, the editor fills it and the host hides everything else in it: the other
fields go away, and the app chrome (sidebar, top bar, the record's own tabs)
stays. Writing a body is a mode, not a detour — every other field is noise while
it is happening, and none of the chrome you navigate with is. Without a region
(any form that offers none) it expands in place instead, so the control is never
tied to one page's layout.

It gets there by **portal**, which is what keeps it honest: the control stays
inside the form's React tree, so the value it edits is still the form's state and
collapsing puts the form back untouched — only the DOM moved. An earlier version
was a full-screen dialog; it was replaced, and the two problems it had are worth
remembering if anyone proposes one again:

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

- **Block editing** — paragraphs, six heading levels, bulleted / numbered /
  to-do lists, quotes, callouts, code, dividers, images, embeds, toggles, columns
  and tables.
- **Slash menu** (`/`) — a filtered command palette of the block catalogue,
  grouped Basic · Media · Advanced.
- **Markdown input rules** — `# `, `## `, `- `, `1. `, `[] `, `[x] `, `> `,
  ` ``` `, `---`, straight from StarterKit.
- **Three toolbars.** A **persistent** one at the top of the expanded editor
  (undo/redo, block-type picker, marks, link, colour, typography, alignment,
  Insert); a **floating** one over a selection with the same marks and controls;
  and a **table** one that appears while the caret is in a table.
- **A handle on every block's line** — add below, and a menu with Turn into,
  Align, Duplicate, Move and Delete. Dragging the same handle reorders the block.
- **Tables** — insert/delete rows and columns, a header-row toggle, three
  separate alignments (the table's box, a cell's content across, a cell's content
  down), a drag grip on every column border, and Tab along the cells.
- **Alignment** — left · centre · right · justify, stored as `data-align`.
- **Text colour and highlight** — a ten-name palette each, plus a colour well for
  a custom hex when a brand colour has to be exact.
- **Image width** — small · medium · large · full, plus a grip on each edge for a
  width between the presets.
- **The host's media library**, when it offered one (see below).

## Layout

```
lib/
  tiptap/
    extensions.ts        # THE schema — every node, mark and node view
    useWysiwygEditor.ts  # the HTML-in/HTML-out form-control contract
    blockNodes.ts        # callout · toggle · column(s) · image · embed
    inlineMarks.ts       # colour · highlight · typeface · size
    blockAlign.ts        # data-align as a global attribute
    cellWidth.ts         # column/table widths + the commands that move them
    slashCommand.ts      # the `/` trigger, hand-rolled
    blockTypes.ts        # ONE catalogue, used by all three menus
    roundTrip.spec.ts    # stored HTML → schema → stored HTML, 25 cases
    Tiptap<Name>/        # the chrome: toolbars, menus, node views
  field/                 # WysiwygField (preview + work area) · WysiwygPreviewCard
  menus/                 # ToolbarButton · LinkControl · ColorControl · TypographyControl
  render/                # WysiwygContent + WYSIWYG_PROSE — reading, not editing
  media/                 # the media port
```

Two ideas carry most of what is left:

**The schema is one description.** Each node states the HTML it is, once, and
TipTap derives parsing and serializing from it. Before, a block type was a
renderer on one side and a serializer on the other, agreeing by convention.

**The editor and the reader share one stylesheet.** The writing surface is a
single contenteditable holding the real tags, styled by the same `WYSIWYG_PROSE`
the delivered document uses. The old editor styled each block through its React
renderer and the delivered HTML through a stylesheet, so the two could drift and
did.

## The block catalogue

`tiptap/blockTypes.ts` is **one list**, used by the toolbar's "turn into" picker,
the slash palette and the block handle's menu. Each entry knows its label, icon,
group, search keywords, whether it is active, and how to apply itself.

The old editor derived this from the block schema's `descriptor`, which was the
right instinct in a package that owned the schema. TipTap owns it now, and a
schema node has no opinion about what a menu should call it or which icon it
wears — so the catalogue is its own thing, and the three menus that present it
cannot drift apart.

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

## Rendering a stored value

`WysiwygContent` renders stored HTML read-only, styled by `WYSIWYG_PROSE` — the
one CSS definition of what the blocks look like when no editor is involved. It
sanitizes on every render. That is redundant on the happy path, which is the
point: `dangerouslySetInnerHTML` is defensible only when the string reaching it
cannot be anything else, and "the server already sanitized it" is an assumption
about a different process.

## Things that look wrong and aren't

### The schema

- **Not TipTap's `TextAlign`, `Color` or `Image`.** Each writes inline `style`,
  and the sanitizer's allow-list would drop it — so the choice would simply not
  survive a save. Alignment is `data-align`, a colour is `data-color` (with a hex
  as the documented exception), and an image is a `<figure>` whose content is its
  caption.
- **A named palette, not a colour wheel; roles and steps, not a font menu.** The
  value ends up in HTML some other surface renders. `serif` is something any
  consumer can honour with its own stack where `Helvetica Neue` is a guess about
  a machine we have never seen; `large` survives a phone where `18pt` does not.
- **The image's caption is the node's content.** That is what gives it a caret,
  the formatting toolbar and the Enter/Backspace behaviour every other line has —
  for free, rather than as a second editable wired up by hand. The parser is
  pointed at the `<figcaption>` (`contentElement`); left to take the whole figure
  it swallowed the `<img>` as caption text, and a bare selector returns nothing
  for an uncaptioned figure, which ProseMirror dereferences without checking — so
  there is an empty stand-in.
- **No `HTMLAttributes` on the link extension, and anchors are pinned `href`
  first in core's sanitizer.** TipTap renders `target` and `rel` ahead of `href`,
  and the serializer keeps the order it parsed — so without the pin, every link a
  document merely *opened* in this editor would round-trip to a different string.
- **The embed emits no iframe.** Whether to frame a third party is the delivery
  surface's decision against its own CSP, and a sanitizer that permits iframes is
  one `srcdoc` away from permitting anything.
- **Column widths are percentages on every cell, not a `<colgroup>`.** The stored
  HTML is rendered on a surface whose measure this editor never sees, so a pixel
  count is a guess about someone else's layout; and a column box inside the
  *block* box the rendered table is — which is what stops a wide table widening
  the page — is at the mercy of anonymous-table generation, where a width on the
  cell is honoured by every layout there is. Repeating it down the column costs
  nothing to maintain: no row operation has to carry it, because no single row
  owns it.

### The chrome

- **The `/` palette does not use `@tiptap/suggestion`.** Its render lifecycle
  publishes props whose `items` are resolved *after* the fact, then exits while
  the author is still typing — the palette opened onto an empty list and closed
  again on the next keystroke. The detection it was there to provide is one regex.
- **The palette publishes from `onTransaction`, not a ProseMirror plugin view.**
  Plugin views are destroyed and rebuilt whenever *anything* reconfigures the
  plugin set, so a view that closed the palette in `destroy` closed it on every
  keystroke. Only the key handling stays in a plugin, where the plugin *object*
  is stable even when its view is not.
- **The palette's highlighted index lives in extension storage, not React
  state.** The arrow keys have to move it *before* the next keystroke is handled;
  a render behind is a palette that inserts the row above the one you were
  reading.
- **The palette does not claim a _shifted_ Enter.** It opens on any `/` that
  follows a space — so a line as ordinary as "see /docs" leaves it up. Claiming
  Enter without looking at Shift meant a soft break inserted whatever happened to
  be highlighted.
- **`DragHandle`'s `onNodeChange` must be `useCallback`-stable.** It is in the
  deps of the effect that registers the handle's plugin, and registration hides
  the handle — so an inline arrow makes the sequence "show the handle, tell React
  which node it is on, re-register, hide the handle", and the controls never
  appear at all. That same re-registration is what churned the plugin views under
  the `/` palette.
- **`BubbleMenu`'s `shouldShow` must be stable too.** It dispatches a transaction
  when that identity changes, and every transaction renders.
- **The table's controls are a floating bar, not handles above every column.**
  Those handles had to *be* cells — an extra borderless row and column of the
  table itself — because a strip over the table has to re-measure on every edit.
  It worked, and it cost a control row and column in every table which every
  operation, test and serializer had to know were not really there. Acting on the
  row and column the **caret is in** needs neither.
- **The table's resize grips *are* a measured overlay**, because there is no
  alternative: a React node view always wraps its component in an element of its
  own, and nothing may stand between a `<tr>` and its `<td>`. A layout effect and
  a `ResizeObserver` read the borders after every layout the table takes part in,
  and the measurement is compared before it is stored — a grip re-rendered
  mid-drag loses the `pointermove` listener it is holding.
- **The table node view sets `contentDOMElementTag: 'tbody'`.** A node view holds
  its content in a `<div>` by default; legal to build with the DOM API, rendered
  through CSS's anonymous-table fixup, and not a layout anything else here can
  measure against — with the div in place the whole table came out as a single
  38px column.
- **The toggle gets a _plain DOM_ node view, not a React one.** `<summary>` only
  works as a direct child of `<details>`, and a React node view puts an element
  in between. It is held `open` because a closed `<details>` hides its children
  from layout, and content with no layout has no caret. Open is an editing state
  and is never serialized.
- **Node views are registered in `extensions.ts`, not on the nodes.** A view is
  how a block is *edited*; it has no say in what the document is or what it
  serializes to, and `blockNodes.ts` stays what it claims to be.
- **The image's alt field is inline, not behind a menu.** An image published with
  no alt text is a defect, and the moment to fix it is while the author is
  looking at the picture.

### Resizing

- **A drag previews on the element and commits once, on release.** Writing the
  model on every `pointermove` puts a hundred entries on the undo stack for one
  drag.
- **A drag leaves its preview _on_ the committed value — it never clears it.**
  The widths are React `style` props, and React only writes one when its own
  previous value differs. Clearing them by hand deleted what React had just
  written and left the table with no width at all, so every column percentage
  became a fraction of a shrink-to-fit table: an +80px drag came back 5px
  **narrower**.
- **An inner border moves width between _two_ columns; the last one resizes the
  table.** Sizing only the column on the left leaves the rest of the row to
  absorb the difference, so a drag meant for one border quietly reshuffles every
  column to its right. The last border has no column to its right at all, so the
  room comes from the measure: it grows the table, pins every other column at its
  pixel width for the length of the drag, and clears the last column's own width.
- **A column drag pins the table _before_ it measures it, at the width the table
  already has.** A column width is a percentage *of the table*, and an unsized
  table is only as wide as its content — so writing a width onto a cell changes
  the number that percentage resolves against. Measuring first and pinning at
  commit turned a 100px drag into 277. Pinning to 100% instead of the current
  width is the same bug wearing a different hat: it snaps an unsized table out to
  the full measure and lands the column far from where the author let go, which
  is why the pin travels with the command rather than being defaulted inside it.
  Pinning re-shares the row's space, so the grabbed widths are written straight
  back or the grip jumps out from under the cursor.
- **Held columns are clamped to the floor on the way out.** Holding a column at a
  fixed pixel width while the table grows makes its *percentage* fall, and one
  that slips under the floor is a width the sanitizer refuses — so the column
  came back with no stored width and snapped out to its minimum.
- **The resize grips are labelled buttons, not `role="separator"`.** A focusable
  separator is the ARIA window-splitter pattern, and that pattern *requires*
  `aria-valuenow` — a number a grip does not have until something has been
  dragged, and would have to invent until then. axe is what caught this.
- **A column grip reaches back into its own column, never forward.** Centred on
  the border is the obvious choice and it is wrong: half the strip then lies over
  the *next* column, on top of it, and swallows every press near that column's
  left edge, the caret included.
- **Centring an image or a table is auto margins, not `text-align`.** The CSS
  reset makes `<img>` a block, and a block box ignores `text-align`. For a table
  the alignment rules also put `text-align` back to `start`, or the table's own
  alignment inherits into every cell and "centre the table" silently becomes
  "centre everything in it".
- **A dragged width replaces the preset rather than joining it.** They say the
  same thing at different resolutions, and a document carrying both leaves which
  one wins to luck.

### The value contract

- **The extensions are built inside the `useEditor` factory**, not in a `useMemo`
  outside it. TipTap extensions are stateful and bind to the editor they are
  given, so one set shared across two editors is one set with a dangling owner —
  and StrictMode mounts twice on purpose.
- **`immediatelyRender: false`.** React 19 + StrictMode: rendering on
  construction paints against a DOM node React is about to replace.
- **The contract ignores its own echo.** `useWysiwygEditor` remembers the last
  HTML it emitted; an incoming `value` equal to it is our own change coming back,
  and re-seeding on it would reset the caret on every keystroke. A genuinely
  different one re-seeds and takes the undo history with it — a replaced value is
  a different document, and Ctrl+Z must not paste the previous record into this
  one.
- **An empty document reports `''`, not `<p></p>`.** Otherwise every untouched
  field reads as filled in and a `required` rule passes on nothing.

## Accessibility

The writing surface is one labelled `role="textbox"` (ProseMirror's own); each
toolbar is a `role="toolbar"` whose toggles carry `aria-pressed`; the slash menu
is a `role="listbox"` driven by `aria-activedescendant` and never takes focus, so
the caret stays in the block and the query can keep narrowing.

The image block shows its **alt text** field inline rather than behind a menu —
an image published with no alt text is a defect, and the moment to fix it is
while the author is looking at the picture.

## End-to-end cover

`apps/admin-e2e/src/content/wysiwyg-field.spec.ts` (page object:
`WysiwygFieldPage`) drives the field in a real browser. Its seeds are `WYSIWYG_*`
in `support/api/content.ts`.

> **The suite is mid-migration.** It was written against the block-model editor,
> where every block was its own `role="textbox"` named after its type, and there
> is now one contenteditable — so its locators need rewriting before it can be
> green. Treat a failure there as "not yet ported", not as a regression, until
> that lands.

Wherever it can, it asserts the **saved HTML** rather than the DOM: that string
is the field's contract, and a serializer regression behind a green-looking
editor is exactly the failure a DOM assertion misses. Where the result is
_computed_ — centring, a dragged width — it asserts the **laid-out geometry**
instead, and as an outcome rather than a mechanism: the picture's gap from each
edge of its figure, not which element ended up carrying `margin: auto`. Which box
carries it has already changed twice, and a test written against the mechanism
failed on a refactor that broke nothing.

## Conventions

`<Name>/index.tsx` folders, one component per file, co-located `defineMessages`
namespaced `wysiwyg.<area>.<key>`, UI from `@ortha-cms/design-system` only.

## Commands

- `npx nx typecheck @ortha-cms/wysiwyg-admin`
- `npx nx lint @ortha-cms/wysiwyg-admin`
- `npx nx test @ortha-cms/wysiwyg-admin` — the round-trip suite
