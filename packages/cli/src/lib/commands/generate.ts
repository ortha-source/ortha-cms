import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runDrizzleKitGenerate } from '../generate';
import { LAYOUT } from '../project';

/**
 * Generates a Drizzle migration for the app's **own** content tables.
 *
 * Plugins ship their migrations inside their tarballs; this is only ever about
 * the schema the app itself defines, which is why it needs a `drizzle.config.ts`
 * and says so plainly when there is not one. A newly generated app has no
 * content types at all, so the first run of this command is also the moment
 * `migrations/` comes into existence.
 */
export function generateCommand(root: string, name?: string): void {
    if (!existsSync(join(root, LAYOUT.drizzleConfig))) {
        throw new Error(
            `No ${LAYOUT.drizzleConfig} in ${root}. It describes the content ` +
                `tables this app defines — add one (plus the content types it ` +
                `points at) before generating a migration.`
        );
    }

    runDrizzleKitGenerate(root, LAYOUT.drizzleConfig, name);
}
