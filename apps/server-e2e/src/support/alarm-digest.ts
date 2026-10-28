import type { INestApplication } from '@nestjs/common';
import { AlarmDigestService } from '@orthacms/alarms-server';

/**
 * Runs the alarm digest once, at `now`. The loop's timer is off in the harness
 * (`digestIntervalMinutes: 0`), so a digest goes out only when a test says so —
 * and with a clock it chooses, since "not before the hour" and "weekly on
 * Mondays" are both about the time.
 */
export function runAlarmDigest(
    app: INestApplication,
    now: Date
): Promise<number> {
    return app.get(AlarmDigestService).runOnce(now);
}
