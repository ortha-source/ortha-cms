export { AlarmsPlugin } from './lib/utils/alarmsPlugin';
export type { AlarmsAdminPlugin } from './lib/utils/alarmsPlugin';

// The read hooks, exported for a plugin that wants to show a workspace's
// findings in its own surface (a dashboard tile, a report) without restating
// the endpoints.
export { useAlarmRules } from './lib/application/useAlarmRules';
export { useAlarmFindings } from './lib/application/useAlarmFindings';
export { useAlarmSummary } from './lib/application/useAlarmSummary';
export { useFindingsByEntry } from './lib/application/useFindingsByEntry';
export { alarmsKeys } from './lib/infrastructure/alarmsKeys';
export type { FindingsListParams } from './lib/infrastructure/alarmsKeys';

// The view models the hooks return.
export type {
    AlarmFinding,
    AlarmFindingList,
    AlarmRule,
    AlarmRulePreview,
    AlarmScanResult,
    AlarmSeverity,
    AlarmSummary,
    FindingState
} from './lib/types/alarm';
export { ALARM_SEVERITIES } from './lib/types/alarm';

// The severity chip, exported for the same reason `EntryStatusBadge` is: a
// surface showing a finding should render severity the way every other surface
// does rather than a look-alike that drifts.
export { SeverityBadge } from './lib/presentation/components/SeverityBadge';
