import type { ReactNode } from 'react';

/** A route a plugin mounts into the app router. */
export type RouteItem = {
    /** Route path (e.g. "/users/*"). */
    path: string;
    /** Element rendered at that path. */
    element: ReactNode;
    /**
     * When `true`, the route mounts as a top-level sibling (e.g. the sign-in
     * page). Omitted/`false` means it mounts under the contributed `layout`.
     * The host attaches no auth meaning to this — whether "under the layout"
     * means "gated" is up to the layout (the shell wraps it in identity's
     * `RequireAuth`).
     */
    public?: boolean;
};

/**
 * Contract every admin-side plugin must implement: a name, the routes it
 * contributes, and optionally the layout its non-`public` siblings render
 * inside.
 */
export type AdminPlugin = {
    /** Unique identifier. */
    name: string;
    /** Routes this plugin contributes. */
    routes?: RouteItem[];
    /**
     * The app shell — chrome that renders an `<Outlet/>`. The host mounts the
     * first plugin-provided `layout` as the single parent of every non-`public`
     * route. The host treats it as opaque; the shell plugin composes its auth
     * provider + gate inside it. Omitted by most plugins.
     */
    layout?: ReactNode;
};

/** Options for {@link createAdmin}. */
export type CreateAdminOptions = {
    /** Plugins to register. */
    plugins: AdminPlugin[];
    /** DOM element id to mount into. Defaults to "root". */
    rootElement?: string;
    /** Active locale for `react-intl`. Defaults to "en". */
    locale?: string;
};
