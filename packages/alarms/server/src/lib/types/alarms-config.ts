/**
 * Configuration for the alarms plugin. Everything here bounds cost — the rules
 * themselves live in the database, because they are workspace content rather
 * than deployment config.
 */
export interface AlarmsPluginConfig {
    /**
     * Upper bound on entries examined by one full rescan of one rule. A rescan
     * is the only place this plugin touches a whole collection, so it is the
     * only place that needs a ceiling; the event path only ever looks at rows
     * that just changed.
     *
     * A scan that hits the cap reports what it examined rather than pretending
     * it saw everything — silent truncation on a correctness tool would be
     * worse than the missing rows.
     */
    maxScanEntries?: number;

    /**
     * How many entries one rescan reads per batch. Bounds peak memory on a
     * large collection without changing what the scan concludes.
     */
    scanBatchSize?: number;

    /**
     * How often, in minutes, enabled rules are rescanned in the background.
     * `0` turns the sweep off entirely.
     *
     * The sweep exists for the rules events cannot cover: "not updated in 90
     * days" describes an entry precisely because **nobody is touching it**, so
     * no `entry.updated` will ever arrive to re-evaluate it. It is a plain
     * interval in-process (the outbox dispatcher's own backstop is the
     * precedent) rather than a scheduler dependency — one timer, one query, and
     * a deployment that runs several API processes simply rescans more often
     * than asked, which is harmless for an idempotent upsert.
     */
    sweepIntervalMinutes?: number;

    /**
     * How many entries a single event may fan out to when re-evaluating the
     * records that point at a changed one. Bounds the reverse-relation pass
     * that closes "links to a draft" findings when the draft is published.
     */
    maxDependentsPerEvent?: number;
}

/** Config with every optional filled in — what the services actually read. */
export type ResolvedAlarmsConfig = Required<AlarmsPluginConfig>;

/** Defaults chosen to be safe on a large workspace, not to be impressive. */
export const ALARMS_DEFAULTS: ResolvedAlarmsConfig = {
    maxScanEntries: 20_000,
    scanBatchSize: 500,
    sweepIntervalMinutes: 60,
    maxDependentsPerEvent: 500
};

/** Fills the defaults in, so no service has to repeat a `??`. */
export function resolveAlarmsConfig(
    config: AlarmsPluginConfig = {}
): ResolvedAlarmsConfig {
    return { ...ALARMS_DEFAULTS, ...config };
}
