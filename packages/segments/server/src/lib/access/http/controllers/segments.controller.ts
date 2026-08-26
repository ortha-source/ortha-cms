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
} from '../../application/segments.service';
import {
    CreateSegmentDto,
    ListSegmentsQueryDto,
    UpdateSegmentDto
} from '../dto/segments.dto';

/**
 * The segments of one type — what a rule or a grant points at.
 *
 * Nested under the type because a segment has no identity without one: `acme`
 * means nothing until it is `acme` in `org`. `?q=` backs the picker, which on a
 * high-cardinality type is the only usable way to choose.
 *
 * A type whose source is a content collection or an external directory is
 * mirrored rather than edited here — writing to it by hand would produce a
 * segment the next sync deletes. That is enforced upstream of this controller,
 * when a source other than `manual` gains its sync.
 */
@ApiTags('Access')
@Controller('access/segment-types/:typeKey/segments')
@UseGuards(PermissionsGuard)
export class SegmentsController {
    constructor(private readonly segments: SegmentsService) {}

    /** One type's segments, newest search first. */
    @Get()
    @RequirePermissions(PERMISSIONS.ACCESS_READ)
    @ApiOperation({
        summary: 'List a segment type’s segments',
        description:
            'Each carries a usage count — how many projected entries name it — which is what tells a picker apart from a list of typos.'
    })
    list(
        @Param('typeKey') typeKey: string,
        @Query() query: ListSegmentsQueryDto
    ): Promise<SegmentView[]> {
        return this.segments.list(typeKey, query.q);
    }

    /** Create a segment by hand. */
    @Post()
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({ summary: 'Create a segment' })
    create(
        @Param('typeKey') typeKey: string,
        @Body() body: CreateSegmentDto
    ): Promise<SegmentView> {
        return this.segments.create({ typeKey, ...body });
    }

    /** Rename a segment, or change the reader tags it matches. */
    @Patch(':id')
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Update a segment',
        description:
            'Changing `tags` is the operation the segment indirection exists for: a plan renamed upstream is one row edited here, and every rule and projected row keeps working.'
    })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: UpdateSegmentDto
    ): Promise<SegmentView> {
        return this.segments.update(id, body);
    }

    /** Delete a segment nothing references. */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Delete a segment',
        description:
            'Refused with 409 while projected entries still name it — a rule left pointing at a deleted segment resolves to an `only` naming nobody, which closes content silently.'
    })
    remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.segments.remove(id);
    }
}
