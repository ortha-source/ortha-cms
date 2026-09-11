import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * The optional body of `POST /api/content/:typeName/:id/publish`.
 *
 * The route took no body until a publish could be refused by something other
 * than the entry's own contents. It stays optional: an ordinary publish sends
 * nothing, exactly as before.
 *
 * **Deliberately permissive.** Whether a bypass exists at all and who may take
 * one belong to the guard that is being bypassed; content only carries the
 * caller's explicit request to take it.
 */
export class PublishEntryDto {
    @ApiPropertyOptional({
        type: Boolean,
        description:
            'Publish past a guard that would refuse it — an outstanding approval requirement, typically — when the caller is allowed to. Recorded in the activity log with the actor and the rule. Sending it when nothing would have refused the publish does nothing.',
        example: true
    })
    @IsOptional()
    @IsBoolean()
    bypass?: boolean;
}
