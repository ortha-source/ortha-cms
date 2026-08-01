import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Query params for `GET /api/workspaces/slug-available`. */
export class CheckSlugDto {
    /** Candidate slug to test for availability. */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: 120,
        example: 'marketing-site',
        description:
            'Candidate slug to test for availability. Format (lowercase letters, digits, hyphens) is enforced by the `Slug` value object on create.'
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    slug!: string;
}
