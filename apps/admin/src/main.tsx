import { createAdmin } from '@ortha-cms/bootstrap-admin';
import App from './app/app';
import './styles.css';

createAdmin({
    plugins: [{ name: 'app', routes: [{ path: '/*', element: <App /> }] }]
});
