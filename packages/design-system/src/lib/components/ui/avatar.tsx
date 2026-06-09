import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '../../utils';

const Avatar = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Root
        ref={ref}
        className={cn(
            'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
            className
        )}
        {...props}
    />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Image>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Image
        ref={ref}
        className={cn('aspect-square h-full w-full', className)}
        {...props}
    />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Fallback>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Fallback
        ref={ref}
        className={cn(
            'flex h-full w-full items-center justify-center rounded-full bg-muted',
            className
        )}
        {...props}
    />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/**
 * The accent palette — the only color in the otherwise-neutral admin. Used to
 * tint initials avatars (workspaces, members, and later users). Backed by the
 * `--color-avatar-*` tokens in the host's `styles.css`.
 */
export const AVATAR_COLORS = [
    'slate',
    'green',
    'amber',
    'violet',
    'rose',
    'teal',
    'indigo'
] as const;

/** One of the {@link AVATAR_COLORS} accent keys. */
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Resolves an {@link AvatarColor} to its CSS custom-property reference. */
export const avatarColorVar = (color: AvatarColor) =>
    `var(--color-avatar-${color})`;

export { Avatar, AvatarImage, AvatarFallback };
