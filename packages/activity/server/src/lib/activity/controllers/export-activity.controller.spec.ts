import 'reflect-metadata';
import { StreamableFile } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
    PERMISSIONS,
    PERMISSIONS_KEY,
    PermissionsGuard
} from '@orthacms/identity-server';
import { EXPORT_MAX_ROWS } from '../activity.constants';
import { ExportActivityQueryDto } from '../dto/export-activity-query.dto';
import type { ActivityService } from '../services/activity.service';
import type { ActivityEventView } from '../types/activity-view';
import {
    EXPORT_TOTAL_HEADER,
    EXPORT_TRUNCATED_HEADER,
    ExportActivityController
} from './export-activity.controller';

/** Nest's own guard metadata key (a literal in `@nestjs/common/constants`). */
const GUARDS_METADATA = '__guards__';

/** One wire row. */
function view(id: string): ActivityEventView {
    return {
        id,
        kind: 'user.signed_in',
        subjectType: 'user',
        subjectId: 'u-1',
        subjectLabel: null,
        actorId: null,
        actorType: null,
        actorEmail: null,
        workspaceId: null,
        meta: null,
        at: new Date('2026-10-24T08:47:00.000Z')
    };
}

/** A controller over a stubbed service, plus what it was asked and answered. */
function harness(rows: ActivityEventView[], total: number) {
    const exportRows = jest.fn().mockResolvedValue({ rows, total });
    const controller = new ExportActivityController({
        exportRows
    } as unknown as ActivityService);
    const headers: Record<string, string> = {};
    const response = {
        set: (next: Record<string, string>) => Object.assign(headers, next)
    };
    return { controller, exportRows, headers, response };
}

/** The body of a `StreamableFile` built from a buffer, as text. */
async function bodyOf(file: StreamableFile): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) {
        chunks.push(Buffer.from(chunk as Buffer));
    }
    return Buffer.concat(chunks).toString('utf8');
}

describe('GET /api/activity/export', () => {
    it('is gated on activity:read by constant, like the list [activity:I-14]', () => {
        expect(
            Reflect.getMetadata(PERMISSIONS_KEY, ExportActivityController)
        ).toEqual([PERMISSIONS.ACTIVITY_READ]);
        expect(
            Reflect.getMetadata(GUARDS_METADATA, ExportActivityController)
        ).toContain(PermissionsGuard);
    });

    it('asks for the filtered view capped at EXPORT_MAX_ROWS and answers a CSV attachment', async () => {
        const { controller, exportRows, headers, response } = harness(
            [view('a'), view('b')],
            2
        );
        const query = plainToInstance(ExportActivityQueryDto, {
            q: 'grace',
            kind: 'user.signed_in'
        });

        const file = await controller.export(query, response);

        expect(exportRows).toHaveBeenCalledWith(query, EXPORT_MAX_ROWS);
        expect(file.getHeaders().type).toBe('text/csv; charset=utf-8');
        expect(file.getHeaders().disposition).toMatch(
            /^attachment; filename="activity-\d{4}-\d{2}-\d{2}\.csv"$/
        );
        expect(headers['Cache-Control']).toBe('private, no-store');
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers[EXPORT_TOTAL_HEADER]).toBe('2');
        expect(headers[EXPORT_TRUNCATED_HEADER]).toBe('false');

        const body = await bodyOf(file);
        // Header plus two rows.
        expect(body.trim().split('\r\n')).toHaveLength(3);
    });

    it('says when the file is not the whole answer', async () => {
        const { controller, headers, response } = harness([view('a')], 12_345);
        await controller.export(new ExportActivityQueryDto(), response);
        expect(headers[EXPORT_TOTAL_HEADER]).toBe('12345');
        expect(headers[EXPORT_TRUNCATED_HEADER]).toBe('true');
    });

    describe('its query', () => {
        const errorsFor = (input: Record<string, unknown>) =>
            validateSync(plainToInstance(ExportActivityQueryDto, input), {
                whitelist: true,
                forbidNonWhitelisted: true
            });

        it('takes every filter the list takes', () => {
            expect(
                errorsFor({
                    q: 'published',
                    kind: 'entry.published,entry.deleted',
                    actorEmail: 'ada',
                    from: '2026-10-17T00:00:00.000Z',
                    to: '2026-10-24T00:00:00.000Z',
                    workspaceId: '22222222-2222-4222-8222-222222222222',
                    sort: 'at',
                    order: 'desc'
                })
            ).toEqual([]);
        });

        it('takes no paging — the export is the whole view', () => {
            const properties = errorsFor({ page: 2, pageSize: 25 }).map(
                (error) => error.property
            );
            expect(properties.sort()).toEqual(['page', 'pageSize']);
        });
    });
});
