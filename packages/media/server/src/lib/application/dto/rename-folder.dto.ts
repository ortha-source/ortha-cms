import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** The body to rename a folder. */
export class RenameFolderDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;
}
