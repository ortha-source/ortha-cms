import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Validate } from 'class-validator';
import type { PanelLayout } from '../../schema';
import {
    MAX_PANEL_WIDTH,
    MAX_PANELS_PER_SAVE,
    MIN_PANEL_WIDTH,
    PanelLayoutConstraint
} from './panel-layout.validator';

export const THEME_VALUES = ['light', 'dark', 'system'] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

/**
 * A partial patch of the caller's preferences: each field is optional and an
 * absent one keeps its stored value, so the theme picker and the panel layout
 * save independently without either having to echo the other. A patch with
 * neither is refused by the controller.
 */
export class UpdatePreferencesDto {
    @ApiPropertyOptional({
        enum: [...THEME_VALUES],
        example: 'system',
        description:
            'Colour theme. `system` follows the OS setting. Mirrors the `theme_preference` enum.'
    })
    @IsOptional()
    @IsIn(THEME_VALUES)
    theme?: ThemeValue;

    @ApiPropertyOptional({
        type: 'object',
        additionalProperties: {
            type: 'object',
            properties: {
                width: {
                    type: 'integer',
                    minimum: MIN_PANEL_WIDTH,
                    maximum: MAX_PANEL_WIDTH
                },
                collapsed: { type: 'boolean' }
            },
            additionalProperties: false
        },
        example: { 'shell.sidebar': { width: 288, collapsed: false } },
        description: `Resizable panels to update, by panel id (at most ${MAX_PANELS_PER_SAVE}). Merged per panel over the stored map — a panel left out keeps its stored entry, a panel named here is replaced whole.`
    })
    @IsOptional()
    @Validate(PanelLayoutConstraint)
    layout?: PanelLayout;
}
