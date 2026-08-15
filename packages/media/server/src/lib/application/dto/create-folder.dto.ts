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
    /**
     * Folder name. **Not** unique among its siblings — there is no unique index
     * on `(workspace_id, parent_id, name)` and no check in the use case, so two
     * folders can share a name under one parent and are told apart by id. Said
     * plainly because this JSDoc used to claim the opposite.
     */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: 120,
        example: 'Product shots',
        description:
            'Folder name. Non-empty, at most 120 characters. Names are not required to be unique among siblings.'
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
