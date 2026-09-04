import { AlarmsPlugin } from './alarms-plugin';
import {
    resolveAlarmsConfig,
    type AlarmsPluginConfig
} from '../types/alarms-config';

/**
 * `AlarmsPlugin`'s construction-time checks.
 *
 * Every number in this config bounds work, and a zero or negative bound does
 * not fail loudly — it produces a scan that examines no rows and reports a
 * clean collection. On a plugin whose entire job is to say when something is
 * wrong, "nothing is wrong" is the most expensive thing it can be talked into
 * saying, and it is indistinguishable from a workspace with no problems. So it
 * is caught at construction, where the message can name the setting, rather
 * than discovered from a suspiciously empty alarms page weeks later.
 *
 * `sweepIntervalMinutes` is the deliberate exception: `0` is a real choice
 * there, and the checks have to let it through.
 */

const build = (config: AlarmsPluginConfig) => () => AlarmsPlugin(config);

describe('AlarmsPlugin configuration', () => {
    it.each([
        ['maxScanEntries', { maxScanEntries: 0 }],
        ['maxScanEntries', { maxScanEntries: -1 }],
        ['scanBatchSize', { scanBatchSize: 0 }],
        ['scanBatchSize', { scanBatchSize: -50 }],
        ['maxDependentsPerEvent', { maxDependentsPerEvent: 0 }]
    ] as Array<[string, AlarmsPluginConfig]>)(
        'refuses a %s that would bound the work to nothing [alarms:I-21]',
        (field, config) => {
            const thrown = build(config);

            expect(thrown).toThrow(new RegExp(field));
            // The message has to carry the value received: "must be a positive
            // integer" alone leaves the reader hunting for which of four
            // settings, and in which of several config files, said it.
            expect(thrown).toThrow(
                new RegExp(String(Object.values(config)[0]))
            );
        }
    );

    it('refuses a fractional bound, which would silently floor mid-scan [alarms:I-21]', () => {
        expect(build({ scanBatchSize: 1.5 })).toThrow(/scanBatchSize/);
    });

    it('refuses a negative sweep interval [alarms:I-21]', () => {
        expect(build({ sweepIntervalMinutes: -1 })).toThrow(
            /sweepIntervalMinutes.*non-negative.*-1/s
        );
    });

    it('accepts a sweep interval of zero as "do not sweep" [alarms:I-21]', () => {
        // The one value that is a decision rather than a mistake. Folding it in
        // with the other three — the obvious simplification, since all four are
        // numbers that bound something — turns "we do not want a background
        // scan" into a boot failure.
        expect(build({ sweepIntervalMinutes: 0 })).not.toThrow();
        expect(resolveAlarmsConfig({ sweepIntervalMinutes: 0 })).toMatchObject({
            sweepIntervalMinutes: 0
        });
    });

    it('accepts a config that says nothing at all [alarms:I-21]', () => {
        expect(build({})).not.toThrow();
        expect(AlarmsPlugin().name).toBe('alarms');
    });

    it('keeps the config it was handed on the plugin', () => {
        const config: AlarmsPluginConfig = { sweepIntervalMinutes: 15 };

        expect(AlarmsPlugin(config).alarmsConfig).toBe(config);
    });
});
