import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
    PermissionsGuard,
    RequirePermission
} from '@ortha-cms/identity-server';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UsersService } from '../services/users.service';
import type { MemberListView } from '../types/member-view';

/**
 * `GET /api/users` — one searchable, paginated page of members. Authentication
 * comes from identity's global `AuthGuard`; authorization is `users:read`,
 * which every seeded role holds, so any signed-in member can view the roster
 * (emails included — consistent with the workspaces read surface).
 */
@UseGuards(PermissionsGuard)
@RequirePermission('users:read')
@Controller('users')
export class ListUsersController {
    constructor(private readonly users: UsersService) {}

    @Get()
    list(@Query() query: ListUsersQueryDto): Promise<MemberListView> {
        return this.users.list(query);
    }
}
