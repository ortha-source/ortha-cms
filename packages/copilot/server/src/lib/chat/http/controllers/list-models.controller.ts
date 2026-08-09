import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
    MODEL_REGISTRY,
    type ModelChoice,
    type ModelRegistry
} from '@ortha-cms/copilot-domain';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InjectCopilotConfig } from '../../../copilot.tokens';
import type { CopilotPluginConfig } from '../../../types/copilot-config';

/** What the model picker renders. */
export interface ModelCatalogue {
    /** Every provider × model pair on offer, in registration order. */
    items: ModelChoice[];
    /** The provider a run gets when it names none. */
    defaultProvider: string;
}

/**
 * `GET /api/copilot/models` — the backends a run may choose from.
 *
 * This is `ModelRegistry.catalogue()` served verbatim, which is what phase 0
 * built it for: "a user can switch model mid-conversation and an operator can
 * switch provider with one env var — neither needs a redeploy". The registry is
 * fixed at boot from `plugins.ts`, so this leaks nothing an operator did not
 * already choose to offer — **names only**, never a credential or a base URL.
 *
 * No `WorkspaceGuard`: the catalogue is deployment-wide, not workspace-owned,
 * and the picker renders before a workspace is necessarily resolved. Gated on
 * `copilot:use` like the rest of the surface. (Registering models at runtime,
 * with encrypted credentials, is the separate phase-4 surface behind
 * `copilot:configure`.)
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.COPILOT_USE)
@Controller('copilot')
export class ListModelsController {
    constructor(
        @Inject(MODEL_REGISTRY) private readonly registry: ModelRegistry,
        @InjectCopilotConfig() private readonly config: CopilotPluginConfig
    ) {}

    @Get('models')
    @ApiOperation({ summary: 'List the model backends a run may choose from' })
    list(): ModelCatalogue {
        return {
            items: this.registry.catalogue(),
            defaultProvider: this.config.defaultProvider
        };
    }
}
