import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of `POST /api/copilot/runs/:runId/permission/extend`.
 *
 * Every property is declared because the host's `ValidationPipe` runs with
 * `forbidNonWhitelisted` — an undeclared key is a 400 naming it.
 */
export class ExtendToolPermissionDto {
    /**
     * The tool call whose wait is being extended, from the
     * `tool-permission-request` frame.
     *
     * A plain string, not a UUID, for the same reason as
     * `DecideToolPermissionDto.callId`: it is the **provider's** call id and the
     * two wire formats mint those differently.
     */
    @ApiProperty({
        description:
            'The `id` from the tool-permission-request frame to extend.'
    })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    callId!: string;
}
