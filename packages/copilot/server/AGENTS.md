# @ortha-cms/copilot-server

The copilot **plugin**. Phase 0 of
[`docs/design/copilot.md`](../../../docs/design/copilot.md) §9: it binds the
model seam and the plugin config, and **ships nothing visible**.

## What exists today

- `CopilotPlugin({ providers, resolve?, config })` — the standard `ServerPlugin`
  shape with `copilotConfig` attached, mirroring `MediaServerPlugin`.
- `CopilotModule.forRoot(...)` — a **global** dynamic module binding three
  values: `COPILOT_CONFIG`, `MODEL_REGISTRY` (from `buildModelRegistry`), and
  `MODEL_RESOLVER` (the host's handler, or a constant returning
  `config.defaultProvider`).
- `buildModelRegistry(providers)` — the immutable name→provider lookup.

## What deliberately does not exist yet

No controllers, no run engine, no tool registry, no MCP client, no schema, no
`drizzle.config.ts`, and therefore **no `migrations` descriptor** — the plugin
owns no tables. Adding them later is a `drizzle.config.ts` plus a `migrations`
entry on the plugin object, exactly as media does; nothing here has to move.

Phase 1 (the chat vertical slice) adds the SSE controller, the run engine, the
capability profile and conversation persistence. Phase 4 adds runtime model
config and the MCP client. Keep this file honest as those land.

## The model seam

Structurally identical to media storage, by decision
([ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md)):

| media                    | copilot                  |
| ------------------------ | ------------------------ |
| `StorageProvider`        | `ModelProvider`          |
| `buildRegistry`          | `buildModelRegistry`     |
| `STORAGE_REGISTRY`       | `MODEL_REGISTRY`         |
| `STORAGE_RESOLVER`       | `MODEL_RESOLVER`         |
| `config.defaultProvider` | `config.defaultProvider` |

**This package must never import a vendor SDK.** It imports the _config types_
of the two real adapters (so `ortha.config.ts` has one shape to fill in), which
are erased at runtime; it never imports their factories. Those are constructed
at the composition root and passed in.

`buildModelRegistry` snapshots the provider map into a **null-prototype**
object. Two reasons, both load-bearing: a later mutation of the host's map
can't reroute a run mid-flight, and a lookup of `constructor`/`toString` misses
instead of resolving something off `Object.prototype` that is not a provider.
(Media's `buildRegistry` still has the second issue — worth fixing there too.)

## Eager config validation

`CopilotPlugin` validates at **construction**, like `I18nServerPlugin`'s
locales and `ContentPlugin`'s registry: at least one provider registered, a
`defaultProvider` that names one of them, and a positive `maxOutputTokens`. A
host that mistypes a provider name fails before boot rather than on the first
chat message — the point where the mistake is most expensive to diagnose.

Being **disabled is not a wiring error**: `config.enabled: false` is the
default and constructs fine. That switch is the operator's kill switch
([ADR-0005](../../../docs/adr/0005-copilot-authority-model.md) §10), read by the
engine, not by the plugin factory.

## Permissions

`copilot:use` and `copilot:configure` live in `identity/server`'s `PERMISSIONS`,
not here — the catalogue has exactly one source of truth. **No migration:**
`seedSystemRoles` is idempotent and runs each boot from `PERMISSIONS` /
`SYSTEM_ROLES`, so the keys and grants land on next start. Viewers hold
`copilot:use` (ADR-0005 §10, resolved); `copilot:configure` is admin-only.

## Package

- Name: `@ortha-cms/copilot-server`
- Import: `import { CopilotPlugin } from '@ortha-cms/copilot-server'`
- Register **after** `WorkspacesPlugin` (runs are workspace-scoped) and
  `IdentityPlugin` (runs execute as the calling user)

## Configuration

Config flows from `apps/server/ortha.config.ts` (`plugins.copilot`, env-sourced)
into the plugin. The composition root selects the backend:

```typescript
CopilotPlugin({
    providers: {
        anthropic: createAnthropicProvider(config.plugins.copilot.anthropic),
        local: createOpenAiCompatibleProvider(
            config.plugins.copilot.openaiCompatible
        ),
        fake: createFakeProvider()
    },
    // Optional: route per run instead of using config.defaultProvider.
    // resolve: (ctx) => (isBigWorkspace(ctx.workspaceId) ? 'anthropic' : 'local'),
    config: config.plugins.copilot
});
```

## Commands

- `npx nx typecheck @ortha-cms/copilot-server`
- `npx nx lint @ortha-cms/copilot-server`
- `npx nx test @ortha-cms/copilot-server`
