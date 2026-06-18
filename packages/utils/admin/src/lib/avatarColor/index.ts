import { AVATAR_COLORS, type AvatarColor } from '@ortha-cms/design-system';

/**
 * Narrows an arbitrary color string — e.g. a persisted `color` returned by an
 * API — to a known {@link AvatarColor}, falling back to `slate` (the palette's
 * neutral default) when the value isn't part of the palette.
 */
export function asAvatarColor(value: string): AvatarColor {
    return (AVATAR_COLORS as readonly string[]).includes(value)
        ? (value as AvatarColor)
        : 'slate';
}

/**
 * Derives a stable {@link AvatarColor} from an id by hashing it into the
 * palette. Used where avatar colors aren't persisted and so are derived
 * client-side: deterministic (a given id always gets the same accent) and
 * spread across the palette so a roster reads as distinct.
 */
export function avatarColorForId(id: string): AvatarColor {
    let hash = 0;
    for (let index = 0; index < id.length; index++) {
        hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
    }
    return AVATAR_COLORS[hash];
}
