import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** The colour themes a user may pick. Mirrors the `theme_preference` enum. */
export const THEME_VALUES = ['light', 'dark', 'system'] as const;
/** One selectable colour theme. */
export type ThemeValue = (typeof THEME_VALUES)[number];

/**
 * Body accepted by `PUT /api/preferences`. The host's global `ValidationPipe`
 * (`whitelist` + `forbidNonWhitelisted`) rejects any unknown field and any
 * theme outside the enum, so the write surface can never widen by accident.
 */
export class UpdatePreferencesDto {
    /** Colour theme (`light` / `dark` / `system`). */
    @ApiProperty({
        enum: [...THEME_VALUES],
        example: 'system',
        description:
            'Colour theme. `system` follows the OS setting. Mirrors the `theme_preference` enum.'
    })
    @IsIn(THEME_VALUES)
    theme!: ThemeValue;
}
