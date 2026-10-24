import {
    Controller,
    Get,
    Query,
    Res,
    StreamableFile,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { EXPORT_MAX_ROWS } from '../activity.constants';
import { ExportActivityQueryDto } from '../dto/export-activity-query.dto';
import { ActivityService } from '../services/activity.service';
import { activityCsvFileName, toActivityCsv } from '../services/activity-csv';

/**
 * The one thing this route needs from the platform response: setting headers.
 * Structural rather than `express`'s `Response`, which this package does not
 * depend on — the host's adapter hands in an object that has it either way.
 */
interface HeaderSink {
    set(headers: Record<string, string>): unknown;
}

/** Response header carrying the uncapped number of matching events. */
export const EXPORT_TOTAL_HEADER = 'X-Total-Count';

/** Response header set to `true` when the file holds fewer rows than match. */
export const EXPORT_TRUNCATED_HEADER = 'X-Export-Truncated';

/**
 * `GET /api/activity/export` — the current view of the audit log as a CSV
 * download.
 *
 * Gated on `activity:read`, the **same** key as the list, by constant. An
 * export is the list's own answer in another format: it carries nothing the
 * page does not already show this reader, and a second, stronger key would
 * only make the button on the page a dead end for the same admin who can read
 * every row it would contain. Like the list, no API-token scope carries the
 * key, so a bearer token cannot reach it (`activity:I-14`).
 *
 * Read-only, and it writes nothing — not even an audit row of its own. The
 * response is `no-store` (an audit export must not sit in a shared cache) and
 * `nosniff`, and every cell is defused against spreadsheet formula injection
 * by {@link toActivityCsv}: the subject label and `meta` are user-authored.
 */
@ApiTags('Activity')
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.ACTIVITY_READ)
@Controller('activity')
export class ExportActivityController {
    constructor(private readonly activity: ActivityService) {}

    @Get('export')
    @ApiProduces('text/csv')
    @ApiOperation({
        summary: 'Export the activity log as CSV',
        description: `The events matching the same filters, search and sort as \`GET /activity\`, without paging, as a CSV file — at most ${EXPORT_MAX_ROWS} rows, newest first by default. \`${EXPORT_TOTAL_HEADER}\` carries the uncapped count and \`${EXPORT_TRUNCATED_HEADER}: true\` says the file is not the whole answer. Cells that a spreadsheet would read as a formula are prefixed with \`'\`.`
    })
    async export(
        @Query() query: ExportActivityQueryDto,
        @Res({ passthrough: true }) response: HeaderSink
    ): Promise<StreamableFile> {
        const { rows, total } = await this.activity.exportRows(
            query,
            EXPORT_MAX_ROWS
        );
        response.set({
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            [EXPORT_TOTAL_HEADER]: String(total),
            [EXPORT_TRUNCATED_HEADER]: String(total > rows.length),
            // Same-origin today, but a header the client must read is a
            // header it must be allowed to read.
            'Access-Control-Expose-Headers': `${EXPORT_TOTAL_HEADER}, ${EXPORT_TRUNCATED_HEADER}, Content-Disposition`
        });
        return new StreamableFile(Buffer.from(toActivityCsv(rows), 'utf8'), {
            type: 'text/csv; charset=utf-8',
            disposition: `attachment; filename="${activityCsvFileName(new Date())}"`
        });
    }
}
