import {
    ValidatorConstraint,
    type ValidatorConstraintInterface
} from 'class-validator';

/**
 * A panel id: dot-separated camelCase segments, the first naming the plugin
 * that owns the panel (`shell.sidebar`, `copilot.agentsRail`). Bounded so a key
 * cannot carry a payload of its own.
 */
export const PANEL_ID_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){1,3}$/;

/** Longest accepted panel id, in characters. */
export const MAX_PANEL_ID_LENGTH = 64;

/**
 * Most panels one save may carry. The admin writes one or two at a time; this
 * only bounds a request that was not written by it.
 */
export const MAX_PANELS_PER_SAVE = 16;

/**
 * Most panels a user's stored map may hold once a save is merged over it —
 * enforced by the upsert itself (see `PreferencesService.save`), since a
 * per-request bound alone would let a client grow the map one save at a time.
 */
export const MAX_STORED_PANELS = 64;

/** Narrowest width accepted, in CSS pixels. Below any panel's own minimum. */
export const MIN_PANEL_WIDTH = 120;

/** Widest width accepted, in CSS pixels. Above any panel's own maximum. */
export const MAX_PANEL_WIDTH = 2000;

/** The only keys a panel's entry may carry. */
const ENTRY_KEYS = ['width', 'collapsed'] as const;

/** True for one `{ width?, collapsed? }` entry with nothing else in it. */
function isEntry(value: unknown): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const entry = value as Record<string, unknown>;
    const keys = Object.keys(entry);
    if (
        keys.length === 0 ||
        keys.some((key) => !(ENTRY_KEYS as readonly string[]).includes(key))
    ) {
        return false;
    }
    const { width, collapsed } = entry;
    if (
        width !== undefined &&
        !(
            Number.isInteger(width) &&
            (width as number) >= MIN_PANEL_WIDTH &&
            (width as number) <= MAX_PANEL_WIDTH
        )
    ) {
        return false;
    }
    return collapsed === undefined || typeof collapsed === 'boolean';
}

/**
 * Validates the `layout` bag of {@link UpdatePreferencesDto}: a map from panel
 * id to `{ width?, collapsed? }`. class-validator cannot decorate a `Record`'s
 * dynamic keys, so this checks every key and value — and rejects an unknown
 * inner key, since the nested object is out of reach of the app's
 * `forbidNonWhitelisted` pipe. Widths are whole pixels inside a generous band;
 * each panel's real bounds are the admin's business and are re-applied there
 * on read, so a stored width the admin has since narrowed is clamped, not
 * trusted.
 */
@ValidatorConstraint({ name: 'panelLayout' })
export class PanelLayoutConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        if (
            value === null ||
            typeof value !== 'object' ||
            Array.isArray(value)
        ) {
            return false;
        }
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0 || entries.length > MAX_PANELS_PER_SAVE) {
            return false;
        }
        return entries.every(
            ([id, entry]) =>
                id.length <= MAX_PANEL_ID_LENGTH &&
                PANEL_ID_RE.test(id) &&
                isEntry(entry)
        );
    }

    defaultMessage(): string {
        return `layout must map 1–${MAX_PANELS_PER_SAVE} panel ids to { width?: integer ${MIN_PANEL_WIDTH}–${MAX_PANEL_WIDTH}, collapsed?: boolean }`;
    }
}
