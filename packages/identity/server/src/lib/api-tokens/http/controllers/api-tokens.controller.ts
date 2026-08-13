import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards
} from '@nestjs/common';
import { PermissionsGuard } from '../../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../rbac/system-roles';
import { OriginGuard } from '../../../auth/guards/origin.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { PublicUser } from '../../../auth/services/auth.service';
import {
    ApiTokenService,
    type ApiTokenView
} from '../../application/api-token.service';
import { UnknownWorkspaceError } from '../../domain/unknown-workspace.error';
import { CreateApiTokenDto } from '../dto/create-api-token.dto';
import {
    API_TOKENS_DEFAULT_PAGE_SIZE,
    ListApiTokensQueryDto
} from '../dto/list-api-tokens-query.dto';

/** The create response — the token metadata plus its one-time plaintext. */
export interface CreateApiTokenResponse extends ApiTokenView {
    /** The raw bearer token. Shown once; never retrievable again. */
    secret: string;
}

/** The paginated list envelope. */
export interface ListApiTokensResponse {
    items: ApiTokenView[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * Admin management of external-API bearer tokens under `/api/api-tokens`. These
 * are the SESSION-authenticated management routes (the app-wide `AuthGuard` +
 * `PermissionsGuard`), distinct from the token-authenticated content API the
 * minted tokens are used against. Gated on the `tokens:*` permissions, which
 * only the `admin` role holds.
 *
 * The workspaces a token is scoped to are chosen in the request body (one or
 * many), so the page itself is workspace-agnostic (it lives in the global admin
 * sidebar).
 */
@UseGuards(PermissionsGuard)
@Controller('api-tokens')
export class ApiTokensController {
    constructor(private readonly tokens: ApiTokenService) {}

    /**
     * `POST /api/api-tokens` — mint a token and return its plaintext **once**.
     * `Origin`-guarded like the other state-changing admin routes.
     */
    @Post()
    @RequirePermissions(PERMISSIONS.TOKENS_CREATE)
    @UseGuards(OriginGuard)
    async create(
        @Body() body: CreateApiTokenDto,
        @CurrentUser() user: PublicUser
    ): Promise<CreateApiTokenResponse> {
        const expiresAt = parseExpiry(body.expiresAt);
        try {
            const { token, secret } = await this.tokens.mint({
                name: body.name,
                workspaceIds: body.workspaceIds,
                scope: body.scope,
                expiresAt,
                createdBy: user.id,
                // Named separately from `createdBy` so the audit row carries a
                // frozen email snapshot rather than a foreign key into a user
                // who may later be renamed or deleted.
                actor: { id: user.id, email: user.email }
            });
            return { ...token, secret };
        } catch (error) {
            // A bucket naming a workspace that does not exist is a client
            // mistake, not an authorization failure — 400, alongside the DTO's
            // own shape errors. Nothing is leaked: only an admin reaches this
            // route, and they are being told about ids they just supplied.
            if (error instanceof UnknownWorkspaceError) {
                throw new BadRequestException(error.message);
            }
            throw error;
        }
    }

    /** `GET /api/api-tokens` — one page of token metadata (never the secret). */
    @Get()
    @RequirePermissions(PERMISSIONS.TOKENS_READ)
    list(
        @Query() query: ListApiTokensQueryDto
    ): Promise<ListApiTokensResponse> {
        return this.tokens.list({
            workspaceId: query.workspaceId,
            page: query.page ?? 1,
            pageSize: query.pageSize ?? API_TOKENS_DEFAULT_PAGE_SIZE
        });
    }

    /**
     * `DELETE /api/api-tokens/:id` — revoke a token. Idempotent: an unknown or
     * already-revoked id still 204s, and only the call that actually revoked a
     * live token writes an audit row. `Origin`-guarded.
     */
    @Delete(':id')
    @RequirePermissions(PERMISSIONS.TOKENS_DELETE)
    @UseGuards(OriginGuard)
    @HttpCode(204)
    async revoke(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: PublicUser
    ): Promise<void> {
        await this.tokens.revoke(id, { id: user.id, email: user.email });
    }
}

/**
 * Parses the optional ISO expiry into a `Date`, rejecting a timestamp in the
 * past (a token that is born expired is always a client mistake). `undefined`
 * passes through as "never expires".
 */
function parseExpiry(iso: string | undefined): Date | undefined {
    if (iso === undefined) {
        return undefined;
    }
    const at = new Date(iso);
    if (at.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be in the future.');
    }
    return at;
}
