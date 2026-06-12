import { AVATAR_COLORS, type AvatarColor } from '@ortha-cms/design-system';

/**
 * Narrows an arbitrary color string — e.g. the persisted workspace `color`
 * returned by the users API — to a known {@link AvatarColor}, falling back to
 * `slate` (the server's own default) when the value isn't part of the palette.
 */
export function asAvatarColor(value: string): AvatarColor {
    return (AVATAR_COLORS as readonly string[]).includes(value)
        ? (value as AvatarColor)
        : 'slate';
}

/**
 * Derives a stable {@link AvatarColor} from an id by hashing it into the
 * palette. Member avatar colors aren't persisted by the server, so they're
 * derived client-side: deterministic (a given member always gets the same
 * accent) and spread across the palette so the table reads as distinct.
 */
export function avatarColorForId(id: string): AvatarColor {
    let hash = 0;
    for (let index = 0; index < id.length; index++) {
        hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
    }
    return AVATAR_COLORS[hash];
}
