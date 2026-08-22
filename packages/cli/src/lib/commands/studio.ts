import { loadHost, requireDatabaseUrl } from '../project';
import { runDrizzleKitStudio, type StudioServerOptions } from '../studio';
import { buildCommand } from './build';

/** Opens Drizzle Studio against the app's database. */
export async function studioCommand(
    root: string,
    options: StudioServerOptions
): Promise<void> {
    await buildCommand(root, { serverOnly: true });

    const { config } = loadHost(root);

    runDrizzleKitStudio(requireDatabaseUrl(config), options);
}
