import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength
} from 'class-validator';

/** The body to create a folder. `parentId` omitted means a top-level folder. */
export class CreateFolderDto {
    /** Folder name, unique among its siblings in the workspace. */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: 120,
        example: 'Product shots',
        description: 'Folder name. Non-empty, at most 120 characters.'
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;

    /** Parent folder; omitted creates the folder at the workspace root. */
    @ApiPropertyOptional({
        type: String,
        format: 'uuid',
        description:
            'Parent folder id. Omit to create the folder at the workspace root.'
    })
    @IsOptional()
    @IsUUID()
    parentId?: string;
}
