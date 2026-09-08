/**
 * Public API of `@orthacms/protection-server` — the publication-protection
 * plugin.
 *
 * A per-content-type rule requiring N approvals before an entry may be
 * published. This package owns the three tables and the rule surface; the
 * **decision** those rules feed is `evaluateProtection` in
 * `@orthacms/protection-domain`, and it is re-exported nowhere here — a
 * consumer that needs it depends on the kernel, which needs no framework.
 *
 * Registering the plugin changes nothing on its own: with no rule written,
 * publication behaves byte for byte as it does with the plugin uninstalled.
 */

export { ProtectionPlugin } from './lib/utils/protection-plugin';
export { ProtectionModule } from './lib/protection.module';

// The rule surface, for the guard provider a later PR adds and for any host
// that wants to read a rule without going through HTTP.
export { ProtectionRulesService } from './lib/application/protection-rules.service';
export { ProtectionRuleRepository } from './lib/infrastructure/protection-rule.repository';
export type { SaveProtectionRuleInput } from './lib/infrastructure/protection-rule.repository';
export { SaveProtectionRuleDto } from './lib/application/dto/save-protection-rule.dto';
export { REQUIRED_APPROVALS_MAX } from './lib/application/dto/save-protection-rule.dto';
export type { ProtectionRuleView } from './lib/types/protection-views';
export { UnknownProtectedContentTypeError } from './lib/domain/errors';

// The tables, so the host's tooling and other plugins' queries can name them
// rather than re-declaring a `pgTable` that would drift.
export {
    protectionRules,
    reviewApprovals,
    reviewRequests
} from './lib/infrastructure/schema';
