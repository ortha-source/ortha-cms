import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { buildPlugins } from './plugins';
import './styles.css';

createAdmin({ plugins: buildPlugins() });
