---
name: admin-plugin
description: Authoring or modifying an Ortha CMS admin plugin (packages/<group>/admin, e.g. users-admin). Covers the AdminPlugin factory (routes/layout/slots), the per-module `<name>/index.ts(x)` folder layout, lazy code-split routes, the api-module + per-query-hook data layer (apiClient + TanStack Query), useHasPermission gating, co-located react-intl messages, and slot contributions. Use when creating a new admin plugin, or adding a page/route/hook/component to an existing one. Companion to server-plugin (the API side), accessibility, and admin-e2e.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(npx nx *), Bash(npm exec nx *), Bash(npm install), Bash(git mv *)
---

# Ortha CMS admin plugins

An **admin plugin** is a workspace package under `packages/<group>/admin` (e.g.
`packages/billing/admin` → `@ortha-cms/billing-admin`) that contributes features
to the React admin SPA. It is **not an app**: it exports a factory the host
(`@ortha-cms/bootstrap-admin`) assembles into a running SPA via `createAdmin`.

> **Reference implementations:** `packages/users/admin` is the fullest worked
> example (routes, slot nav entry, a full api-module + query/mutation hooks,
> permission gating, an invite wizard). `packages/workspaces/admin` shows a
> create wizard + slug hook; `packages/shell/admin` owns the `layout` and a
> slot; `packages/identity/admin` owns auth (the gate + `useHasPermission`).
> When a detail here is unclear, read the closest one.

> Plugins are consumed **from source** (`exports` → `./src/index.ts`,
> `customConditions: ["@ortha-cms/source"]`). No build step; the admin app's
> Vite transpiles the plugin's TS/TSX directly. Never add a build to consume one.

This skill is the admin-side sibling of **`server-plugin`** (same philosophy,
applied to the browser), and the companion to **`accessibility`** (make the UI
accessible) and **`admin-e2e`** (test it). When you build a page, you author it
here, make it accessible, and add an admin-e2e suite.

## When this applies

- Creating a new `packages/<group>/admin` plugin.
- Adding a page, route, slot contribution, query/mutation hook, component, or
  type to an existing admin plugin.
- Wiring a plugin into the host (`apps/admin/src/main.tsx`).

---

## The five non-negotiables

1. **A plugin is an `AdminPlugin` factory** (`FooPlugin()` in
   `utils/<name>Plugin/`), not a component you import directly. It returns
   `{ name, routes?, layout?, slots? }`.
2. **Every top-level module is a `<name>/index.ts(x)` folder** — never flat
   files. Components `PascalCase` (`MembersTable/index.tsx`); everything else
   `camelCase` named for its export (`useMembers/index.ts`,
   `usersPlugin/index.tsx`, `types/member/index.ts`). No kebab-case, no dotted
   suffixes.
3. **Data lives in an api-module; hooks only bind it to TanStack Query.** One
   `api/<feature>Api/` module owns wire types, query-key factory, request
   functions (via `apiClient`), and wire→model mappers. Each `api/use*/` hook is
   a thin `useQuery`/`useMutation` over those functions. **No shared client
   class, no repository wrapper.**
4. **Gate on permissions with `useHasPermission`** (from
   `@ortha-cms/identity-admin`) — the UI mirror of the server's RBAC. A read
   page disables its query (`enabled`) until the permission is confirmed;
   write controls render only when permitted.
5. **i18n is co-located.** Each component declares its own module-level
   `const messages = defineMessages({ … })` with namespaced IDs
   (`<plugin>.<area>.<key>`). No shared `messages.ts`. The host owns the single
   `IntlProvider`.

---

## Folder layout — per-module `index` folders, grouped by feature

Each module is its own folder fronted by an `index`; the plugin factory lives in
`utils/`, pages in `pages/`, presentational pieces in `components/`, the data
layer in `api/`, shared contracts in `types/`, and reusable logic in `utils/` or
`hooks/`:

