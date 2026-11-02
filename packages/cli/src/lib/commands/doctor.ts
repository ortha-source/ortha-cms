import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    WORKSPACE_FEATURES,
    featuresFromDependencies,
    inspectEnvironment
} from '@orthacms/config';
import { readEnv } from '@orthacms/utils-server';

import { plannedChecks, runChecks } from '../doctor/checks';
import {
    failed,
    formatReport,
    reportJson,
    type DoctorReport
} from '../doctor/report';

/** What `orthacms doctor` was asked for. */
export interface DoctorOptions {
    /** Print JSON instead of a table. */
    readonly json: boolean;
    /** Skip everything that connects to something. */
    readonly offline: boolean;
    /** List unset variables too. */
    readonly all: boolean;
}

/**
 * The features this app installed, read from its manifest. This repository —
 * a workspace — runs the server everything is developed against.
 */
export function installedFeatures(root: string): ReadonlySet<string> {
    const manifest = JSON.parse(
        readFileSync(join(root, 'package.json'), 'utf8')
    ) as {
        workspaces?: unknown;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    if (manifest.workspaces) {
        return WORKSPACE_FEATURES;
    }
    return featuresFromDependencies({
        ...manifest.dependencies,
        ...manifest.devDependencies
    });
}

/** Builds the report: static inspection, then the live checks it calls for. */
export async function diagnose(
    root: string,
    options: Pick<DoctorOptions, 'offline'>
): Promise<DoctorReport> {
    const features = installedFeatures(root);
    const { entries, findings } = inspectEnvironment({ features });
    let databaseUrl: string | undefined;
    try {
        databaseUrl = readEnv('DATABASE_URL');
    } catch {
        databaseUrl = undefined;
    }
    const checks = options.offline
        ? []
        : await runChecks(plannedChecks(root, features, databaseUrl));
    return { entries, findings, checks };
}

/**
 * `orthacms doctor` — what is in effect, where each value came from, whether
 * the things it points at answer, and what is wrong. Exits non-zero on any
 * error or failed check, so CI can run it before a deploy.
 */
export async function doctorCommand(
    root: string,
    options: DoctorOptions
): Promise<void> {
    const report = await diagnose(root, options);
    console.log(
        options.json
            ? reportJson(report)
            : formatReport(report, {
                  color:
                      Boolean(process.stdout.isTTY) && !process.env['NO_COLOR'],
                  all: options.all
              })
    );
    if (failed(report)) {
        process.exitCode = 1;
    }
}
