import { Injectable } from '@nestjs/common';
import { Member } from '../../domain/member';

/** A `users ⋈ roles` row as selected for aggregate reconstruction. */
export interface MemberRow {
    id: string;
    email: string;
    name: string | null;
    status: string;
    roleKey: string;
}

/**
 * Translates a persisted `users ⋈ roles` row into the {@link Member} aggregate.
 * Keeps the row shape out of the domain and the aggregate out of the
 * repository's query code. The reverse direction (aggregate → insert/patch)
 * lives in the repository, which also resolves the role key to its surrogate id.
 */
@Injectable()
export class MemberMapper {
    /** Rebuilds the aggregate from a `users ⋈ roles` row. */
    toDomain(row: MemberRow): Member {
        return Member.rehydrate({
            id: row.id,
            email: row.email,
            name: row.name,
            roleKey: row.roleKey,
            status: row.status
        });
    }
}
