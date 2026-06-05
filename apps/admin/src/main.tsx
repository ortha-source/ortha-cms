import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { IdentityPlugin } from '@ortha-cms/identity-admin';
import { HomePage } from './home-page';
import './styles.css';

createAdmin({
    plugins: [
        IdentityPlugin(),
        // Temporary app-level home route; replaced by a real dashboard plugin later.
        { name: 'home', routes: [{ path: '/', element: <HomePage /> }] }
    ]
});
