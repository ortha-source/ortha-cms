# `@orthacms/transfer-server`

The export/import **plugin**. Governed by the `server-plugin` skill; what
follows is what is specific to this one.

Owns **no tables and no migrations**. A transfer reads and writes content that
already exists; the only thing it adds is two audit events, which ride the
shared outbox.

| Folder     | What lives there                                                       |
| ---------- | ---------------------------------------------------------------------- |
| `archive/` | The hand-rolled ZIP writer and reader, plus CRC-32.                    |
| `schema/`  | Registry → kernel schema, and the one place identity fields are chosen.|
| `export/`  | The graph walk, the serializer glue, the routes.                       |
| `import/`  | The upload reader, the two-phase pipeline, the media path.             |

## The rules that matter here

**Every write goes through `EntryWriterService`.** Not "mostly" — every one.
That service is where field validation, the workspace scope, relation-target
checks, the same-locale rule, the media-asset check, revisions, the outbox and
the bound i18n extension live. An import that reached for a content table
directly would be a supported way to write rows none of those rules ever saw.

**The walk stops at one hop, and the references do not.** Depth-1 records still
get resolvable `$ref`s, filled by a key-only projection over the depth-2 rows.
A reference carrying only a foreign row id is unresolvable anywhere else, which
is the whole problem natural keys exist to solve.

**Locale handling reads the envelope, never the semantics.** `locale` and
`locale_group_id` are columns `content/server` defines for any `i18n: true`
type, so the walk asks "the other rows of this record" generically. On import
they are passed to `EntryWriterService` and the bound i18n extension validates
them. **This package must not depend on `@orthacms/i18n-server`.**

**The archive reader is the security boundary.** Read `archive/zip-reader.ts`
before touching it. The order of the checks is the defence: the central
directory first, so entry count, per-entry size, total size and compression
ratio are all refused *before* anything is inflated. Paths that climb out are
rejected, never sanitised.

**Storage cannot join the transaction.** A failed import deletes the blobs it
wrote. That bookkeeping is per-run and caller-owned (`ImportMediaRun`) — putting
it on the singleton service would let two concurrent imports roll back each
other's files.

**Nothing in an uploaded file names a workspace.** The manifest carries the
source workspace and the importer never reads it; the request's workspace is
stamped on every write.
