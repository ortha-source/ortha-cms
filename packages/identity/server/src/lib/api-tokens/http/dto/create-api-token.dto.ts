import {
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
 * Body for `POST /api/api-tokens`. The strict host `ValidationPipe`
 * (`forbidNonWhitelisted`) rejects any field not declared here.
 */
export class CreateApiTokenDto {
    /** Human label shown in the admin list. */
    @IsString()
    @MinLength(1)
    @MaxLength(NAME_MAX_LENGTH)
    name!: string;

    /** The single workspace the token may read. */
    @IsUUID()
    workspaceId!: string;

    /** `read` (read-only) or `full` (content CRUD). */
    @IsIn([...API_TOKEN_SCOPES])
    scope!: ApiTokenScope;

    /**
     * Absolute expiry as an ISO-8601 timestamp. Omit for a token that never
     * expires. The controller rejects a value in the past.
     */
    @IsOptional()
    @IsISO8601()
    expiresAt?: string;
}
