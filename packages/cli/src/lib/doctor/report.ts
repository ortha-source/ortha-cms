import {
    ENV_GROUPS,
    type EnvEntry,
    type EnvFinding,
    type EnvGroup
} from '@orthacms/config';

import type { CheckResult } from './checks';

/** Everything `orthacms doctor` found. */
export interface DoctorReport {
    readonly entries: readonly EnvEntry[];
    readonly findings: readonly EnvFinding[];
    readonly checks: readonly CheckResult[];
}

/** Whether the report should fail the command: any error, any failed check. */
export function failed(report: DoctorReport): boolean {
    return (
        report.findings.some((finding) => finding.level === 'error') ||
        report.checks.some((check) => !check.ok)
    );
}

/** Colours for a terminal that wants them, and none for anything else. */
function palette(color: boolean) {
    const wrap = (code: number) => (text: string) =>
        color ? `\x1b[${code}m${text}\x1b[0m` : text;
    return {
        dim: wrap(2),
        bold: wrap(1),
        red: wrap(31),
        green: wrap(32),
        yellow: wrap(33)
    };
}

/** Where a value came from, in words. */
function sourceLabel(entry: EnvEntry): string {
    switch (entry.source) {
        case 'renamed':
            return `env (as ${entry.from})`;
        case 'file':
            return 'file';
        default:
            return entry.source;
    }
}

/**
 * The report as text. Variables that are unset and have no default are left
 * out unless `all` — what is in effect is the point, and a list of forty empty
 * settings hides it — except a required one, which is the most important line
 * there is.
 */
export function formatReport(
    report: DoctorReport,
    options: { color: boolean; all: boolean }
): string {
    const c = palette(options.color);
    const out: string[] = [];
    const shown = report.entries.filter(
        (entry) =>
            options.all ||
            entry.source !== 'unset' ||
            entry.spec.required === 'always'
    );
    const nameWidth = Math.max(
        ...shown.map((entry) => entry.spec.name.length),
        8
    );
    const sourceWidth = Math.max(
        ...shown.map((entry) => sourceLabel(entry).length),
        7
    );

    for (const group of Object.keys(ENV_GROUPS) as EnvGroup[]) {
        const rows = shown.filter((entry) => entry.spec.group === group);
        if (rows.length === 0) continue;
        out.push(c.bold(ENV_GROUPS[group]));
        for (const entry of rows) {
            const value =
                entry.source === 'unset'
                    ? c.red('not set')
                    : entry.source === 'file'
                      ? `${entry.value} ${c.dim(entry.from ?? '')}`
                      : (entry.value ?? '');
            out.push(
                `  ${entry.spec.name.padEnd(nameWidth)}  ${c.dim(sourceLabel(entry).padEnd(sourceWidth))}  ${value}`
            );
        }
        out.push('');
    }

    if (report.checks.length > 0) {
        out.push(c.bold('Checks'));
        const width = Math.max(
            ...report.checks.map((check) => check.name.length)
        );
        for (const check of report.checks) {
            const mark = check.ok ? c.green('✔') : c.red('✖');
            out.push(`  ${mark} ${check.name.padEnd(width)}  ${check.detail}`);
        }
        out.push('');
    }

    const errors = report.findings.filter(
        (finding) => finding.level === 'error'
    );
    const warnings = report.findings.filter(
        (finding) => finding.level === 'warning'
    );
    for (const finding of errors) out.push(`${c.red('✖')} ${finding.message}`);
    for (const finding of warnings)
        out.push(`${c.yellow('⚠')} ${finding.message}`);
    if (errors.length + warnings.length > 0) out.push('');

    const failedChecks = report.checks.filter((check) => !check.ok).length;
    const problems = errors.length + failedChecks;
    out.push(
        problems === 0 && warnings.length === 0
            ? c.green('Nothing to fix.')
            : `${problems} ${problems === 1 ? 'problem' : 'problems'}, ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}`
    );
    return out.join('\n');
}

/** The report as JSON, for CI. Secrets stay masked. */
export function reportJson(report: DoctorReport): string {
    return JSON.stringify(
        {
            ok: !failed(report),
            variables: report.entries.map((entry) => ({
                name: entry.spec.name,
                group: entry.spec.group,
                source: entry.source,
                value: entry.value,
                from: entry.from
            })),
            checks: report.checks,
            findings: report.findings
        },
        null,
        2
    );
}
