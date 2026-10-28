import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@orthacms/identity-server';
import { AlarmDigestService } from '../../application/alarm-digest.service';
import { DigestSettingsDto } from '../../application/dto/digest-settings.dto';
import { AlarmDigestRepository } from '../../infrastructure/alarm-digest.repository';
import type { AlarmDigestSettingsView } from '../../types/alarm-views';

/**
 * The caller's own alarm-digest frequency: `GET/PUT /api/alarms/digest/settings`.
 *
 * **Not workspace-scoped** — unlike every other alarms route there is no
 * `X-Workspace-Id`: a digest spans every workspace the person belongs to, so
 * its setting is the person's, like their preferences. `alarms:read`, which
 * every role holds, because nobody without it would receive a digest.
 */
@ApiTags('alarms')
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.ALARMS_READ)
@Controller('alarms/digest/settings')
export class AlarmDigestController {
    constructor(
        private readonly digests: AlarmDigestRepository,
        private readonly digest: AlarmDigestService
    ) {}

    @ApiOperation({
        summary: 'Read the caller’s alarm digest frequency',
        description:
            '`available` is false when the deployment has no mail provider, in which case no digest is sent whatever the frequency.'
    })
    @Get()
    async get(
        @CurrentUser() user: PublicUser
    ): Promise<AlarmDigestSettingsView> {
        return {
            frequency: await this.digests.frequency(user.id),
            available: this.digest.available
        };
    }

    @ApiOperation({ summary: 'Set the caller’s alarm digest frequency' })
    @Put()
    @UseGuards(OriginGuard)
    async put(
        @CurrentUser() user: PublicUser,
        @Body() body: DigestSettingsDto
    ): Promise<AlarmDigestSettingsView> {
        await this.digests.setFrequency(user.id, body.frequency);
        return { frequency: body.frequency, available: this.digest.available };
    }
}
