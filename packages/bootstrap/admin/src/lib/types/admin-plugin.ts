import type { ComponentType, ReactNode } from 'react';

/** A route a plugin mounts into the app router. */
export type RouteItem = {
    /** Route path (e.g. "/users/*"). */
    path: string;
    /** Element rendered at that path. */
    element: ReactNode;
    /**
     * When `true`, the route renders for anyone (e.g. the sign-in page).
     * Omitted/`false` means it is gated — it mounts under the host's single
     * authenticated layout and only authenticated users reach it.
     * Protected-by-default mirrors the server, where every route is guarded
     * unless marked `@Public()`.
     */
    public?: boolean;
};

/**
 * Contract every admin-side plugin must implement: a name, the routes it
 * contributes, optionally one app-level provider it wraps the whole app in, and
 * optionally the authenticated shell its private siblings render inside.
 */
export type AdminPlugin = {
    /** Unique identifier. */
    name: string;
    /** Routes this plugin contributes. */
    routes?: RouteItem[];
    /**
     * App-level context provider the host nests around the router. Lets a
     * plugin supply cross-cutting state (e.g. identity's current-user state
     * feeding the host's auth context) without the host knowing the plugin's
     * endpoints.
     */
    provider?: ComponentType<{ children: ReactNode }>;
    /**
     * The authenticated app shell — chrome (nav, layout) that renders an
     * `<Outlet/>`. The host mounts the first plugin-provided `layout` as the
     * single guarded parent of every non-`public` route. Omitted by most
     * plugins; contributed by the shell plugin.
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
    /**
     * Where the guard sends unauthenticated users who hit a private route.
     * Defaults to "/identity/signin".
     */
    signInPath?: string;
};
