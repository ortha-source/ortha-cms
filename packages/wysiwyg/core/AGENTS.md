# @ortha-cms/wysiwyg-core

The **runtime-agnostic half** of the Ortha block editor: the document model, the
extensible block schema, and the HTML pipeline (parse → sanitize → serialize).

Pure TypeScript, **no DOM and no framework**. That is not stylistic — the same
pipeline runs in two places, and only one of them is a browser:

- `@ortha-cms/wysiwyg-admin` renders this model in React;
- `@ortha-cms/content-server` runs `normalizeWysiwygHtml` on **every write**, so
  the stored value is canonical and sanitized whatever client produced it.

One definition of what the HTML means, applied on both sides.

## The value is HTML

There is no proprietary document format in the database. A `wysiwyg` field
stores plain semantic HTML — `<p>`, `<h2>`, `<ul><li>`, `<blockquote>`,
`<pre><code>`, `<figure><img>` — with no editor classes, ids, or wrapper
`<div>`s. The block tree exists only while editing; `parseDocument` rebuilds it
from the stored HTML on open, and `serializeDocument` flattens it on change.

The consequence worth stating plainly: **any consumer can render the field
value directly**, and nothing downstream needs this package.

## The document model

```
WysiwygBlock = { id, type, html, attrs, children }
```

A block is an id (editor-local, never serialized), a `type` string, its own
**inline** HTML, a JSON-serializable `attrs` bag, and `children`. Everything a
type _means_ lives in its {@link BlockDefinition}, never in this shape — which is
what makes a new block type an addition rather than an edit.

Blocks are addressed by **path** (`[2, 0]` = the third block's first child), and
every structural operation (`lib/document/tree.ts`) is an immutable function over
that path. Ids are for lookup; paths are for editing, because an insert has to
name a slot with no block in it yet.

## Extending it — the block schema

A block type is one object:

```typescript
const alertBlock: BlockDefinition = {
    type: 'alert',
    content: 'inline',
    defaultAttrs: { severity: 'warning' },
    descriptor: {
        defaultLabel: 'Alert',
        keywords: ['warning'],
        group: 'basic'
    },
    tags: ['div'],
    match: (element) => element.attrs['data-block'] === 'alert',
    toHtml: (block, ctx) =>
        `<div data-block="alert" data-severity="${ctx.attr(
            ctx.text(block.attrs['severity'])
        )}">${ctx.inline(block.html)}</div>`
};

