import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    AssetNotFoundError,
    FolderNotFoundError,
    InvalidAssetFilterError,
    InvalidFileNameError,
    InvalidFolderNameError,
    InvalidMediaIdError,
    ObjectNotFoundError
} from '../domain/errors';

/**
 * Maps a transport-agnostic media domain error to its HTTP equivalent, or
 * rethrows anything unrecognized. Controllers — and the agent tools, which need
 * the same mapping for a different reason — wrap use-case calls in a
 * `try/catch` and funnel the error here so the mapping lives in one place.
 *
 * **Rethrowing is the right answer for the rest.** A storage key that fails
 * containment (`provider-local`'s `StorageKeyOutsideRootError`) is a corrupted
 * row, not a caller's mistake, and a 500 is the honest reply — Nest's default
 * filter logs it with its stack, which is exactly what an operator needs. What
 * this must never do is flatten an unknown fault into a 4xx.
 */
export function toHttp(error: unknown): never {
    if (
        error instanceof AssetNotFoundError ||
        error instanceof FolderNotFoundError
    ) {
        throw new NotFoundException(error.message);
    }
    // A row whose blob is gone is, from the caller's side, indistinguishable
    // from a missing asset — and the download route already answers the same
    // 404 for a missing id and for a non-member, so ids stay unprobeable. Its
    // own message would leak the storage key, so it does not carry one.
    if (error instanceof ObjectNotFoundError) {
        throw new NotFoundException();
    }
    if (
        error instanceof InvalidMediaIdError ||
        error instanceof InvalidFileNameError ||
        error instanceof InvalidFolderNameError ||
        error instanceof InvalidAssetFilterError
    ) {
        throw new BadRequestException(error.message);
    }
    throw error;
}
