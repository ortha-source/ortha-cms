import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** The body to rename a folder. */
export class RenameFolderDto {
    /** The folder's new name. */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: 120,
        example: 'Archive 2026',
        description: 'The folder’s new name. Non-empty, at most 120 characters.'
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;
}
