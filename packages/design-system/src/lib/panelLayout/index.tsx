import {
    createContext,
    useCallback,
    useContext,
    useState,
    useSyncExternalStore,
    type ReactNode
} from 'react';

/**
 * One resizable panel's remembered layout. Both fields are optional: a panel
 * that has never been resized has no `width` (it renders at its default), and
 * one that cannot collapse never records `collapsed`.
 */
export type PanelLayoutEntry = {
    /** Width in CSS pixels. */
    width?: number;
    /** Whether a collapsible panel is collapsed. */
    collapsed?: boolean;
};

/**
 * Every panel's layout, keyed by a panel id the panel's owner picks —
 * `<plugin>.<panel>`, e.g. `shell.sidebar`, `copilot.agentsRail`. The map is
 * open, so a plugin adds a panel by naming it; nothing here lists them.
 */
export type PanelLayout = Record<string, PanelLayoutEntry>;

/**
 * The store behind {@link PanelLayoutProvider}: the current layout, plus the
 * two ways it changes — a **user** change (`update`), which is announced to
 * {@link PanelLayoutStore.onChange} listeners so they can persist it, and a
 * **hydrate** from durable storage, which is not (persisting what was just
 * read would be an echo).
 */
export type PanelLayoutStore = {
    /** The current layout. A new object after every change; never mutated. */
    getSnapshot: () => PanelLayout;
    /** Subscribe to any change; returns the unsubscribe. */
    subscribe: (listener: () => void) => () => void;
    /** Apply a user's change to one panel and announce it. */
    update: (id: string, patch: PanelLayoutEntry) => void;
    /**
     * Apply a layout read from durable storage. A panel the user has already
     * changed since this store was created keeps the user's value — the read
     * is older than the change, and the change is on its way to storage.
     */
    hydrate: (layout: PanelLayout) => void;
    /** Subscribe to user changes (one panel's new entry each); returns the unsubscribe. */
    onChange: (listener: (changes: PanelLayout) => void) => () => void;
};

/** True for a finite, positive pixel width. */
function isWidth(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Keeps only well-formed entries — `localStorage` and the network are both
 * outside this code's control, and a corrupt entry must cost that one panel
 * its preference, not the page its render.
 */
export function sanitizePanelLayout(value: unknown): PanelLayout {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const out: PanelLayout = {};
    for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
        if (raw === null || typeof raw !== 'object') continue;
        const { width, collapsed } = raw as Record<string, unknown>;
        const entry: PanelLayoutEntry = {};
        if (isWidth(width)) entry.width = Math.round(width);
        if (typeof collapsed === 'boolean') entry.collapsed = collapsed;
        if (entry.width !== undefined || entry.collapsed !== undefined) {
            out[id] = entry;
        }
    }
    return out;
}

/** Reads the cached layout, tolerating absent, blocked or corrupt storage. */
function readCache(storageKey: string | undefined): PanelLayout {
    if (!storageKey || typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(storageKey);
        return raw ? sanitizePanelLayout(JSON.parse(raw)) : {};
    } catch {
        return {};
    }
}

/** Writes the cached layout. Best-effort — losing the cache is survivable. */
function writeCache(storageKey: string | undefined, layout: PanelLayout) {
    if (!storageKey || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
        // Private mode, quota — the layout still holds for this page's life.
    }
}

/** True when `patch` would leave `entry` as it is. */
function changesNothing(
    entry: PanelLayoutEntry | undefined,
    patch: PanelLayoutEntry
): boolean {
    return Object.entries(patch).every(
        ([key, value]) => entry?.[key as keyof PanelLayoutEntry] === value
    );
}

/**
 * Creates a {@link PanelLayoutStore}. With a `storageKey` the layout is cached
 * in `localStorage` under it — read once here, so the first frame already has
 * the user's widths, and rewritten on every change. Without one the store is
 * in-memory only.
 */
