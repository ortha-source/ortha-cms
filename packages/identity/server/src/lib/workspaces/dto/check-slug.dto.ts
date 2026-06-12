import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Query params for `GET /api/workspaces/slug-available`. */
export class CheckSlugDto {
    /** Candidate slug to test for availability. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    slug!: string;
}
