/**
 * A body that must be empty.
 *
 * Approving takes nothing but the route. Declaring the body anyway is what
 * makes the host's strict `ValidationPipe` refuse a `note` with a 400 instead of
 * silently dropping it — notes were removed, and a client still sending one has
 * to find out rather than believe it was stored.
 */
export class NoBodyDto {}
