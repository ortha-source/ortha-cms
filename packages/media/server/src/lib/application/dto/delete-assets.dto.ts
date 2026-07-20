import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** The body for a bulk asset delete — a non-empty, bounded list of ids. */
export class DeleteAssetsDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(100)
    @IsUUID('all', { each: true })
    ids!: string[];
}
