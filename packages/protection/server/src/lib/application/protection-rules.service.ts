import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '@orthacms/database';
import {
    InjectContentRegistry,
    WorkspaceGrantsQuery,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { UnknownProtectedContentTypeError } from '../domain/errors';
import { ProtectionRuleRepository } from '../infrastructure/protection-rule.repository';
import type { ProtectionRuleView } from '../types/protection-views';
import type { SaveProtectionRuleDto } from './dto/save-protection-rule.dto';

/**
 * The six defaults a rule takes for any field a write leaves unstated.
 *
 * They are the design document's table, and they are chosen so that a rule
 * saved with `{ enabled: true }` and nothing else is the **safest** useful
 * rule: one approval, from somebody other than the author, stale votes not
 * counted, and no token publishing. An administrator can still get past it,
 * loudly — turning that off is a deliberate act, not a default.
 */
const RULE_DEFAULTS = {
    enabled: false,
    requiredApprovals: 1,
    requireOtherPerson: true,
    countStaleApprovals: false,
    adminBypass: true,
    allowTokenPublish: false
} as const;

/**
 * The rule lifecycle: read, write, remove.
 *
 * Thin on purpose. The only judgement here is **which types a workspace may
 * write a rule for**, and it is deliberately the same judgement content makes
 * about the type itself — a rule addressed at a type the workspace was never
 * granted is meaningless, and answering differently for "unknown" and
 * "ungranted" would turn this tab into a way to enumerate the deployment's
 * content model.
 *
 * The decision the rules feed — may this person publish this entry — is
 * `evaluateProtection` in `@orthacms/protection-domain`, and it is not
 * duplicated here. This service does not read approvals or revisions at all.
 */
@Injectable()
export class ProtectionRulesService {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly rules: ProtectionRuleRepository,
        private readonly grants: WorkspaceGrantsQuery,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /**
     * Every rule the workspace holds — **including** any addressed at a type it
     * is no longer granted.
     *
     * Filtering those out would leave a row nothing in the product could reach
     * and nothing could delete. A grant revoked after a rule was written is
     * exactly the case where an administrator needs to see the leftover in
     * order to remove it.
     */
    list(workspaceId: string): Promise<ProtectionRuleView[]> {
        return this.rules.list(workspaceId);
    }

    /** One type's rule, or `null` when it is unprotected. */
    find(
        workspaceId: string,
        kind: string,
        slug: string
    ): Promise<ProtectionRuleView | null> {
        return this.rules.find(workspaceId, kind, slug);
    }

    /**
     * Writes the rule for one type, inserting or replacing it.
     *
     * Throws {@link UnknownProtectedContentTypeError} when the workspace cannot
     * reach the type — the caller maps that to a 404.
     */
    async save(
        workspaceId: string,
        kind: string,
        slug: string,
        dto: SaveProtectionRuleDto,
        actorId: string | null
    ): Promise<ProtectionRuleView> {
        await this.assertGranted(workspaceId, kind, slug);

        // A single-statement upsert would not need the unit of work; it is
        // opened so the `protection.rule_changed` event lands in the same
        // transaction as the row once the activity events PR adds it, rather
        // than becoming a second thing to remember at that point.
        return this.uow.run(() =>
            this.rules.save(workspaceId, kind, slug, {
                ...RULE_DEFAULTS,
                ...definedOnly(dto),
                updatedBy: actorId
            })
        );
    }

    /**
     * Removes the rule for one type. Idempotent, and it does **not** check the
     * grant.
     *
     * Removing protection is always allowed to succeed: a rule left behind by a
     * revoked grant is precisely the row an administrator is trying to clear,
     * and a 404 would strand it. Reports whether a row was actually there, for
     * the audit trail — a delete that removed nothing is not a policy change.
     */
    remove(workspaceId: string, kind: string, slug: string): Promise<boolean> {
        return this.uow.run(() => this.rules.remove(workspaceId, kind, slug));
    }

    /**
     * Fails unless `(kind, slug)` names a registered content type that this
     * workspace has been granted.
     *
     * All three failures raise the same error — unregistered, wrong kind, and
     * ungranted — which is content's own `resolveGrantedType` rule: telling
     * them apart lets a member of one workspace enumerate the deployment's
     * content model through this tab.
     */
    private async assertGranted(
        workspaceId: string,
        kind: string,
        slug: string
    ): Promise<void> {
        const type = this.registry.get(slug);
        const granted = await this.grants.grantedSlugs(workspaceId);
        if (!type || type.kind !== kind || !granted.has(slug)) {
            throw new UnknownProtectedContentTypeError(kind, slug);
        }
    }
}

/**
 * The DTO's stated fields only.
 *
 * `PUT` replaces, so an absent key must fall through to the default — but
 * spreading the DTO straight over the defaults would let an explicit
 * `undefined` (which `class-transformer` produces for an omitted optional)
 * overwrite a default with nothing and store a null. Dropping undefined keys
 * first is what makes "omitted means default" true rather than nearly true.
 */
function definedOnly(
    dto: SaveProtectionRuleDto
): Partial<SaveProtectionRuleDto> {
    return Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined)
    );
}
