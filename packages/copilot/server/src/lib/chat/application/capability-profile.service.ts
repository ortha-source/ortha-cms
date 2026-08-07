import { Injectable } from '@nestjs/common';
import { PermissionsService } from '@ortha-cms/identity-server';
import {
    resolveCapabilityProfile,
    type CapabilityProfile,
    type CopilotActor
} from '@ortha-cms/copilot-domain';
import { CopilotToolRegistry } from './tool-registry.service';

/**
 * Resolves the tool set one run may use.
 *
 * The decision itself is the pure `resolveCapabilityProfile` in
 * `copilot-domain`; this service only feeds it — grants from
 * `PermissionsService.forRole` (the same source `GET /auth/me` uses) and the
 * catalogue from the bound providers. Keeping the rule pure is what makes "a
 * viewer is offered no write tools" a unit test rather than an e2e hope.
 *
 * **Nothing here is cached.** [ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §2
 * requires the profile be recomputed per run: permissions can be revoked
 * mid-thread, and a long conversation must not carry stale authority. The cost
 * is one indexed read per run, which the ADR accepts explicitly.
 */
@Injectable()
export class CapabilityProfileService {
    constructor(
        private readonly permissions: PermissionsService,
        private readonly tools: CopilotToolRegistry
    ) {}

    /** The profile for a run by `userId` (role `roleId`) in `workspaceId`. */
    async resolve(
        userId: string,
        roleId: string,
        workspaceId: string
    ): Promise<CapabilityProfile> {
        const actor: CopilotActor = {
            userId,
            grantedPermissions: new Set(await this.permissions.forRole(roleId))
        };

        return resolveCapabilityProfile({
            tools: await this.tools.tools(workspaceId),
            actor
            // No `policy` yet: direct apply is a phase-3 surface, and until
            // there is a way for an admin to opt a tool in, the safe default
            // (`apply` withheld) is the only correct one.
        });
    }
}
