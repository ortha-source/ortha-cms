import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** `PUT /api/alarms/digest/settings`. */
export class DigestSettingsDto {
    @ApiProperty({
        enum: ['daily', 'weekly', 'off'],
        description: 'How often the alarm digest is mailed to the caller.'
    })
    @IsIn(['daily', 'weekly', 'off'])
    frequency!: 'daily' | 'weekly' | 'off';
}
