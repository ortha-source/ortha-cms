import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsIn,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
    ValidateNested
} from 'class-validator';

/** Longest message we accept. Bounds the prompt before the model bounds it. */
export const MAX_MESSAGE_LENGTH = 8_000;

/** The surfaces a run can be started from (design §2). */
export const RUN_SURFACES = ['chat', 'palette', 'entry', 'records'] as const;

/**
 * Where the user was when they asked. Every field is optional — the chat panel
 * knows only the workspace, the entry editor knows the type and the entry.
 *
 * **This class exists because of the host's strict `ValidationPipe`.** It runs
 * with `whitelist: true` + `forbidNonWhitelisted: true`, and those apply to
 * nested objects too: without `@ValidateNested()` + `@Type()` here, a nested
 * `context` object is not traversed as a DTO at all — its properties are
 * stripped by the whitelist and the handler silently receives `{}`. Declaring
 * the nested class is what makes the payload arrive intact.
 */
export class RunContextDto {
    /** Where the run was started from. */
    @ApiPropertyOptional({ enum: RUN_SURFACES })
    @IsOptional()
    @IsIn(RUN_SURFACES)
    surface?: (typeof RUN_SURFACES)[number];

    /** The content type in view, if any. */
    @ApiPropertyOptional({ type: String, maxLength: 128 })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    contentType?: string;

    /** The entry in view, if any. */
    @ApiPropertyOptional({ type: String, maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    entryId?: string;

    /** The content locale in view, if any. */
    @ApiPropertyOptional({ type: String, maxLength: 35 })
    @IsOptional()
    @IsString()
    @MaxLength(35)
    locale?: string;
}

/**
 * Body of `POST /api/copilot/runs`.
 *
 * Every field the client may send is declared here, including the nested
 * context above — the host's pipe sets `forbidNonWhitelisted: true`, so an
 * undeclared key is a **400 naming the property**, not a silently ignored
 * extra. That is the behaviour we want (a typo'd field is a loud failure), but
 * it means adding a client-side field without adding it here breaks the request
 * with an error that reads as unrelated.
 */
export class CreateRunDto {
    /** What the user typed. */
    @ApiProperty({ type: String, minLength: 1, maxLength: MAX_MESSAGE_LENGTH })
    @IsString()
    @MinLength(1)
    @MaxLength(MAX_MESSAGE_LENGTH)
    message!: string;

    /** Continue this thread. Omit to start a new one. */
    @ApiPropertyOptional({ type: String, format: 'uuid' })
    @IsOptional()
    @IsUUID()
    conversationId?: string;

    /**
     * The admin UI's locale, so the model answers in the language the person
     * is reading (`docs/design/copilot.md` §8, "Localized output"). Sent by the
     * client rather than inferred from `Accept-Language`, because the admin's
     * locale is an app preference, not a browser one.
     */
    @ApiPropertyOptional({ type: String, maxLength: 35, default: 'en' })
    @IsOptional()
    @IsString()
    @MaxLength(35)
    uiLocale?: string;

    /**
     * The registered provider to run on — one of the names in
     * `GET /api/copilot/models`. Omit to let the host's resolver decide.
     *
     * Naming a provider is **not** an escalation: the registry is fixed at boot
     * by the operator, so the worst a caller can do is pick a different backend
     * the operator already configured. An unregistered name is refused.
     */
    @ApiPropertyOptional({ type: String, maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    provider?: string;

    /**
     * The model id to run on, from the chosen provider's list. Omit for that
     * provider's default. A user switches model by sending a different value on
     * the next turn — the choice is per-run, not pinned to the thread, so a
     * conversation can start cheap and escalate.
     */
    @ApiPropertyOptional({ type: String, maxLength: 128 })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    model?: string;

    /** Where the user is. */
    @ApiPropertyOptional({ type: RunContextDto })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => RunContextDto)
    context?: RunContextDto;
}
