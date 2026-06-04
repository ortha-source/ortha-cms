import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable
} from '@nestjs/common';
import type { Request } from 'express';
import type { IdentityPluginConfig } from '../types';
import { InjectIdentityConfig } from '../identity.tokens';

/**
 * Rejects a state-changing request whose browser-set `Origin` is not an
 * allow-listed app origin — a lightweight login-CSRF defense. Requests with no
 * `Origin` (non-browser clients, same-origin navigations) pass: browsers always
 * attach `Origin` to cross-site POSTs, which is exactly the case this blocks.
 * Pair it with `SameSite` cookies; it is not a substitute for a CSRF token on
 * higher-value mutations.
 */
@Injectable()
export class OriginGuard implements CanActivate {
    constructor(
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const origin = request.headers.origin;

        if (!origin || this.config.allowedOrigins.includes(origin)) {
            return true;
        }
        throw new ForbiddenException('Origin not allowed');
    }
}
