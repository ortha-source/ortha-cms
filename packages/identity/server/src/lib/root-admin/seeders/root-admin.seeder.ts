import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RootAdminService } from '../services/root-admin.service';

/**
 * Provisions the env-configured root administrator during application
 * bootstrap (self-hosted Option B). A thin `OnApplicationBootstrap` hook — like
 * {@link SystemRolesSeeder} — that delegates to {@link RootAdminService} and
 * logs the outcome. Registered after `SystemRolesSeeder`, so the `admin` role
 * exists when it runs; a failure aborts boot (fail-fast).
 */
@Injectable()
export class RootAdminSeeder implements OnApplicationBootstrap {
    private readonly logger = new Logger(RootAdminSeeder.name);

    constructor(private readonly rootAdmin: RootAdminService) {}

    async onApplicationBootstrap(): Promise<void> {
        const result = await this.rootAdmin.bootstrapFromConfig();
        if (!result) {
            this.logger.debug('No root admin configured; skipping bootstrap');
            return;
        }

        // Email only — never the password or its hash.
        this.logger.log(
            result.outcome === 'created'
                ? `Root admin provisioned: ${result.email}`
                : `Root admin already present: ${result.email}`
        );
    }
}
