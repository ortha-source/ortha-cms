import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Query params for `GET /api/users`. A blank/omitted `q` lists the first page of
 * users; otherwise it's a case-insensitive name/email substring match.
 */
export class SearchUsersDto {
    /** Search term matched against name and email. */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    q?: string;
}
