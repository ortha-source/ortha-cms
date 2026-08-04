# @ortha-cms/wysiwyg-admin

The **rich text editor** behind the `wysiwyg` field: Tiptap's
[Simple Editor template](https://tiptap.dev/docs/ui-components/templates/simple-editor),
installed as source, wrapped in the form-control contract this CMS needs. The
rendering half of `@ortha-cms/wysiwyg-core`, which owns the HTML pipeline both
runtimes share.

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

## Where the editor comes from

**It is the template, not a copy of the template's ideas.** `src/tiptap-ui/` is
135 files installed by `npx @tiptap/cli add simple-editor`, kept byte-for-byte
apart from one mechanical rewrite (`@/x` specifiers → relative paths, because a
`@/` alias in a monorepo consumed from source by another app's Vite is a
collision waiting to happen). The tree is exempt from eslint and prettier for
the same reason: the point of a copied template is that upstream stays readable
against it, and reformatting to our conventions would mean re-applying that on
every update.

`lib/tiptap/` is the wrapping, and it is deliberately small:

```
lib/
  tiptap/
    TiptapEditor/        # the template's toolbar + EditorContent, in a form control
    TiptapToolbar/       # the template's `MainToolbarContent`
    MediaLibraryButton/  # where the template puts its upload button
    useWysiwygEditor.ts  # the HTML-in/HTML-out value contract
    extensions.ts        # the template's extension set + the two adapters below
    blockAlign.ts        # upstream `TextAlign`, writing `data-align`
    highlight.ts         # upstream `Highlight`, writing `data-highlight`
    storedBlocks.ts      # schema without UI — see below
    storedMarks.ts       # schema without UI — see below
    cellWidth.ts         # schema without UI — see below
    roundTrip.spec.ts    # stored HTML → schema → stored HTML, 25 cases
  field/                 # WysiwygField (preview + work area) · WysiwygPreviewCard
  render/                # WysiwygContent + WYSIWYG_PROSE — reading, not editing
  media/                 # the media port
```

**The value leaves through `normalizeWysiwygHtml`** — the same parse →
sanitize → serialize pass the server runs on every write. That is the one
constraint the template cannot know about, and it is why two of its extensions
are wrapped and why several nodes exist with no control attached.

`tiptap/roundTrip.spec.ts` holds 25 cases proving stored HTML survives a trip
through the schema unchanged. It is the guard on all of the above.

## Two adapters, and why they are not optional

The sanitizer is an allow-list. Anything the editor emits outside it is dropped
on save — silently, after the author has watched it apply.

- **`blockAlign.ts`** — upstream's `TextAlign` renders `style="text-align: …"`,
  which the sanitizer drops. The attribute is re-pointed at `data-align`.
  Nothing else changes, and the template's `TextAlignButton` drives it
  untouched: it looks for an extension _named_ `textAlign` with a
  `setTextAlign` command, which is exactly what is configured.
- **`highlight.ts`** — upstream's `Highlight` renders `data-color` plus an
  inline `background-color`, and the template's palette fills both with
  `var(--tt-color-highlight-…)`. A CSS variable is not something the sanitizer
  keeps, nor something a delivery surface could resolve if it did. The palette
  is re-pointed at the ten names core's vocabulary is written in — the same ten
  words either way — and the attribute at `data-highlight`.

## Schema without UI

`storedBlocks.ts`, `storedMarks.ts` and `cellWidth.ts` define callouts,
toggles, columns, image figures, embeds, table widths and the typographic span
marks. **No toolbar offers any of them.** They are here because they are in the
sanitizer's vocabulary and exist in stored content, and a document containing
one — opened in an editor whose schema has never heard of it — comes back
flattened on the next save. A stored figure carries a caption and a width; drop
the node and the caption becomes a stray paragraph. The round-trip suite is
what caught that.

If a control for any of them is wanted later, the node is already there.

## What it does

Everything the Simple Editor template does — undo/redo, six heading levels,
bulleted / numbered / to-do lists, blockquote, code block, bold · italic ·
underline · strike · inline code, superscript/subscript, link, highlight,
alignment, the markdown input rules, and `Typography`'s smart quotes and dashes
— plus one thing it cannot: **an image button that opens the host's media
library**, because in this app an image is an asset the host already manages.

## The media port

The editor's value is HTML, so an image block ultimately needs one thing: a URL.
Everything else about media — where assets live, who may upload, what counts as
an image, whether an abandoned edit should leave a file behind — belongs to
whoever mounted the editor. So the seam is one method:

```tsx
<WysiwygField media={{ pick: () => Promise<WysiwygMediaAsset | null> }} … />
```

Given a port, the toolbar draws an image button where the template puts its
upload button, and pressing it opens the library. Without one there is nothing
to open and the button is not drawn; a pasted URL keeps working either way,
because the value is HTML and an image is a URL. A pick that carries alt text
sets it.

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

- **The vendored tree is not linted or formatted.** See above: it is a copy, and
  it has to stay diffable against upstream.
- **The toolbar wraps where the template scrolls.** One fixed row with
  `overflow-x: auto` is right for a full-width page and wrong for a work area
  beside a properties rail — the last controls end up off the edge, behind a
  scrollbar nobody would think to look for.
- **`simple-editor.scss` is deliberately not imported.** It is a _page_
  stylesheet: it fetches Google Fonts and restyles `body`, `html` and `#root`,
  all three of which the admin app owns. Only the two style partials the
  components actually read (`_variables`, `_keyframe-animations`) are pulled in.
- **The editor imports the inline half of the prose CSS.** Block styling comes
  from the template's node stylesheets, but a colour lives in the markup itself
  — without `WYSIWYG_INLINE_PROSE` an author picks green and watches a `<mark>`
  come out the browser's default yellow, while the rendered document shows it
  correctly.
- **Two React contexts wrap the editor.** `TiptapProvider` carries the
  read-only flag and the media port; the template's components look the editor
  up in TipTap's own `EditorContext`, and giving them anything else would mean
  editing every copied file.
- **No `HTMLAttributes` on the link extension.** Setting `rel` would put it
  _before_ `href` in the rendered tag, and the serializer keeps the order it
  parsed — so every link a document merely _opened_ here would round-trip to a
  different string. The sanitizer already forces `rel="noopener noreferrer"`
  onto any link that opens a new tab, which is the pairing that matters.
- **The extensions are built inside the `useEditor` factory**, not in a
  `useMemo` outside it. TipTap extensions are stateful and bind to the editor
  they are given, so one set shared across two editors is one set with a
  dangling owner — and StrictMode mounts twice on purpose.
- **`immediatelyRender: false`.** React 19 + StrictMode: rendering on
  construction paints against a DOM node React is about to replace.
- **The value contract ignores its own echo.** `useWysiwygEditor` remembers the
  last HTML it emitted; an incoming `value` equal to it is our own change coming
  back, and re-seeding on it would reset the caret on every keystroke. A
  genuinely different one re-seeds and takes the undo history with it — a
  replaced value is a different document, and Ctrl+Z must not paste the previous
  record into this one.
- **An empty document reports `''`, not `<p></p>`.** Otherwise every untouched
  field reads as filled in and a `required` rule passes on nothing.

## Accessibility

The writing surface is one labelled `role="textbox"` (ProseMirror's own, named
through `editorProps.attributes`); the toolbar is the template's
`role="toolbar"`, whose buttons carry their own labels, tooltips and pressed
state.

One thing the template does not do and this field no longer does either: an
image has no inline **alt text** field. An image published without alt text is
a defect, and there is currently no place in this editor to fix it — see
backlog #14.

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

Two vocabularies live here, and the boundary is the point: **inside
`src/tiptap-ui/` nothing is ours** — not the formatting, not the components, not
the CSS — and **inside `src/lib/` the usual rules apply**: `<Name>/index.tsx`
folders, one component per file, co-located `defineMessages` namespaced
`wysiwyg.<area>.<key>`. Chrome that sits _in_ the template's toolbar is built
from the template's primitives so it does not read as a different product;
chrome outside it (the field, the preview card) uses
`@ortha-cms/design-system`.

## Commands

- `npx nx typecheck @ortha-cms/wysiwyg-admin`
- `npx nx lint @ortha-cms/wysiwyg-admin`
- `npx nx test @ortha-cms/wysiwyg-admin` — the round-trip suite
