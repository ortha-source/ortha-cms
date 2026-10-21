import { createAdmin } from '@orthacms/bootstrap-admin';
import { buildPlugins } from './plugins';
import './styles.css';

createAdmin({
    plugins: buildPlugins(),
    // Page chunks are preloaded in a production build; under the dev server a
    // "chunk" is a page's whole unbundled module graph (see `preloadPages`).
    preloadPages: !import.meta.env.DEV
});