const schema = extendBlockSchema(DEFAULT_BLOCK_SCHEMA, [alertBlock]);
```

Registering a definition with an existing `type` **replaces** it — that is how a
consumer swaps the image block for one that talks to the media library, instead
of forking the built-in set.

`content` is the one thing the editor branches on:

| `content`   | meaning                                | examples                  |
| ----------- | -------------------------------------- | ------------------------- |
| `inline`    | holds its own editable text            | paragraph, heading, quote |
| `container` | holds child blocks, no text of its own | columns, column           |
| `void`      | holds nothing editable                 | divider                   |

`wrapper` is how a run of same-type blocks collapses into one element:
three bulleted-list blocks are **three blocks** in the model (three carets, three
drag handles) but **one `<ul>`** in the HTML. Serialization groups them, parsing
expands them again.

### Built-in types

paragraph · heading (1–6) · bulleted / numbered / to-do list · quote · callout
(tone + emoji) · code (language) · divider · image (+ caption, alt) · embed ·
toggle (`<details>`) · columns / column · table / tableRow / tableCell.

**Tables are three nested types, not one block with a grid attribute.** `attrs`
holds JSON scalars, so a 2-D array of cells could not live there — but the real
reason is that a cell is a place a caret goes, and every editable region in this
editor is a block. Rows and cells therefore get paths, ids, and the tree
operations for free.

Header-ness lives on the **cell** (`<th>` versus `<td>` is a cell property in the
HTML, so that is the only shape that round-trips an import faithfully); the
`<thead>` wrapper is _derived_ on the way out — "the first row, when all of its
cells are headers" — and never stored. Rows and cells declare no `tags`, so a
stray `<tr>` outside a table cannot parse into an orphan row block. Ragged
imports are squared up to the widest row at parse time, because every table
operation in the editor assumes a rectangle.

## Presentation — alignment, size, colour

The things a writer expects that are _styling_ rather than meaning, all handled
the same way: a **named value on a `data-` attribute**, pinned to an enumeration
by the sanitizer. The two that cannot be a name — a custom colour and a dragged
width — are the exception, and reach `style` under the rules below.

| what                    | where it lives                                                  | vocabulary                                              |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| block alignment         | `data-align` on the block's own tag                             | `left` (never written) · `center` · `right` · `justify` |
| table alignment         | `data-align` on the `<table>`                                   | the same four (the table's _box_, not its text)         |
| cell alignment          | `data-align` on the `<th>`/`<td>`                               | the same four                                           |
| cell vertical alignment | `data-valign` on the `<th>`/`<td>`                              | `top` (never written) · `middle` · `bottom`             |
| image width             | `data-size` on the `<figure>`                                   | `small` · `medium` · `large` · `full` (never written)   |
| dragged width           | inline `width` on a `<figure>`, `<th>`/`<td>`, `<table>`        | a percentage, 5–100                                     |
| text colour             | `data-color` on a `<span>`, or an inline `color`                | ten palette names, **or** a hex                         |
| highlight               | `data-highlight` on a `<mark>`, or an inline `background-color` | ten palette names, **or** a hex                         |

Four rules make this safe to store:

- **A name where there can be one.** A palette name is something the delivery
  surface maps onto its own colours, in light mode and dark, and `medium`
  survives a column whose width we will never know where `480px` does not. Names
  are what the picker offers first and what the editor writes by default.
- **`style` is opened per property, per tag, to a parsed value — never
  wholesale.** Two things need it, and neither has an attribute that could carry
  them. A **custom colour**: an author who needs their brand's exact colour has
  nowhere to put a name, and `data-color="#f43f5e"` is a value no stylesheet can
  turn into a colour. A **dragged width**: the number _is_ the choice, so there
  is nothing for a consumer to map. So the sanitizer permits `color` /
  `background-color` on `span` and `mark`, and `width` on `figure`, `table`,
  `th` and `td` — each validated by its own parser and re-written in canonical
  form (`STYLE_VALUE`). Everything else in `style`, on those tags and on every
  other, is still dropped. `rgb()` is accepted **only** because a browser
  rewrites a hex into it on parse, and is canonicalized straight back to hex so
  the stored value stays byte-stable; a width is a percentage or it is dropped,
  which is also what keeps `calc()`, custom properties and `url()` out.
- **The default is the absence of a value.** `left`, `top` and `full` are never
  written, so a paragraph someone centred and then un-centred serializes
  byte-identically to one nobody ever touched — which is what keeps revision
  diffs honest. A dragged width **replaces** the size preset rather than joining
  it: two statements of the same thing is two things to disagree.
- **The vocabulary is enforced in the sanitizer**, not by convention
  (`enumeratedAttributes`). It is the pass both runtimes share, so a value that
  survives it is one every consumer can rely on — and an unconstrained
  `data-color` invites exactly the open-ended styling this format exists to keep
  out of stored content.

**Column widths ride on the cells**, repeated down each column, and a table with
any of them is pinned to `width: 100%`. Both follow from the rendered table being
a _block_ box (which is what stops a wide table widening the page): a
`<colgroup>` inside a block box is at the mercy of anonymous-table generation,
where a width on the cell is honoured by every layout there is; and a percentage
resolved against a shrink-to-fit table would be a percentage of a number the
author cannot see. Repeating it down the column also means no row operation has
to remember to carry it, because no single row owns it.

A block type opts in with `aligns: true` and one `ctx.align(block)` call in its
`toHtml`; the parser restores `attrs.align` for it generically, so the round trip
costs a flag and a splice rather than a re-read in every `fromHtml`.

**What is deliberately not offered:** sizes in pixels, line-height,
letter-spacing. Each is a decision belonging to the surface the content is
rendered on, and baking it into stored HTML is how a CMS ends up with documents
that only look right in one theme. Custom colour and a dragged width are the
exceptions, and both are narrow on purpose — three properties, five tags, two
value shapes, all of it enforced in the pass both runtimes share.

## Sanitization — the security boundary

`lib/html/sanitize.ts` is an **allow-list**, not a filter. Unknown tags are
unwrapped (text survives, tag doesn't), unknown attributes dropped, every `on*`
handler dropped unconditionally, `style` dropped except for the few properties
named above, and `javascript:` / `data:` URLs rejected — including the
control-character obfuscations a naive `startsWith` misses. A link with
`target="_blank"` has `rel="noopener noreferrer"` forced on.

Two deliberate positions:

- **`<iframe>` is never allowed, not even for embeds.** An embed block stores its
  URL in `data-url` and renders a link; whether to frame a third party is a
  decision for the delivery surface and its CSP, and a sanitizer that permits
  iframes is one `srcdoc` away from permitting anything.
- **`data-*` rides through.** Block types round-trip their attributes on it, and
  a data attribute is inert — it cannot execute, and it cannot restyle the page
  the way a surviving `style` could.

Extending the schema with a type that emits a tag outside the policy means
extending the policy too. That is intentional: a new block type must not be able
to silently widen what HTML is storable.

## `normalizeWysiwygHtml` — what the server calls

A full round trip (parse → sanitize → interpret as blocks → serialize). It buys
three things a plain sanitize pass does not: **safety** (the allow-list, applied
where a client can't skip it), **stability** (the same content stores
byte-identically however it was written, so revision diffs show real edits), and
**truthfulness** (markup no block type corresponds to is reduced to markup the
editor can show). An empty document normalizes to `''`, not `<p></p>` — otherwise
every untouched field would read as filled in and `required` would pass.

## Dependencies

**Zero.** Including the HTML parser: `lib/html/parse-nodes.ts` is a small,
deliberately forgiving tokenizer + tree builder, because the input may be a value
an earlier editor wrote, an import, or a paste out of Word — unclosed tags and
stray `</div>`s must produce _something_ rather than throw, and `DOMParser` is
not available on the server.

## Commands

- `npx nx typecheck @ortha-cms/wysiwyg-core`
- `npx nx lint @ortha-cms/wysiwyg-core`
- `npx nx test @ortha-cms/wysiwyg-core` — DB-free unit tests for the tokenizer,
  the sanitizer (including XSS vectors), the parse/serialize round trip, and the
  plain-text helpers.
