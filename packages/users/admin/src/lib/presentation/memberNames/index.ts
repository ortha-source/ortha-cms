import type { Member } from '../../domain/types/member';

/**
 * The name a sentence about this member uses — "Make Grace an admin",
 * "Suspend Grace". The first word of their display name; for someone who has
 * not accepted their invite (whose `name` is still their address) the whole
 * address, because "Make lena@growth.io an admin" is right and "Make
 * lena@growth.io's" first word is not a name at all.
 */
export function shortNameOf(member: Pick<Member, 'name' | 'email'>): string {
    if (member.name === member.email) {
        return member.email;
    }
    return member.name.trim().split(/\s+/)[0] || member.email;
}
