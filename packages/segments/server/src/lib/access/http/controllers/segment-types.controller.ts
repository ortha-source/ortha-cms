import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
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
    SegmentTypesService,
    type SegmentTypeView
} from '../../application/segment-types.service';
import {
    CreateSegmentTypeDto,
    UpdateSegmentTypeDto
} from '../dto/segment-types.dto';

/**
 * The segment-type directory — the axes reader access is decided on.
 *
 * A genuine CRUD resource over one thing, so one controller rather than four:
 * the endpoints share a dependency and differ only in verb. Not
 * workspace-scoped — a segment type is an installation-wide axis, like a content
 * type, and scoping it per workspace would make "organisation" mean a different
 * slot in each one.
 *
 * Reading is `access:read` (contributor and viewer hold it, because an editor
 * who cannot see that an article is restricted will publish one believing it is
 * public). Writing is `access:manage`, admin-only: creating or retiring an axis
 * changes what every reader of the site can see.
 */
@ApiTags('Access')
@Controller('access/segment-types')
@UseGuards(PermissionsGuard)
export class SegmentTypesController {
    constructor(private readonly types: SegmentTypesService) {}

    /** Every declared type, with its segment count and slot. */
    @Get()
    @RequirePermissions(PERMISSIONS.ACCESS_READ)
    @ApiOperation({
        summary: 'List segment types',
        description:
            'Every axis reader access can be decided on, whether declared in configuration or created here.'
    })
    list(): Promise<SegmentTypeView[]> {
        return this.types.list();
    }

    /** Create a type on the lowest free slot, with its mask segment. */
    @Post()
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Create a segment type',
        description:
            'Claims the lowest free projection slot and creates the type’s mask segment. Fails with 409 when the key is taken or every slot is held.'
    })
    create(@Body() body: CreateSegmentTypeDto): Promise<SegmentTypeView> {
        return this.types.create(body);
    }

    /** Rename a type or change how it renders. Its slot never moves. */
    @Patch(':id')
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Update a segment type',
        description:
            'Label and rendering hint only. The key and the slot are immutable — the slot is what the projection’s columns mean.'
    })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: UpdateSegmentTypeDto
    ): Promise<SegmentTypeView> {
        return this.types.update(id, body);
    }

    /**
     * Retire a type — leaves the predicate, zeroes its slot, frees it.
     *
     * `DELETE` in the HTTP sense, but the row survives: the state machine is
     * what makes the slot safe to reuse, and a hard delete would drop the record
     * of an axis that content is still projected against.
     */
    @Delete(':id')
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Retire a segment type',
        description:
            'Removes the type from the access decision, zeroes its projection slot and returns the slot to the pool. Every entry the type was hiding becomes readable.'
    })
    retire(@Param('id', ParseUUIDPipe) id: string): Promise<SegmentTypeView> {
        return this.types.retire(id);
    }
}
