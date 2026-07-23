import {
    BadRequestException,
    ConflictException,
    NotFoundException
} from '@nestjs/common';
import {
    AssetNotFoundError,
    FolderNotEmptyError,
    FolderNotFoundError,
    InvalidFileNameError,
    InvalidFolderNameError,
    InvalidMediaIdError
} from '../domain/errors';

/**
 * Maps a transport-agnostic media domain error to its HTTP equivalent, or
 * rethrows anything unrecognized. Controllers wrap use-case calls in a
 * `try/catch` and funnel the error here so the HTTP mapping lives in one place.
 */
export function toHttp(error: unknown): never {
    if (
        error instanceof AssetNotFoundError ||
        error instanceof FolderNotFoundError
    ) {
        throw new NotFoundException(error.message);
    }
    if (error instanceof FolderNotEmptyError) {
        throw new ConflictException(error.message);
    }
    if (
        error instanceof InvalidMediaIdError ||
        error instanceof InvalidFileNameError ||
        error instanceof InvalidFolderNameError
    ) {
        throw new BadRequestException(error.message);
    }
    throw error;
}
