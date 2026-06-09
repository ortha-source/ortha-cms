import type { DirectoryUser } from '../../types/wizard';

// TODO(users-server): replace this in-memory directory with `apiClient.get`
// against `GET /api/users?q=` (gated by `read:admin:user`) once the users
// server plugin ships. `searchUsers` is the contract the real client satisfies.

const DIRECTORY: DirectoryUser[] = [
    { id: 'u_ada', name: 'Ada Lovelace', email: 'ada@ortha.dev' },
    { id: 'u_grace', name: 'Grace Hopper', email: 'grace@ortha.dev' },
    { id: 'u_alan', name: 'Alan Turing', email: 'alan@ortha.dev' },
    { id: 'u_linus', name: 'Linus Torvalds', email: 'linus@ortha.dev' },
    { id: 'u_margaret', name: 'Margaret Hamilton', email: 'margaret@ortha.dev' },
    { id: 'u_dennis', name: 'Dennis Ritchie', email: 'dennis@ortha.dev' },
    { id: 'u_katherine', name: 'Katherine Johnson', email: 'katherine@ortha.dev' },
    { id: 'u_barbara', name: 'Barbara Liskov', email: 'barbara@ortha.dev' },
    { id: 'u_edsger', name: 'Edsger Dijkstra', email: 'edsger@ortha.dev' },
    { id: 'u_donald', name: 'Donald Knuth', email: 'donald@ortha.dev' }
];

/** Directory users matching `query` by name or email (case-insensitive). */
export async function searchUsers(query: string): Promise<DirectoryUser[]> {
    const q = query.trim().toLowerCase();
    if (!q) return structuredClone(DIRECTORY);
    return DIRECTORY.filter(
        (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
    );
}
