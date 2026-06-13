---
name: admin-plugin
description: Authoring, modifying, or reviewing an Ortha CMS admin plugin (packages/<group>/admin, e.g. users-admin). Covers the AdminPlugin factory (routes/layout/slots), the per-module `<name>/index.ts(x)` folder layout, lazy code-split routes, the per-hook data layer (apiClient + TanStack Query, each hook owning its request fn), useHasPermission gating, co-located react-intl messages, slot contributions, and the review-critical data/page pitfalls (clamp page to pageCount after mutations, error-vs-empty state, mapper fallbacks that silently rewrite data, over-invalidation). Use when creating a new admin plugin, adding a page/route/hook/component, or reviewing a change to one. Companion to server-plugin (the API side), accessibility, and admin-e2e.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(npx nx *), Bash(npm exec nx *), Bash(npm install), Bash(git mv *)
---

# Ortha CMS admin plugins

An **admin plugin** is a workspace package under `packages/<group>/admin` (e.g.
`packages/billing/admin` → `@ortha-cms/billing-admin`) that contributes features
to the React admin SPA. It is **not an app**: it exports a factory the host
(`@ortha-cms/bootstrap-admin`) assembles into a running SPA via `createAdmin`.

> **Reference implementations:** `packages/users/admin` is the fullest worked
> example (routes, slot nav entry, a per-hook data layer with shared mapper +
> query keys in `utils/`, permission gating, an invite wizard).
> `packages/workspaces/admin` shows a create wizard + slug hook and the
> read-hook-exports-the-mapper variant (`useWorkspaces` exports `toWorkspace`);
> `packages/shell/admin` owns the `layout` and a slot; `packages/identity/admin`
> owns auth (the gate + `useHasPermission`). When a detail here is unclear, read
> the closest one.

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
3. **Each `use*` hook owns its endpoint; nothing centralizes the data layer.**
   A hook's `api/use*/` folder holds its request function (via `apiClient`), its
   request/response wire types, and the thin `useQuery`/`useMutation` over them —
   all in one file. Genuinely shared pieces (the wire→model mapper, the query-key
   factory) live in **one** place every hook imports: either the owning read hook
   (workspaces exports `toWorkspace` from `useWorkspaces`) or a `lib/utils/`
   folder (users has `utils/toMember` + `utils/membersKeys`). **No central
   `*Api` module, no shared client class, no repository wrapper.**
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
        membersKeys/index.ts          # shared query-key factory + list params
        toMember/index.ts             # shared wire types + wire→model mapper
      pages/
        MembersPage/index.tsx         # a routed page (the container AND view)
        InviteMemberPage/index.tsx
      components/
        MembersTable/index.tsx        # presentational pieces
        MembersPagination/index.tsx
      api/
        useMembers/index.ts           # fetchMembers + envelope type + useQuery
        useInviteMember/index.ts      # inviteMember + InviteMemberInput + useMutation
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

**Request fn lives in its hook file.** Each `api/use*/` hook declares its own
request function and that endpoint's wire types right above the hook (see
identity's `useLoginMutation`, workspaces' `useWorkspaces`). Only pieces *several
hooks share* — the wire→model mapper and the query-key factory — are lifted out,
to the owning read hook or a `lib/utils/` folder (never to a catch-all `*Api`
module that re-centralizes the layer).

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

### 4. The data layer — one folder per hook, shared pieces in `utils/`

Shared across hooks — the query keys and the wire→model mapper — go in `utils/`
(or export them from the read hook for a tiny feature):

```ts
// src/lib/utils/widgetsKeys/index.ts — keys + the list query's params
export type WidgetsListParams = { search?: string; page?: number };

/** Query keys for the widgets cache; mutations invalidate `widgetsKeys.all`. */
export const widgetsKeys = {
    all: ['widgets'] as const,
    list: (params: WidgetsListParams) => ['widgets', 'list', params] as const
};
```

```ts
// src/lib/utils/toWidget/index.ts — shared wire types + the mapper
import type { Widget } from '../../types/widget';

/** Wire shape returned by the widgets API (mirrors the server's view — the
 * admin can't import the server package across the module boundary). */
export type WidgetResponse = { id: string; name: string };

/** Maps a widget from the wire to the admin's model. */
export function toWidget(dto: WidgetResponse): Widget {
    return { id: dto.id, name: dto.name };
}
```

