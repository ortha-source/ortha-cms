import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { HashingService } from '../auth/hashing.service';
import { InjectIdentityConfig } from '../identity.tokens';
import type { IdentityPluginConfig } from '../types';
import { ensureRootAdmin } from './ensure-root-admin';
import { MissingRootAdminPasswordError } from './errors';

/**
 * Provisions the env-configured root administrator during application
 * bootstrap (self-hosted Option B). Implemented as an `OnApplicationBootstrap`
 * hook — like {@link SystemRolesSeeder} — so the Drizzle client is injected
 * through DI, and it runs inside `app.init()` after every module is wired but
 * before the server listens. Registered after `SystemRolesSeeder`, so the
 * `admin` role exists by the time this runs; a failure aborts boot (fail-fast).
 *
 * A no-op when no root admin is configured.
 */
@Injectable()
export class RootAdminSeeder implements OnApplicationBootstrap {
    private readonly logger = new Logger(RootAdminSeeder.name);

    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly hashing: HashingService,
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        const rootAdmin = this.config.rootAdmin;

        // No email → not configured; nothing to provision.
        if (!rootAdmin?.email) {
            this.logger.debug('No root admin configured; skipping bootstrap');
            return;
        }
        // Email but no password → misconfiguration; fail fast.
        if (!rootAdmin.password) {
            throw new MissingRootAdminPasswordError(rootAdmin.email);
        }

        const passwordHash = await this.hashing.hashPassword(
            rootAdmin.password
        );
        const outcome = await ensureRootAdmin(this.db, {
            email: rootAdmin.email,
            passwordHash
        });

        // Email only — never the password or its hash.
        this.logger.log(
            outcome === 'created'
                ? `Root admin provisioned: ${rootAdmin.email}`
                : `Root admin already present: ${rootAdmin.email}`
        );
    }
}
