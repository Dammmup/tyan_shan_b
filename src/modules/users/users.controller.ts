import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UsersService } from './users.service';
import { CreateUserDto, SetPinDto, UpdateUserDto } from './users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions(Permission.USER_MANAGE)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Get()
  @Permissions(Permission.USER_MANAGE)
  list(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.usersService.list(user, restaurantId);
  }

  @Get(':id')
  @Permissions(Permission.USER_MANAGE)
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.get(user, id);
  }

  @Patch(':id')
  @Permissions(Permission.USER_MANAGE)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.USER_MANAGE)
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.archive(user, id);
  }

  @Post(':id/pin')
  @Permissions(Permission.USER_MANAGE)
  setPin(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetPinDto,
  ) {
    return this.usersService.setPin(user, id, dto);
  }
}
