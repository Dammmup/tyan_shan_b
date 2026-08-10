import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions(Permission.ROLE_MANAGE)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user, dto);
  }

  @Get()
  @Permissions(Permission.ROLE_MANAGE)
  list(@CurrentUser() user: JwtPayload) {
    return this.rolesService.list(user);
  }

  @Get(':id')
  @Permissions(Permission.ROLE_MANAGE)
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.rolesService.get(user, id);
  }

  @Patch(':id')
  @Permissions(Permission.ROLE_MANAGE)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(user, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.ROLE_MANAGE)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.rolesService.remove(user, id);
  }
}
