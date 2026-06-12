import { Controller, Get, Query } from '@nestjs/common';
import { UserService, type DirectoryUser } from '../services/user.service';
import { SearchUsersDto } from '../dto/search-users.dto';

/**
 * `GET /api/users?q=` — searches the user directory for the workspace wizard's
 * member typeahead. Authentication is enforced by the app-wide `AuthGuard`
 * (conceptually `users:read`; a permission guard lands in a later ticket).
 */
@Controller('users')
export class SearchUsersController {
    constructor(private readonly users: UserService) {}

    @Get()
    search(@Query() query: SearchUsersDto): Promise<DirectoryUser[]> {
        return this.users.search(query.q ?? '');
    }
}
