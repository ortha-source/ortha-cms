import { defineMessages, type IntlShape } from 'react-intl';
import type { AlarmScanResult } from '../../types/alarm';

const messages = defineMessages({
    scanned: {
        id: 'alarms.scan.toast',
        defaultMessage:
            '{name}: checked {scanned, number}, {open, plural, =0 {nothing flagged} other {# flagged}}, {resolved, number} cleared.'
    }
});

/**
 * What a scan did, in one sentence — "No SEO description: checked 842, 38
 * flagged, 2 cleared." The toast after a Re-check, a save that changed the
 * condition, a new alarm and an alarm switched back on, so all four say it the
 * same way.
 */
export function scanMessage(
    intl: IntlShape,
    name: string,
    scan: AlarmScanResult
): string {
    return intl.formatMessage(messages.scanned, {
        name,
        scanned: scan.scanned,
        open: scan.open,
        resolved: scan.resolved
    });
}
