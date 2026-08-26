import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    IsArray,
    IsString,
    IsUUID,
    MaxLength
} from 'class-validator';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import {
    ExplainService,
    type ExplainResult
} from '../../application/explain.service';

const TAGS_MAX = 50;
const TAG_MAX = 200;
const SLUG_MAX = 120;

/** Ask what one reader would see. */
export class ExplainAccessDto {
    @ApiProperty({ maxLength: SLUG_MAX, example: 'article' })
    @IsString()
    @MaxLength(SLUG_MAX)
    typeSlug!: string;

    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    entryId!: string;

    @ApiProperty({
        type: [String],
        maxItems: TAGS_MAX,
        example: ['org:acme', 'plan:trial'],
        description:
            'The reader’s tags, as the resolver would produce them. An empty list is the anonymous reader.'
    })
    @IsArray()
    @ArrayMaxSize(TAGS_MAX)
    @IsString({ each: true })
    @MaxLength(TAG_MAX, { each: true })
    tags!: string[];
}

/**
 * "Who sees this, and why".
 *
 * `access:read` rather than `access:manage`: an editor about to publish behind
 * a rule needs to be able to check it, and this answers a question about
 * content they can already read in full through the admin. It reveals no entry
 * data — only the decision and the rule it came from.
 *
 * A **POST** for a read, because the reader's tags are the input and a list of
 * them does not belong in a URL: it would land in access logs and in browser
 * history, and it describes a person.
 */
@ApiTags('Access')
@Controller('access/explain')
@UseGuards(PermissionsGuard, WorkspaceGuard)
export class ExplainController {
    constructor(private readonly explain: ExplainService) {}

    /** Explain one reader's access to one entry, step by step. */
    @Post()
    @RequirePermissions(PERMISSIONS.ACCESS_READ)
    @ApiOperation({
        summary: 'Explain an access decision',
        description:
            'Runs the real decision function and reports each check in order — exclusions, the window, then each condition group. Not a description of what the rule ought to do: a second implementation written to explain the first is one that can disagree with it.'
    })
    run(
        @CurrentWorkspace() workspaceId: string,
        @Body() body: ExplainAccessDto
    ): Promise<ExplainResult> {
        return this.explain.explain({
            workspaceId,
            typeSlug: body.typeSlug,
            entryId: body.entryId,
            tags: body.tags
        });
    }
}
