import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../services/auth.service';
import { CookieService } from '../services/cookie.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

/**
 * Authenticates a request from the session cookie and attaches the resolved
 * user to it. Reads the opaque token via {@link CookieService}, resolves it to a
 * `PublicUser` with {@link AuthService} (the per-request DB lookup that enforces
 * revocation/expiry), then either sets `request.user` or throws a generic 401.
 *
 * Registered as the app-wide guard, so every route is protected by default;
 * opt a route or controller out with `@Public()` (e.g. login/logout). Handlers
 * read the resolved user with `@CurrentUser()`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly auth: AuthService,
        private readonly cookies: CookieService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()]
        );
        if (isPublic) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
        const sessionId = this.cookies.readSession(request);
        const user = sessionId ? await this.auth.currentUser(sessionId) : null;

        if (!user) {
            throw new UnauthorizedException();
        }

        request.user = user;
        return true;
    }
}
