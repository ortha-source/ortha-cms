import {
    Controller,
    Delete,
    Get,
    HttpCode,
    Inject,
    Param,
    ParseUUIDPipe,
    Req,
    UseGuards
} from '@nestjs/common';
import type { Request } from 'express';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../rbac/system-roles';
import {
    SESSION_REPOSITORY,
    type SessionRepository
} from '../../domain/session.repository';
import { OriginGuard } from '../guards/origin.guard';
import { CookieService } from '../services/cookie.service';
import { HashingService } from '../services/hashing.service';

/** One session row as the admin Sessions tab consumes it over the wire. */
export interface UserSessionResponse {
    /** Revocation handle (the session row id). */
    id: string;
    /** Originating `User-Agent`, if captured. */
    userAgent: string | null;
    /** Originating IP, if captured. */
    ipAddress: string | null;
    /** When the session was opened (ISO-8601 on the wire). */
    createdAt: Date;
    /** Last authenticated request seen on this session. */
    lastUsedAt: Date;
    /** Absolute expiry. */
    expiresAt: Date;
    /**
     * Whether this row is the **caller's own** presented session — set only
     * when an admin views their own detail page, so the UI can label it and
     * keep the admin from revoking the device they are working from.
     */
    current: boolean;
}

/**
 * Admin session management for a single member, under `/api/users/:id`:
 *
 * - `GET /api/users/:id/sessions` — the member's live sessions (`users:read`).
 * - `DELETE /api/users/:id/sessions/:sessionId` — revoke one (`users:update`),
 *   `Origin`-guarded like the other state-changing routes. Idempotent: an
 *   unknown/already-revoked session, or one not owned by `:id`, still 204s.
 *
 * The `current` flag is derived from the caller's own session cookie, so it is
 * only ever true when an admin inspects their own sessions.
 */
@UseGuards(PermissionsGuard)
@Controller('users')
export class UserSessionsController {
    constructor(
        @Inject(SESSION_REPOSITORY)
        private readonly sessions: SessionRepository,
        private readonly cookies: CookieService,
        private readonly hashing: HashingService
    ) {}

    @Get(':id/sessions')
    @RequirePermissions(PERMISSIONS.USERS_READ)
    async list(
        @Req() req: Request,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<UserSessionResponse[]> {
        const currentId = this.currentSessionId(req);
        const rows = await this.sessions.listForUser(id);
        return rows.map((row) => ({
            ...row,
            current: currentId != null && row.id === currentId
        }));
    }

    @Delete(':id/sessions/:sessionId')
    @RequirePermissions(PERMISSIONS.USERS_UPDATE)
    @UseGuards(OriginGuard)
    @HttpCode(204)
    async revoke(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('sessionId') sessionId: string
    ): Promise<void> {
        await this.sessions.revokeById(id, sessionId);
    }

    /** Hashes the caller's session cookie to its row id, or `null` if absent. */
    private currentSessionId(req: Request): string | null {
        const token = this.cookies.readSession(req);
        return token ? this.hashing.hashToken(token) : null;
    }
}
