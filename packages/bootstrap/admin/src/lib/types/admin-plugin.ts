import type { ReactNode } from 'react';

/** A route a plugin mounts into the app router. */
export type RouteItem = {
    /** Route path (e.g. "/users/*"). */
    path: string;
    /** Element rendered at that path. */
    element: ReactNode;
};

/**
 * Contract every admin-side plugin must implement. For now a plugin is a
 * name plus the routes it contributes; slots/nav come later.
 */
export type AdminPlugin = {
    /** Unique identifier. */
    name: string;
    /** Routes this plugin contributes. */
    routes?: RouteItem[];
};

/** Options for {@link createAdmin}. */
export type CreateAdminOptions = {
    /** Plugins to register. */
    plugins: AdminPlugin[];
    /** DOM element id to mount into. Defaults to "root". */
    rootElement?: string;
};
