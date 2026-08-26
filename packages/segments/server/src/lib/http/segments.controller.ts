import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import {
    SegmentsService,
    type SegmentView
} from '../application/segments.service';
import {
    CreateSegmentDto,
    ListSegmentsQueryDto,
    UpdateSegmentDto
} from './segments.dto';

/**
 * The segment directory — a plain CRUD resource over one thing.
 *
 * Not workspace-scoped: a segment is an installation-wide audience, like a
 * content type, and one copy per workspace would mean renaming a customer in
 * each of them.
 *
 * Reading is `segments:read`, held by contributor and viewer — an editor who
 * cannot see that an entry is restricted will publish one believing it is
 * public. Writing is `segments:manage`, admin-only: renaming a segment's tags
 * changes who every entry that names it is visible to.
 */
@ApiTags('Segments')
@Controller('segments')
@UseGuards(PermissionsGuard)
export class SegmentsController {
    constructor(private readonly segments: SegmentsService) {}

    /** Every segment, with how many entries name it. */
    @Get()
    @RequirePermissions(PERMISSIONS.SEGMENTS_READ)
    @ApiOperation({
        summary: 'List segments',
        description:
            'Every audience readers can be divided into. An empty list means nothing is segmented: every published entry is readable by everyone.'
    })
    list(@Query() query: ListSegmentsQueryDto): Promise<SegmentView[]> {
        return this.segments.list(query.q);
    }

    /** Create a segment. */
    @Post()
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.SEGMENTS_MANAGE)
    @ApiOperation({
        summary: 'Create a segment',
        description:
            'The reader tags default to the key, which is what an installation that never renames anything wants.'
    })
    create(@Body() body: CreateSegmentDto): Promise<SegmentView> {
        return this.segments.create(body);
    }

    /** Rename a segment, or change the reader tags it answers to. */
    @Patch(':id')
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.SEGMENTS_MANAGE)
    @ApiOperation({
        summary: 'Update a segment',
        description:
            'Changing `tags` is what the segment indirection exists for: an identifier renamed upstream is one row edited here, and every entry that named the segment keeps working.'
    })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: UpdateSegmentDto
    ): Promise<SegmentView> {
        return this.segments.update(id, body);
    }

    /** Delete a segment and drop it from every entry that named it. */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.SEGMENTS_MANAGE)
    @ApiOperation({
        summary: 'Delete a segment',
        description:
            'Also removes it from every entry’s allow and deny list, in one transaction. Leaving the id behind would leave entries governed by a segment that resolves to nobody — silently closing content on the allow side and opening it on the deny side.'
    })
    remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.segments.remove(id);
    }
}
