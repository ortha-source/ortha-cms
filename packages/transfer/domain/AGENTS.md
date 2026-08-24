# `@orthacms/transfer-domain`

The **transfer kernel** — what an export produces and an import consumes, with
no framework in sight. No NestJS, no Drizzle, no React: the server package holds
everything that touches a database or a byte stream, and the admin imports the
same vocabulary so its dialogs describe exactly what the server will do.

Layout is layered by concern, like `content/domain`:

| Folder      | What lives there                                                    |
| ----------- | ------------------------------------------------------------------- |
| `document/` | The `TransferDocument` contract — records, refs, assets, manifest.   |
| `schema/`   | The structural view of a content type transfer needs.               |
| `identity/` | Natural-key derivation and reading.                                 |
| `formats/`  | The `ExportSerializer` / `ImportParser` ports and the four formats. |
| `csv/`      | RFC 4180 encode/decode, and the record ⇄ row flattener.             |
| `import/`   | The id map and the verdict vocabulary.                              |
| `limits.ts` | The ceilings a transfer runs under.                                 |

## The rules that matter here

**A row id is not an identity.** It names one database. Everything an import can
do rests on the **natural key** instead — see `identity/natural-key.ts`. A
`localized` field is never a key candidate: its value differs per locale by
definition, so keying on one splits a record into one record per language.

**The schema type is structural, not imported.** `TransferTypeSchema` is shaped
so `content-server`'s `SerializedContentType` and `content-admin`'s
`ContentTypeDetail` are both assignable to it. That is what lets both runtimes
feed this kernel without an adapter and without this package depending on
either. Do not replace it with an import.

**The capability table is read by the UI.** `TRANSFER_FORMAT_CAPABILITIES` is
not documentation — the export dialog disables the files toggle from it, and the
server decides from it whether a request needs an archive. Adding a format means
adding a row there, a serializer, a parser, and nothing else.

**CSV is lossy on purpose, and predictably.** `csv/flatten.ts` documents each
loss. Media cells are deliberately **not** reconstructed on the way back: a
filename in a spreadsheet is not a file, and inventing an asset reference from
one relinks records to whatever happened to share a name.

**Nothing here reads a clock or a database.** Keep it that way — it is what makes
this half testable without a container.
