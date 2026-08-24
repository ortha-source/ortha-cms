// The plugin factory and its shape — how a host composes alarms in.
export { AlarmsPlugin } from './lib/utils/alarms-plugin';
export type { AlarmsServerPluginType } from './lib/utils/alarms-plugin';
export { AlarmsModule } from './lib/alarms.module';

// Configuration, part of the package's SemVer'd API.
export type {
    AlarmsPluginConfig,
    ResolvedAlarmsConfig
} from './lib/types/alarms-config';
export { ALARMS_DEFAULTS } from './lib/types/alarms-config';

// The domain vocabulary. Exported because the admin renders it and a future
// tool surface would speak it — a severity is part of the contract, not an
// implementation detail.
export {
    ALARM_SEVERITY,
    ALARM_SEVERITIES,
    isAlarmSeverity,
    severityRank
} from './lib/domain/alarm-severity';
export type { AlarmSeverity } from './lib/domain/alarm-severity';
export {
    FINDING_STATE,
    FINDING_STATES,
    isFindingState,
    nextFindingState
} from './lib/domain/finding-state';
export type { FindingState } from './lib/domain/finding-state';
export { filterTreeSegments } from './lib/domain/filter-tree-segments';

// The wire contracts the admin reads.
export type {
    AlarmRuleView,
    AlarmFindingView,
    AlarmFindingListView,
    AlarmFindingsByEntryView,
    AlarmRulePreviewView,
    AlarmScanResultView
} from './lib/types/alarm-views';
export type { AlarmSummaryView } from './lib/http/controllers/alarm-findings.controller';

// The schema, for the host's drizzle-kit entry and for anything that needs to
// read these tables directly.
export { alarmRules, alarmFindings } from './lib/infrastructure/schema';

// Services other plugins may inject: the evaluator (to force a scan) and the
// finding store (to read findings without going through HTTP).
export { AlarmEvaluator } from './lib/infrastructure/alarm-evaluator.service';
export { AlarmFindingStore } from './lib/infrastructure/alarm-finding.store';
export { AlarmRulesService } from './lib/application/alarm-rules.service';
