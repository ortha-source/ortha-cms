/** Where the user is, derived from the URL. */
export interface RouteContext {
    /** The open workspace, or `null` outside one. */
    workspaceId: string | null;
    /** The content type in view, if any. */
    contentType?: string;
    /** The entry being edited, if any. */
    entryId?: string;
    /** The content locale in view, if any. */
    locale?: string;
    /** Which surface the user is looking at. */
    surface: 'chat' | 'entry' | 'records';
}

/** The locale switcher's query param (`?locale=de`), owned by `i18n/admin`. */
const LOCALE_PARAM = 'locale';

/**
 * Route segments that sit where an entry id would, but are not one. Sending
 * `entryId: "new"` would have the copilot confidently discuss an entry that
 * does not exist.
 */
const NOT_AN_ENTRY_ID = new Set(['new', 'trash']);

/**
 * Parses the admin's URL into the run's surface context.
 *
 * Pure, and separate from the hook, so every shape the content library can
 * produce — a records list, an editor, the create form, the trash view, a tab
 * segment, a locale query — is a unit test rather than a router fixture.
 *
 * Everything it returns is a *hint for resolving vague references* ("this
 * entry", "here"), never an authority claim. `workspaceId` becomes
 * `X-Workspace-Id`, which `WorkspaceGuard` validates for shape and membership;
 * `contentType` and `entryId` reach the model as prompt text, and any tool call
 * it makes with them is re-checked against the workspace's grants. A URL typed
 * by hand therefore gets a user nothing they didn't already have.
 */
export function readRouteContext(
    pathname: string,
    search: string
): RouteContext {
    const segments = pathname.split('/').filter(Boolean);

    // `/workspaces/:workspaceId/...` — the workspace shell.
    if (segments[0] !== 'workspaces' || !segments[1]) {
        return { workspaceId: null, surface: 'chat' };
    }
    const workspaceId = segments[1];

    // `/content/:contentType/...` — the content library. Any other section
    // (media, insights, settings) has no entry-level context to offer.
    const contentType =
        segments[2] === 'content' ? segments[3] : undefined;
    const candidate = contentType ? segments[4] : undefined;
    const entryId =
        candidate && !NOT_AN_ENTRY_ID.has(candidate) ? candidate : undefined;

    const locale =
        new URLSearchParams(search).get(LOCALE_PARAM) ?? undefined;

    return {
        workspaceId,
        ...(contentType ? { contentType } : {}),
        ...(entryId ? { entryId } : {}),
        ...(locale ? { locale } : {}),
        // An open entry is the strongest signal, then a type's record list.
        surface: entryId ? 'entry' : contentType ? 'records' : 'chat'
    };
}
