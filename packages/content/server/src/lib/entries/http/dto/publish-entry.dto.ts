import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** The longest bypass reason accepted, so a log row stays readable. */
export const BYPASS_REASON_MAX = 500;

/**
 * The optional body of `POST /api/content/:typeName/:id/publish`.
 *
 * The route took no body until a publish could be refused by something other
 * than the entry's own contents. It stays optional: an ordinary publish sends
 * nothing, exactly as before.
 *
 * **Deliberately permissive.** The only rule enforced here is the length cap —
 * whether a bypass exists at all, who may take one and what makes a reason
 * acceptable belong to the guard that is being bypassed, and validating
 * emptiness here would answer a caller who may not bypass at all with `400`
 * ("your reason was blank") instead of `403` ("this is not yours to do"),
 * telling them the shape of a door they cannot open.
 */
export class PublishEntryDto {
    @ApiPropertyOptional({
        description:
            'Why this publish should proceed past a guard that would refuse it — an outstanding approval requirement, typically. Recorded in the activity log with the actor and the rule. Sending one when nothing would have refused the publish does nothing.',
        maxLength: BYPASS_REASON_MAX,
        example: 'Numbers corrected ahead of the 18:00 send'
    })
    @IsOptional()
    @IsString()
    @MaxLength(BYPASS_REASON_MAX)
    bypassReason?: string;
}
