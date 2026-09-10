import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** The longest note the API stores on a request or a vote. */
export const REVIEW_NOTE_MAX = 2000;

/**
 * The body of every review write — one optional note, and nothing else.
 *
 * **The note is optional even for "request changes",** where it is required in
 * practice: a refusal with no reason is not review. The design document says
 * the API does not force it, and that is kept — the rule belongs to the screen
 * that writes it, where the message can explain itself, rather than to a 400
 * that says `note should not be empty`. Making it mandatory here would also
 * make it mandatory for the copilot and for anything else that ever posts, for
 * a rule about interface manners.
 */
export class ReviewNoteDto {
    @ApiPropertyOptional({
        type: String,
        maxLength: REVIEW_NOTE_MAX,
        example: 'The March figures do not match the report.',
        description:
            'What the reviewer or the author wants said. Optional on every ' +
            'route, including “request changes” — the expectation that a ' +
            'refusal explains itself is enforced by the editor, not by a 400.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(REVIEW_NOTE_MAX)
    note?: string;
}
