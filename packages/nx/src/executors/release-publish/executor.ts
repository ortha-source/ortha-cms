import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { formatNpmError, publishWithRetry } from '../../lib/release/publish';
import { throttleStateDir, withPublishSlot } from '../../lib/release/throttle';

/** Options for the `release-publish` executor. */
export interface ReleasePublishExecutorOptions {
    /** Staged package root, relative to the workspace root. */
    packageRoot?: string;
    /** Milliseconds to leave between two publishes across the whole release. */
    delay?: number;
    /** Extra attempts a rate-limited or transient failure gets. */
    retries?: number;
    /** Backoff before the first retry, in milliseconds; doubles after that. */
    retryBackoff?: number;
    /** Ceiling for the doubling, in milliseconds. */
    maxRetryBackoff?: number;
    /* ---- passed through by `nx release publish` ---- */
    registry?: string;
    tag?: string;
    otp?: string | number;
    access?: string;
    dryRun?: boolean;
    firstRelease?: boolean;
    nxReleaseVersionData?: Record<string, { newVersion: string | null }>;
}

const DEFAULTS = {
    delay: 5_000,
    retries: 5,
    retryBackoff: 30_000,
    maxRetryBackoff: 300_000
};

/**
 * Publishes one package to npm, in place of `@nx/js:release-publish`.
 *
 * The lockstep release publishes ~37 packages in one go, and npm rate-limits
 * an account's writes: run them as fast as Nx can schedule them and the
 * registry starts answering 429 partway through, leaving a tagged commit and
 * half a release. So every publish takes a turn through a workspace-wide slot
 * (`withPublishSlot`) that serialises them and leaves a gap in between, and a
 * publish the registry refuses for its own reasons is retried with backoff.
 *
 * Tuning without touching code, for a CI run that hits a stricter limit:
 *
 *     ORTHA_PUBLISH_DELAY=10000 ORTHA_PUBLISH_RETRIES=8 npm run release
 *
 * Re-publishing a version that is already on the registry counts as success,
 * which is what makes `npm run release:publish` a safe way to finish a
 * release that died halfway.
 */
export default async function releasePublishExecutor(
    options: ReleasePublishExecutorOptions,
    context: ExecutorContext
): Promise<{ success: boolean }> {
    const projectName = context.projectName ?? '';
    const packageRoot = join(
        context.root,
        options.packageRoot ??
            context.projectsConfigurations.projects[projectName].root
    );

    const manifest = JSON.parse(
        readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as { name: string; version: string; private?: boolean };

    const label = `${manifest.name}@${manifest.version}`;

    if (manifest.private) {
        console.warn(`Skipped ${label}, because it is marked private`);
        return { success: true };
    }

    // Nx tells us when a project was left at its current version; nothing to
    // publish for it, and asking npm would only earn another 403.
    if (options.nxReleaseVersionData?.[projectName]?.newVersion === null) {
        console.warn(`Skipped ${label}, because no new version was resolved`);
        return { success: true };
    }

    const dryRun = process.env.NX_DRY_RUN === 'true' || options.dryRun === true;
    const log = (message: string) =>
        console.log(`${manifest.name}: ${message}`);

    const outcome = await withPublishSlot(
        {
            dir: throttleStateDir(context.root),
            // A dry run writes nothing, so there is no limit to stay under —
            // rehearsing a release should not also rehearse the waiting.
            spacing: dryRun
                ? 0
                : numeric(
                      process.env.ORTHA_PUBLISH_DELAY,
                      options.delay,
                      DEFAULTS.delay
                  ),
            onWait: log
        },
        () =>
            publishWithRetry(
                {
                    cwd: context.root,
                    packageRoot,
                    registry: options.registry,
                    tag: options.tag,
                    otp: options.otp,
                    access: options.access,
                    dryRun
                },
                {
                    retries: numeric(
                        process.env.ORTHA_PUBLISH_RETRIES,
                        options.retries,
                        DEFAULTS.retries
                    ),
                    backoff: numeric(
                        process.env.ORTHA_PUBLISH_RETRY_BACKOFF,
                        options.retryBackoff,
                        DEFAULTS.retryBackoff
                    ),
                    maxBackoff: numeric(
                        undefined,
                        options.maxRetryBackoff,
                        DEFAULTS.maxRetryBackoff
                    ),
                    log
                }
            )
    );

    switch (outcome.status) {
        case 'published':
            console.log(
                dryRun
                    ? `Would publish ${label} — [dry-run] was set`
                    : `Published ${label}`
            );
            if (context.isVerbose) console.log(outcome.output);
            return { success: true };

        case 'already-published':
            console.warn(
                `Skipped ${label}, because that version is already on the registry`
            );
            return { success: true };

        default:
            console.error(`Failed to publish ${label}:`);
            console.error(formatNpmError(outcome.output));
            return { success: false };
    }
}

/** Env wins over the target's options, which win over the built-in default. */
function numeric(
    fromEnv: string | undefined,
    fromOptions: number | undefined,
    fallback: number
): number {
    const parsed = Number.parseInt(fromEnv ?? '', 10);

    if (Number.isFinite(parsed) && parsed >= 0) return parsed;

    return typeof fromOptions === 'number' ? fromOptions : fallback;
}
