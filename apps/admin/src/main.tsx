import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { IdentityPlugin } from '@ortha-cms/identity-admin';
import './styles.css';

createAdmin({
    plugins: [IdentityPlugin()]
});
