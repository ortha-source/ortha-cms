/**
 * Temporary home page served at `/`. It is the landing target after a
 * successful login; a real dashboard (and auth gating) replace it in a later
 * ticket.
 */
export function HomePage() {
    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
            <h1 className="text-2xl font-semibold">Ortha CMS</h1>
            <p className="text-muted-foreground">Home</p>
        </main>
    );
}
