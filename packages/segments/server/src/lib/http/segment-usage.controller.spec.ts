import 'reflect-metadata';
import {
    PERMISSIONS,
    PERMISSIONS_KEY,
    PermissionsGuard
} from '@orthacms/identity-server';
import { WorkspaceGuard } from '@orthacms/workspaces-server';
import type { SegmentUsageService } from '../application/segment-usage.service';
import { SegmentUsageController } from './segment-usage.controller';

/** Nest's own metadata keys — string literals in `@nestjs/common/constants`. */
const GUARDS_METADATA = '__guards__';
const PATH_METADATA = 'path';

const SEGMENT = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('SegmentUsageController', () => {
    const handler = SegmentUsageController.prototype.get;

    it('is mounted at /segments/:id/usage', () => {
        expect(Reflect.getMetadata(PATH_METADATA, SegmentUsageController)).toBe(
            'segments'
        );
        expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':id/usage');
    });

    it('is permission-guarded and workspace-scoped', () => {
        // Entry titles are content of one workspace — the membership check on
        // `X-Workspace-Id` is what keeps another workspace's entries unnamed.
        expect(
            Reflect.getMetadata(GUARDS_METADATA, SegmentUsageController)
        ).toEqual([PermissionsGuard, WorkspaceGuard]);
    });

    it('needs segments:read and content:read, by constant', () => {
        expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
            PERMISSIONS.SEGMENTS_READ,
            PERMISSIONS.CONTENT_READ
        ]);
    });

    it('asks the service about the guarded workspace, and nothing else', async () => {
        const view = {
            segmentId: SEGMENT,
            total: 0,
            items: [],
            truncated: false
        };
        const forWorkspace = jest.fn().mockResolvedValue(view);
        const controller = new SegmentUsageController({
            forWorkspace
        } as unknown as SegmentUsageService);

        await expect(controller.get(WORKSPACE, SEGMENT)).resolves.toBe(view);
        expect(forWorkspace).toHaveBeenCalledWith(SEGMENT, WORKSPACE);
    });
});
