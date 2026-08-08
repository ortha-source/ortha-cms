import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/** How many tools a single policy may opt into. */
const MAX_TOOLS = 64;

/**
 * Body of `PUT /api/copilot/policy` — the complete auto-apply list.
 *
 * A **replace**, not a patch, and required rather than optional: clearing every
 * opt-in has to be expressible, and `{}` meaning "leave it alone" would make
 * that impossible without a second route. Sending `[]` turns auto-apply off.
 *
 * There is deliberately no wildcard. ADR-0005 §6's opt-in is per tool, and an
 * `all` switch would turn one team's judgement about alt text into blanket
 * write access the next time a tool is added.
 */
export class UpdateWorkspacePolicyDto {
    @ApiProperty({
        type: [String],
        example: ['media.proposeAltText'],
        description:
            'Tool names allowed to write directly instead of producing a proposal. ' +
            'Send an empty array to require review for everything. Unknown names are dropped.'
    })
    @IsArray()
    @ArrayMaxSize(MAX_TOOLS)
    @IsString({ each: true })
    @MaxLength(255, { each: true })
    autoApplyTools!: string[];
}