export function createPanelLayoutStore(storageKey?: string): PanelLayoutStore {
    let snapshot = readCache(storageKey);
    // Panels the user has changed since this store was created. A hydrate is
    // a read that may have been in flight during the change, so it must not
    // put the old value back.
    const touched = new Set<string>();
    const listeners = new Set<() => void>();
    const changeListeners = new Set<(changes: PanelLayout) => void>();

    const commit = (next: PanelLayout) => {
        snapshot = next;
        writeCache(storageKey, snapshot);
        listeners.forEach((listener) => listener());
    };

    return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        update: (id, patch) => {
            const current = snapshot[id];
            if (changesNothing(current, patch)) return;
            const entry = { ...current, ...patch };
            touched.add(id);
            commit({ ...snapshot, [id]: entry });
            changeListeners.forEach((listener) => listener({ [id]: entry }));
        },
        hydrate: (layout) => {
            const incoming = sanitizePanelLayout(layout);
            const next: PanelLayout = { ...snapshot };
            let changed = false;
            for (const [id, entry] of Object.entries(incoming)) {
                if (touched.has(id)) continue;
                const current = next[id];
                if (
                    current?.width === entry.width &&
                    current?.collapsed === entry.collapsed
                ) {
                    continue;
                }
                next[id] = entry;
                changed = true;
            }
            if (changed) commit(next);
        },
        onChange: (listener) => {
            changeListeners.add(listener);
            return () => changeListeners.delete(listener);
        }
    };
}

const PanelLayoutContext = createContext<PanelLayoutStore | null>(null);

/**
 * Holds the layout of every resizable panel under it — widths and collapsed
 * states — so the panels read one store however far apart they render (the app
 * sidebar, the right panel, a page's own column).
 *
 * The provider persists only to its `localStorage` cache, which is what lets
 * the first frame render at the user's widths. **Durable** storage is the
 * host's business: something that can reach the user's preferences subscribes
 * through {@link usePanelLayoutSync}, hydrates the store with what it reads and
 * saves what {@link PanelLayoutStore.onChange} announces — the same split as
 * `AppearanceProvider`, which knows nothing about the server either.
 *
 * Remount it (a React `key`) when `storageKey` changes; the store is created
 * once per mount.
 */
export function PanelLayoutProvider({
    storageKey,
    children
}: {
    /** `localStorage` key for the cache — scope it per user. Omit for none. */
    storageKey?: string;
    children: ReactNode;
}) {
    const [store] = useState(() => createPanelLayoutStore(storageKey));
    return (
        <PanelLayoutContext.Provider value={store}>
            {children}
        </PanelLayoutContext.Provider>
    );
}

/**
 * One panel's stored entry and a setter that records a user's change to it.
 * Re-renders only when *this* panel's entry changes.
 */
export function usePanelLayoutEntry(
    id: string
): [PanelLayoutEntry | undefined, (patch: PanelLayoutEntry) => void] {
    // Outside a provider (a test, a story, a page mounted on its own) the panel
    // gets a store of its own: it still resizes and collapses, it just shares
    // and remembers nothing. Per hook rather than one module-wide store, which
    // would carry one mount's layout into every later one.
    const [ownStore] = useState(createPanelLayoutStore);
    const store = useContext(PanelLayoutContext) ?? ownStore;
    const entry = useSyncExternalStore(
        store.subscribe,
        () => store.getSnapshot()[id]
    );
    const update = useCallback(
        (patch: PanelLayoutEntry) => store.update(id, patch),
        [store, id]
    );
    return [entry, update];
}

/**
 * The store itself, for the bridge that persists it durably — `hydrate` with
 * what was read, `onChange` to save. `null` outside a
 * {@link PanelLayoutProvider}, where there is nothing to persist.
 */
export function usePanelLayoutSync(): Pick<
    PanelLayoutStore,
    'hydrate' | 'onChange'
> | null {
    return useContext(PanelLayoutContext);
}
