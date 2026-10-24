import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { InsightsRangeQueryDto } from './insights-range-query.dto';

/** `?days=&tz=` — the punchcard's window and the zone to bucket it in. */
export class InsightsPunchcardQueryDto extends InsightsRangeQueryDto {
    @ApiPropertyOptional({
        type: 'string',
        maxLength: 64,
        description:
            'IANA time zone to group weekdays and hours in — the viewer’s own, so "Tuesday at 9" means their Tuesday at 9. An unknown or malformed zone falls back to UTC; the response names the zone it used.',
        example: 'Europe/Berlin'
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    tz?: string;
}
