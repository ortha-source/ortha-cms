# @ortha-cms/copilot-server

The copilot **plugin**. Phase 0 of
[`docs/design/copilot.md`](../../../docs/design/copilot.md) §9: it binds the
model seam and the plugin config, and **ships nothing visible**.

## What exists today

- `CopilotPlugin({ providers, resolve?, config })` — the standard `ServerPlugin`
  shape with `copilotConfig` attached. `providers` is a **list** of
  `{ name, provider }`, in preference order.
- `CopilotModule.forRoot(...)` — a **global** dynamic module binding three
  values: `COPILOT_CONFIG`, `MODEL_REGISTRY` (from `buildModelRegistry`), and
  `MODEL_RESOLVER` (the host's handler, or a constant returning
  `config.defaultProvider`).
- `buildModelRegistry(registrations)` — the immutable name→provider lookup,
  plus `catalogue()`: every provider × model pair on offer, in registration
  order. That is what a model picker renders.

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

**This package knows no adapter exists.** Its only `@ortha-cms` dependencies
are `copilot-domain` and `bootstrap-server` — it does not import a vendor SDK,
a factory, _or_ an adapter config type. That is what ADR-0004 §2 means by
"adding a provider is a new package, never a change to the engine": a Bedrock
adapter is a package plus one entry in `plugins.ts`, with nothing to change
here.

Provider _connection_ settings therefore live with the host, in
`apps/server/ortha.config.ts` under `OrthaCopilotConfig.providers`, typed by
importing each adapter's own config type. The host already imports the
factories, so that costs no new coupling.

### Why a list, not a map

`providers` is `readonly ProviderRegistration[]`, so registration order is
meaningful (the first entry reads as the house default, and `catalogue()`
renders in that order) and two providers of the same kind are just two entries:

```typescript
{ name: 'ollama-fast', provider: createOpenAiProvider({ models: ['llama3.1:8b'], … }) },
{ name: 'ollama-big',  provider: createOpenAiProvider({ models: ['llama3.1:70b'], … }) },
```

A list can express what a map cannot — a blank name, or the same name twice —
so `buildModelRegistry` rejects both explicitly. Silently keeping whichever
duplicate won would route runs to a backend nobody chose.

`buildModelRegistry` snapshots the provider map into a **null-prototype**
object. Two reasons, both load-bearing: a later mutation of the host's map
can't reroute a run mid-flight, and a lookup of `constructor`/`toString` misses
instead of resolving something off `Object.prototype` that is not a provider.
(Media's `buildRegistry` still has the second issue — worth fixing there too.)

## Eager config validation

`CopilotPlugin` validates at **construction**, like `I18nServerPlugin`'s
locales and `ContentPlugin`'s registry: at least one provider registered, every
provider declaring at least one model, a `defaultProvider` that names one of
them, and a positive `maxOutputTokens`. Name uniqueness is enforced by
`buildModelRegistry` over the same list. A host that mistypes a provider name
fails before boot rather than on the first chat message — the point where the
mistake is most expensive to diagnose.

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