```
packages/<group>/admin/
  src/
    index.ts                          # public barrel — the package's API
    lib/
      utils/
        <plugin>Plugin/index.tsx      # the AdminPlugin factory — entry point
        initialsOf/index.ts           # pure helpers, one per folder
        avatarColor/index.ts
      pages/
        MembersPage/index.tsx         # a routed page (the container AND view)
        InviteMemberPage/index.tsx
      components/
        MembersTable/index.tsx        # presentational pieces
        MembersPagination/index.tsx
      api/
        membersApi/index.ts           # wire types + keys + request fns + mappers
        useMembers/index.ts           # useQuery hook over membersApi
        useInviteMember/index.ts      # useMutation hook
      hooks/
        useSlug/index.ts              # cross-component stateful logic
      types/
        member/index.ts               # shared, public type contracts
```

**Per-module folders, not flat files.** Even a one-file helper gets a
`<name>/index.ts` folder, for consistency. Tightly co-located sub-modules of a
component may stay flat beside its `index` (e.g.
`CreateWorkspaceWizard/useSlug.ts`, `LoginForm/LoginField/`).

**One concern per file — no page/container split.** The page _is_ the
container: `MembersPage` runs its own queries/mutations and renders directly.
Don't add a separate thin "route" wrapper.

**Co-locate request fn with concept, hook next door.** The request functions and
mappers live in `api/<feature>Api/`; the `use*` hooks import them. (Tiny
features may co-locate a single request fn directly in its hook file — see
identity's `login` + `useLoginMutation`.)

---

## Creating a new plugin — step by step

### 1. `package.json`

```jsonc
{
    "name": "@ortha-cms/<group>-admin",
    "version": "0.0.1",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "exports": {
        ".": {
            "types": "./src/index.ts",
            "import": "./src/index.ts",
            "default": "./src/index.ts"
        },
        "./package.json": "./package.json"
    },
    "files": ["src"],
    "dependencies": {
        "@ortha-cms/bootstrap-admin": "*",
        "@ortha-cms/design-system": "*",
        "@ortha-cms/identity-admin": "*", // if it gates on permissions
        "@ortha-cms/shell-admin": "*", // if it contributes a nav slot
        "@ortha-cms/utils-admin": "*", // apiClient / queryClient / createSlot
        "@tanstack/react-query": "^5.0.0",
        "@tanstack/react-form": "^1.0.0", // only if it has forms
        "lucide-react": "^1.17.0",
        "react-intl": "^7.0.0",
        "zod": "^4.4.3" // only if it validates forms
    },
    "peerDependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "react-router-dom": "^6.0.0"
    }
}
```

Match versions to existing admin packages (grep the repo) rather than inventing
them. The npm name stays **hyphenated** regardless of the nested folder
(`packages/<group>/admin` → `@ortha-cms/<group>-admin`). Mirror an existing
admin package's `tsconfig.json` / `tsconfig.lib.json`.

### 2. The plugin factory (the package's entry point)

```tsx
// src/lib/utils/<plugin>Plugin/index.tsx
import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { NAVBAR_START_SLOT } from '@ortha-cms/shell-admin';
import { Spinner } from '@ortha-cms/design-system';
import { Boxes } from 'lucide-react';

// Lazy so each page is code-split into its own chunk, fetched only when a
// user first navigates to it.
const WidgetsPage = lazy(() =>
    import('../../pages/WidgetsPage').then((m) => ({ default: m.WidgetsPage }))
);

/** Admin-side widgets plugin shape — a named alias of {@link AdminPlugin}. */
export type WidgetsAdminPlugin = AdminPlugin;

/** Creates the admin-side widgets plugin: the private `/widgets` route and
 * its toolbar nav entry. The page itself gates on `widgets:read`. */
export function WidgetsPlugin(): WidgetsAdminPlugin {
    return {
        name: 'widgets',
        routes: [
            {
                path: '/widgets',
                element: (
                    <Suspense fallback={<Spinner />}>
                        <WidgetsPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: NAVBAR_START_SLOT,
                items: [
                    {
                        labelId: 'widgets.nav.label',
                        defaultLabel: 'Widgets',
                        to: '/widgets',
                        order: 40, // after the existing entries
                        icon: Boxes
                    }
                ]
            }
        ]
    };
}
```

- **Routes default to private.** A route is private unless `public: true`. The
  host mounts private routes under the contributed `layout` (the shell's gated
  `AppShell`); public ones (e.g. a sign-in page) mount as top-level siblings.
- **Lazy + `<Suspense fallback={<Spinner />}>`** for every page — the standing
  code-split pattern.
- **`layout` is owned by the shell**, not feature plugins. Only contribute a
  `layout` if you are building the chrome (see `shell/admin`, which wraps
  `AppShell` in identity's `<AuthProvider><RequireAuth>` — the actual gate).

### 3. Contribute to a slot (optional)

A slot is a typed extension point created with `createSlot` in the plugin that
**owns** it (the shell owns `NAVBAR_START_SLOT`). A feature plugin only
contributes `items` to it via `slots`. The host wires every contribution before
render; it never defines or reads a slot. If you need a _new_ extension point,
define it (`createSlot<T>('<plugin>.<area>')`) in the plugin that renders it and
export it, then other plugins contribute.

### 4. The data layer — api-module + hooks

```ts
// src/lib/api/widgetsApi/index.ts — the whole HTTP contract in one file
import { apiClient } from '@ortha-cms/utils-admin';
import type { Widget, WidgetList } from '../../types/widget';

/** Query keys for the widgets cache; mutations invalidate `widgetsKeys.all`. */
export const widgetsKeys = {
    all: ['widgets'] as const,
    list: (params: WidgetsListParams) => ['widgets', 'list', params] as const
};

export type WidgetsListParams = { search?: string; page?: number };

/** Wire shape returned by `GET /api/widgets` (mirrors the server's view —
 * the admin can't import the server package across the module boundary). */
type WidgetResponse = { id: string; name: string };

/** Maps a widget from the wire to the admin's model. */
function toWidget(dto: WidgetResponse): Widget {
    return { id: dto.id, name: dto.name };
}

/** Fetches one page from `GET /api/widgets`. */
export async function fetchWidgets(
    params: WidgetsListParams
): Promise<WidgetList> {
    const { data } = await apiClient.get<{ items: WidgetResponse[] }>(
        '/widgets',
        { params }
    );
    return { items: data.items.map(toWidget) };
}
```

```ts
// src/lib/api/useWidgets/index.ts — the hook only binds the fn to Query
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    fetchWidgets,
    widgetsKeys,
    type WidgetsListParams
} from '../widgetsApi';

/** Fetches one page of widgets. Disabled until the caller confirms
 * `widgets:read`; `keepPreviousData` avoids a flash between pages. */
export function useWidgets(params: WidgetsListParams, enabled = true) {
    return useQuery({
        queryKey: widgetsKeys.list(params),
        queryFn: () => fetchWidgets(params),
        placeholderData: keepPreviousData,
        enabled
    });
}
```

- **`apiClient`** (axios, from `@ortha-cms/utils-admin`) targets the `/api`
  prefix via the dev proxy — request paths omit `/api` (`apiClient.get('/widgets')`).
- **Mutations** live in their own `useXxx` hooks and `invalidateQueries` the
  feature's root key on success.
- **Map wire→model in the api-module**, not in components. The admin restates
  the server's view types locally (no cross-app import).

### 5. Permission gating

```tsx
import { useHasPermission } from '@ortha-cms/identity-admin';

export function WidgetsPage() {
    const canRead = useHasPermission('widgets:read');
    const canCreate = useHasPermission('widgets:create');
    const { data, isPending } = useWidgets({}, canRead); // query disabled w/o read

    if (!canRead) return <WidgetsNoAccess />;
    return (
        <Container>
            <ContainerHeader
                title="Widgets"
                actions={canCreate ? <Button>New widget</Button> : undefined}
            />
            {/* … */}
        </Container>
    );
}
```

Gate **both** the data fetch (`enabled`) and the write controls. The server
enforces RBAC regardless; the UI gate is for UX, not security.

### 6. i18n — co-located messages

```tsx
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
    title: { id: 'widgets.page.title', defaultMessage: 'Widgets' }
});
// …
const intl = useIntl();
intl.formatMessage(messages.title);
```

IDs are namespaced `<plugin>.<area>.<key>` to stay globally unique. The host's
single `IntlProvider` resolves them from each descriptor's `defaultMessage`.

### 7. Barrel — `src/index.ts`

Export the public API only: the `XPlugin` factory + its type, plus any
hook/type/component a **consumer outside the package** uses. Keep internals
(api-module request fns, presentational components used only inside) out of the
barrel until something external needs them.

```ts
export { WidgetsPlugin } from './lib/utils/widgetsPlugin';
export type { WidgetsAdminPlugin } from './lib/utils/widgetsPlugin';
export { useWidgets } from './lib/api/useWidgets';
export type { Widget } from './lib/types/widget';
```

### 8. Register with the host

```tsx
// apps/admin/src/main.tsx — order is the nav/route order
createAdmin({
    plugins: [
        IdentityPlugin(),
        ShellPlugin(),
        WorkspacesPlugin(),
        UsersPlugin(),
        WidgetsPlugin() // ← new
    ]
});
```

### 9. Wire it up

```bash
npx nx sync                                   # after changing cross-project deps
npx nx run-many -t typecheck lint -p @ortha-cms/<group>-admin
```

---

## Design-system & UI

- Build UI from `@ortha-cms/design-system` primitives (`Button`, `Container`,
  `Select`, `Dialog`, …) — never hand-roll a styled element that exists there.
  Adding/changing a design-system component is the **`shadcn`** skill's job.
- Generic multi-step **wizard chrome** (`Stepper`, `WizardStepCard`,
  `WizardFooter`) lives in the design-system; configure it from the plugin
  (i18n + content stay in the consumer).
- Per-instance style overrides go via `className` on the design-system
  component — don't fork the component for a one-off (e.g. a select that should
  read like an input: `className="rounded-lg shadow-none"`).
- Accessibility is **not optional** — semantic HTML, labelled controls,
  keyboard support. Governed by the **`accessibility`** skill; verified by the
  **`admin-e2e`** axe + keyboard suites.

## TypeScript conventions (match the existing packages)

- `type` for type contracts (admin side prefers `type` over `interface`).
- **JSDoc on every exported symbol.**
- Import types with the `type` keyword (`import { type Widget }`).
- No `.js` extensions in TS imports; relative imports within the package.
- Prettier: 4-space indent, single quotes.

## New-plugin checklist

- [ ] `packages/<group>/admin` with `package.json` (`@ortha-cms/<group>-admin`,
      source `exports`, hyphenated name) + `tsconfig.json` / `tsconfig.lib.json`.
- [ ] `XPlugin()` factory in `utils/<plugin>Plugin/index.tsx` returning
      `{ name, routes, slots? }`; pages lazy + `<Suspense>`.
- [ ] Per-module `<name>/index.ts(x)` folders; no page/container split.
- [ ] Data layer: an `api/<feature>Api/` module (types + keys + fns + mappers)
      and thin `api/use*/` hooks over it.
- [ ] `useHasPermission` gating on the query (`enabled`) and write controls.
- [ ] Co-located `defineMessages` with `<plugin>.<area>.<key>` IDs.
- [ ] Public barrel `src/index.ts` (factory + type + external API only).
- [ ] Registered in `apps/admin/src/main.tsx`.
- [ ] A `CLAUDE.md` for the package documenting its decisions.
- [ ] An **admin-e2e suite** (`apps/admin-e2e`) for the page/flow — see the
      `admin-e2e` skill — including an axe scan (`accessibility` skill).
- [ ] `npx nx sync`, then `typecheck` + `lint` green.

## Commands

- `npx nx run-many -t typecheck lint -p @ortha-cms/<group>-admin`
- `npx nx sync` — after changing cross-project dependencies.
- `npx nx serve admin` — run the SPA with the plugin mounted.
- `npx nx e2e admin-e2e -- --project=chromium` — exercise the page in a browser.
