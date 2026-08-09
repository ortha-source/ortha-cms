# @ortha-cms/tools-server

The shared, transport-neutral catalogue of everything an agent can do to this
CMS — and the **single place a tool call is authorized**.

> [ADR-0007](../../../docs/adr/0007-one-tool-registry-two-surfaces.md) is why
> this package exists; [ADR-0006](../../../docs/adr/0006-cms-as-an-mcp-server.md)
> §2 is where the seam was first described (inside `mcp/server`, before it had
> two consumers).

## Two consumers, one registry

- **`mcp/server`** exposes it to external agents over `POST /api/v1/mcp`.
- **`copilot/server`**'s run loop injects the same instance in-process.

That is the whole reason nothing here mentions HTTP, JSON-RPC or MCP. A tool
added for either consumer is reachable by the other unless it says otherwise,
and neither can end up with a private set of rules.

**`ToolsModule` is imported by both, provided by neither.** If `McpModule`
provided the registry, a deployment running the copilot without MCP would have
no registry and no tools; if each provided its own, a capability plugin's tools
would land in whichever won. Nest caches a static module by class, so importing
it twice yields one instance — the invariant the whole seam rests on.

A capability plugin does **not** import `ToolsModule`. It injects `ToolRegistry`
`@Optional()` and registers itself from `onModuleInit`, because a deployment may
run neither consumer and its tools then simply go unregistered.

## The authorization invariant

`call()` checks `requires` **before dispatch**. `visibleTo()` merely _hides_
what the actor could not call anyway.

Filtering a list is a usability nicety — an MCP client is free to invoke a name
it was never shown, and a model may hallucinate one outright — so the check in
`call()` is the security boundary and must stay that way. This is the direct
analogue of `@RequirePermissions(...)` on a route: Nest gates _routes_, and both
consumers are one route carrying many operations.

`requires` is therefore a **security-critical field** that no type checker
validates. A new tool needs an authorization test.

## Surfaces

`surfaces?: readonly ('mcp' | 'copilot')[]`, and **omitted means both**.

Sharing a registry does not mean every tool suits every caller. Today the split
is total, for reasons that are not incidental:

|                   | MCP's content tools                   | The copilot's                                  |
| ----------------- | ------------------------------------- | ---------------------------------------------- |
| Reads through     | `PublicEntriesQuery` (published-only) | `EntriesService` (the admin's list)            |
| Drafts visible to | callers holding `content:update`      | anyone with `content:read` — a viewer too      |
| Writes attributed | `null` (a token is not a user)        | the accepting human                            |
| Write shape       | direct (`content_create`)             | `propose` → a reviewed `copilot_proposals` row |

A viewer's copilot offered `content_list` would silently stop seeing drafts,
which is most of what the chat panel is for. So the tool declares its audience
rather than a filter elsewhere guessing.

`forSurface` narrows the catalogue **and** `call` applies the same narrowing,
for the same reason the permission check is in `call`: a caller may name a tool
it was never shown. Cross-surface leakage is covered by e2e cases in both
suites — a `surfaces` omitted from a propose tool would make it callable by an
MCP client that has no way to accept the resulting proposal.

## `effect` vs `readOnly`

Two vocabularies, because they answer different questions:

- **`readOnly` / `destructive`** are MCP's client hints — what is safe to
  auto-approve in a tool picker.
- **`effect`** (`read | propose | apply`) is the authority vocabulary: whether a
  handler's return value is a _result_ or a _change_. It is what makes the
  copilot's run engine persist a proposal instead of a tool result.

A `propose` tool is not read-only in the MCP sense (it is half of a write flow),
and a direct-write tool is not `propose` however destructive it is. Neither
field can be derived from the other.

## Naming

`snake_case`, unique across every provider — a duplicate is a wiring bug and
`all()` throws rather than letting registration order decide which
implementation runs. Namespaced by subject (`content_list`, `content_create`);
the copilot's admin-scoped counterparts carry an `admin_` prefix
(`admin_content_search`) so the two sets read apart at the call site and in
every audit row.

## Conventions

- `interface` for contracts, `type` for unions
- All exported symbols carry JSDoc
- No `.js` extensions in imports; always `import type` for types

## Commands

- `npx nx typecheck @ortha-cms/tools-server`
- `npx nx lint @ortha-cms/tools-server`
- `npx nx test @ortha-cms/tools-server`
