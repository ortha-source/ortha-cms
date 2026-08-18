import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
    MinLength
} from 'class-validator';

/**
 * Longest title we accept.
 *
 * Generous next to what the server derives from a first message, because this
 * one is typed by a human who may be filing a thread rather than naming it — and
 * still bounded, since the rail renders it on one truncated line.
 */
export const MAX_TITLE_LENGTH = 200;

/**
 * The stored form of "let the host's resolver decide".
 *
 * A real, selectable option in the picker rather than the absence of one — it
 * means "whatever the resolver picks for this run", which can differ per run and
 * per workspace, so recording today's default provider instead would silently
 * opt the user out of that routing. It is unambiguous against a
 * `'<provider>:<model>'` key because it contains no colon.
 */
export const MODEL_CHOICE_DEFAULT = 'default';

/**
 * Longest model choice we accept: a provider name plus a model id plus the
 * separator. Bounded because it is stored and echoed back to the picker.
 */
export const MAX_MODEL_CHOICE_LENGTH = 200;

/**
 * Body of `PATCH /api/copilot/conversations/:id`.
 *
 * A **patch**, so every property is optional and only the ones present are
 * written. The controller rejects a body with neither: an empty patch is a
 * request that cannot mean anything, and silently answering 200 to it would
 * report success for a write that never happened.
 *
 * Every property is declared because the host's `ValidationPipe` runs with
 * `forbidNonWhitelisted` — an undeclared key is a 400 naming it.
 */
export class UpdateConversationDto {
    /**
     * Rename the thread.
     *
     * Trimmed before validation, so " " is the empty string and fails the
     * length check rather than being stored as a title that renders as nothing.
     */
    @ApiPropertyOptional({
        type: String,
        minLength: 1,
        maxLength: MAX_TITLE_LENGTH,
        description:
            'A new display title. Trimmed; must not be blank once trimmed.',
        example: 'Invoice copy review'
    })
    @IsOptional()
    // Runs during transformation, i.e. **before** the validators below — so a
    // title of spaces is measured as the empty string it is.
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString()
    @MinLength(1)
    @MaxLength(MAX_TITLE_LENGTH)
    title?: string;

    /**
     * Hide the thread from the list, or bring it back.
     *
     * Archiving is the only removal this API offers, and it is deliberately
     * reversible — the transcript is kept, and `GET /conversations/:id` still
     * serves it, so a link to an archived thread keeps working.
     */
    @ApiPropertyOptional({
        type: Boolean,
        description:
            'Hide the thread from the default list (`true`) or restore it (`false`).'
    })
    @IsOptional()
    @IsBoolean()
    archived?: boolean;

    /**
     * Record the model picked for this thread, so reopening it in another tab
     * offers the backend the person chose instead of the deployment default.
     *
     * `'default'` for the host's resolver, otherwise `'<provider>:<model>'` —
     * the same key the picker uses, split on its **first** colon (a model id
     * routinely contains one; a provider name cannot). The controller checks the
     * pair against `ModelRegistry.catalogue()`, so this can only ever name a
     * backend the operator configured.
     *
     * It is a **memory, not a pin**: the run route still takes its provider and
     * model per turn, and nothing here constrains the next one.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: MAX_MODEL_CHOICE_LENGTH,
        description:
            "The model picked for this thread: `default`, or `<provider>:<model>` naming a pair from `GET /api/copilot/models`. Doesn't constrain the next run.",
        example: 'anthropic:claude-opus-5'
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(MAX_MODEL_CHOICE_LENGTH)
    modelChoice?: string;
}