Each hook then owns its own request fn + endpoint types:

```ts
// src/lib/api/useWidgets/index.ts — request fn + envelope type + the hook
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { WidgetList } from '../../types/widget';
import { widgetsKeys, type WidgetsListParams } from '../../utils/widgetsKeys';
import { toWidget, type WidgetResponse } from '../../utils/toWidget';

/** The paginated envelope `GET /api/widgets` returns. */
type WidgetListResponse = { items: WidgetResponse[] };

/** Fetches one page from `GET /api/widgets`. */
async function fetchWidgets(params: WidgetsListParams): Promise<WidgetList> {
    const { data } = await apiClient.get<WidgetListResponse>('/widgets', {
        params
    });
    return { items: data.items.map(toWidget) };
}

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

```ts
// src/lib/api/useCreateWidget/index.ts — a mutation hook, same shape
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { Widget } from '../../types/widget';
import { widgetsKeys } from '../../utils/widgetsKeys';
import { toWidget, type WidgetResponse } from '../../utils/toWidget';

/** Body the create form submits. */
export type CreateWidgetInput = { name: string };

/** Creates a widget via `POST /api/widgets`. */
async function createWidget(input: CreateWidgetInput): Promise<Widget> {
    const { data } = await apiClient.post<WidgetResponse>('/widgets', input);
    return toWidget(data);
}

/** Creates a widget, then refreshes every cached widgets page. */
export function useCreateWidget() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createWidget,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: widgetsKeys.all });
        }
    });
}
```

- **`apiClient`** (axios, from `@ortha-cms/utils-admin`) targets the `/api`
  prefix via the dev proxy — request paths omit `/api` (`apiClient.get('/widgets')`).
- **The request fn stays module-private** to its hook (no `export`); only the
  input/output **types** are exported where a component needs them.
- **Mutations** `invalidateQueries` the feature's root key (`widgetsKeys.all`)
  on success.
- **Map wire→model in the shared mapper**, not in components. The admin restates
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
enforces RBAC regardless; the UI gate is for UX, not security. The permission
strings are a **mirror** of the server's matrix and must match it **exactly**
(`'users:read'` here ⇔ the server's `@RequirePermissions('users:read')`) — a typo
silently hides UI a user should see (or shows one the server then 403s), with no
error to catch it.

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
(per-hook request fns, presentational components used only inside) out of the
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

## Data & page pitfalls (review-critical)

The recurring admin-side mistakes a careful review catches:

- **Paginated pages: clamp the page.** After a mutation removes the last row on a
  trailing page (revoke/disable/delete), `page` can point past `pageCount`; the
  refetch then lands on an out-of-range **empty** page with the pager hidden and
  the user stranded. Reset or clamp `page` to `pageCount` when the total shrinks —
  not just on search/page-size change.
- **Distinguish error from empty.** Give `isError` its own state (a message, a
  retry) — never fall through into the empty-list "nothing here yet" state. A
  failed load that reads as "no rows" misleads the operator (e.g. re-inviting
  someone who already exists).
- **Mapper fallbacks must not rewrite data on round-trip.** When a wire field is
  open-ended (a `role.key` the UI's union doesn't know), a mapper default
  (`… : 'viewer'`) is fine for *display*, but submitting the form then **persists
  the fallback** — silently demoting the record. When the form can't faithfully
  represent a value, disable the control (or preserve the original) rather than
  defaulting it into a save.
- **Don't over-invalidate blindly.** Mutations that already return the updated
  row can `setQueryData` the current page instead of invalidating every cached
  list page; invalidate the root key when you genuinely can't place the change.

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
- [ ] Data layer: one `api/use*/` folder per hook (request fn + endpoint types +
      the hook); shared mapper + query keys in `lib/utils/` (or the read hook).
- [ ] `useHasPermission` gating on the query (`enabled`) and write controls;
      permission strings match the server's matrix exactly.
- [ ] Paginated pages clamp `page` to `pageCount` after mutations; `isError` has
      its own state (not the empty state).
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
