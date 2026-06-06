import { SetMetadata } from '@nestjs/common';

/**
 * Reflector key marking a route or controller as exempt from
 * {@link AuthGuard}. Internal to the auth feature; set it via {@link Public}.
 */
export const IS_PUBLIC_KEY = 'identity:isPublic';

/**
 * Marks a route or controller as public so the app-wide {@link AuthGuard} skips
 * it and requires no session. Use only for endpoints that must work
 * pre-authentication, such as `/auth/login` and `/auth/logout`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
