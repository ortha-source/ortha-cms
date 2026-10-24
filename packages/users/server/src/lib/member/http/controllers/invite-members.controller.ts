import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@orthacms/identity-server';
import { InviteMembersDto } from '../../application/dto/invite-members.dto';
import { InviteMembersUseCase } from '../../application/use-cases/invite-members.use-case';
import {
    EmailTakenError,
    EmailsTakenError,
    MEMBER_ERROR_CODES
} from '../../domain/errors';
import { conflict } from '../conflict';
import { MemberViewQuery } from '../../infrastructure/queries/member-view.query';
import type { InvitedMemberBatchView } from '../../application/queries/member.view';

/**
 * `POST /api/users/invites/batch` — invites several addresses with one role and
 * one set of workspaces, all-or-nothing (the admin's invite sheet).
 *
 * Requires **both** `users:create` and `users:read`. The 409 names every
 * address that already has an account, which is an existence answer — and the
 * only callers allowed to get one are those who could already read it off
 * `GET /api/users?search=`. So the route adds no enumeration signal to the API:
 * it is a faster way to ask a question the caller was entitled to ask anyway.
 *
 * Each item carries `inviteToken` exactly as the single route does — present
 * only when no mail provider will deliver it (ADR-0018 §4) — plus the
 * non-secret `inviteExpiresAt`.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_READ)
@Controller('users')
export class InviteMembersController {
    constructor(
        private readonly inviteMembers: InviteMembersUseCase,
        private readonly views: MemberViewQuery
    ) {}

    @Post('invites/batch')
    async invite(
        @CurrentUser() actor: PublicUser,
        @Body() body: InviteMembersDto
    ): Promise<InvitedMemberBatchView> {
        try {
            const invited = await this.inviteMembers.execute(actor, body);
            const views = await this.views.byIds(
                invited.map((item) => item.id)
            );
            const byId = new Map(invited.map((item) => [item.id, item]));
            return {
                items: views.map((view) => {
                    const issued = byId.get(view.id);
                    return {
                        ...view,
                        // Absent rather than null when a mailer has it, as on
                        // the single route.
                        ...(issued?.inviteToken
                            ? { inviteToken: issued.inviteToken }
                            : {}),
                        ...(issued ? { inviteExpiresAt: issued.expiresAt } : {})
                    };
                })
            };
        } catch (error) {
            if (error instanceof EmailsTakenError) {
                throw conflict(
                    MEMBER_ERROR_CODES.EMAIL_TAKEN,
                    'Some of these addresses already belong to members',
                    { emails: [...error.emails] }
                );
            }
            // The unique index caught an account created between the up-front
            // check and the insert; the batch rolled back as a whole.
            if (error instanceof EmailTakenError) {
                throw conflict(
                    MEMBER_ERROR_CODES.EMAIL_TAKEN,
                    'Some of these addresses already belong to members',
                    { emails: [error.email.toLowerCase()] }
                );
            }
            throw error;
        }
    }
}
