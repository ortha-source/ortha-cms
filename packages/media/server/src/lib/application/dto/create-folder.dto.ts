import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength
} from 'class-validator';

/** The body to create a folder. `parentId` omitted means a top-level folder. */
export class CreateFolderDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;

    @IsOptional()
    @IsUUID()
    parentId?: string;
}
