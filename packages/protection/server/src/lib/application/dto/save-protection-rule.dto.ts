import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * The largest approval count the API will store.
 *
 * A bound, not a policy. Nothing about the feature breaks at 12 reviewers —
 * but `required_approvals: 100` typed into a stepper is a type that can never
 * be published again, with nothing in the interface to say why, and the number
 * is stored rather than re-entered so nobody meets the mistake twice. A
 * workspace with more than a hundred reviewers on one content type is not the
 * case this refuses.
 */
export const REQUIRED_APPROVALS_MAX = 100;

/**
 * Body of `PUT /api/protection/rules/:kind/:slug`.
 *
 * **This is a replacement, not a patch.** Every field is optional and every
 * omitted one takes the documented default — the same defaults a type with no
 * rule row behaves by — so the stored rule is exactly what the body says and
 * nothing carried over from a previous save. The settings form always sends all
 * six, and a partial body that quietly kept old values would make "what does
 * this rule do" a question about history rather than about the request.
 *
 * The defaults themselves are applied in the service rather than by
 * `class-transformer`, so they are stated once next to the reason for each.
 */
export class SaveProtectionRuleDto {
    @ApiPropertyOptional({
        type: Boolean,
        default: false,
        description:
            'Whether the rule is in force. Off behaves exactly as a type ' +
            'with no rule at all, a bearer token included — a switched-off ' +
            'rule protects nothing.'
    })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: REQUIRED_APPROVALS_MAX,
        default: 1,
        example: 2,
        description:
            'How many approvals on the entry’s current revision unlock ' +
            'publication.'
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(REQUIRED_APPROVALS_MAX)
    requiredApprovals?: number;

    @ApiPropertyOptional({
        type: Boolean,
        default: true,
        description:
            'The four-eyes switch: the author of the current revision cannot ' +
            'approve it, administrators included.'
    })
    @IsOptional()
    @IsBoolean()
    requireOtherPerson?: boolean;

    @ApiPropertyOptional({
        type: Boolean,
        default: false,
        description:
            'Count approvals given on earlier revisions. Not recommended: an ' +
            'approval that survives the edit it approved is the failure this ' +
            'feature exists to prevent.'
    })
    @IsOptional()
    @IsBoolean()
    countStaleApprovals?: boolean;

    @ApiPropertyOptional({
        type: Boolean,
        default: true,
        description:
            'Whether an administrator may publish past the rule, having ' +
            'confirmed they mean to. Off makes the rule absolute, ' +
            'administrators included.'
    })
    @IsOptional()
    @IsBoolean()
    adminBypass?: boolean;

    @ApiPropertyOptional({
        type: Boolean,
        default: false,
        description:
            'Whether a bearer token may publish this type. Off by default: a ' +
            'token names nobody in the log, so allowing one would let the rule ' +
            'be escaped by minting a key.'
    })
    @IsOptional()
    @IsBoolean()
    allowTokenPublish?: boolean;
}
