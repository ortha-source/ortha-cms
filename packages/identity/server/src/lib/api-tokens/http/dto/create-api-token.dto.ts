import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayNotEmpty,
    IsArray,
    IsIn,
    IsISO8601,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength
} from 'class-validator';
import {
    API_TOKEN_SCOPES,
    type ApiTokenScope
} from '../../domain/api-token-scope';

/** Max length of a token's display name. */
const NAME_MAX_LENGTH = 120;

/**
 * Upper bound on a token's workspace bucket. Generous (no realistic deployment
 * mints a token spanning more), but it bounds the insert a single request can
 * provoke rather than leaving it open-ended.
 */
export const WORKSPACE_IDS_MAX = 100;

/**
 * Body for `POST /api/api-tokens`. The strict host `ValidationPipe`
 * (`forbidNonWhitelisted`) rejects any field not declared here.
 */
export class CreateApiTokenDto {
    /** Human label shown in the admin list. */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: NAME_MAX_LENGTH,
        example: 'Marketing site build',
        description: 'Human label shown in the admin token list.'
    })
    @IsString()
    @MinLength(1)
    @MaxLength(NAME_MAX_LENGTH)
    name!: string;

    /** Every workspace the token may act in — at least one. */
    @ApiProperty({
        type: [String],
        format: 'uuid',
        minItems: 1,
        maxItems: WORKSPACE_IDS_MAX,
        description:
            'The workspaces this token may act in. At least one; a token may span several, and the public content API picks which one a request targets with `X-Workspace-Id`. Duplicates are collapsed.'
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(WORKSPACE_IDS_MAX)
    @IsUUID(undefined, { each: true })
    workspaceIds!: string[];

    /** `read` (read-only) or `full` (content CRUD). */
    @ApiProperty({
        enum: [...API_TOKEN_SCOPES],
        example: 'read',
        description:
            'Access level: `read` grants `content:read`; `full` grants the complete content CRUD set.'
    })
    @IsIn([...API_TOKEN_SCOPES])
    scope!: ApiTokenScope;

    /**
     * Absolute expiry as an ISO-8601 timestamp. Omit for a token that never
     * expires. The controller rejects a value in the past.
     */
    @ApiPropertyOptional({
        type: String,
        format: 'date-time',
        example: '2027-01-01T00:00:00.000Z',
        description:
            'Absolute expiry (ISO 8601). Omit for a token that never expires; a value in the past is rejected with 400.'
    })
    @IsOptional()
    @IsISO8601()
    expiresAt?: string;
}
