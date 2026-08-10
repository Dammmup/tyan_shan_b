import {
  Body,
  Controller,
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
import { HallsService } from './halls.service';
import {
  CreateHallDto,
  CreateTableDto,
  UpdateHallDto,
  UpdateTableDto,
} from './halls.dto';

@ApiTags('halls')
@ApiBearerAuth()
@Controller()
export class HallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Post('halls')
  @Permissions(Permission.HALL_MANAGE)
  createHall(@CurrentUser() user: JwtPayload, @Body() dto: CreateHallDto) {
    return this.hallsService.createHall(user, dto);
  }

  @Get('halls')
  listHalls(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.hallsService.listHalls(user, restaurantId);
  }

  @Patch('halls/:id')
  @Permissions(Permission.HALL_MANAGE)
  updateHall(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHallDto,
  ) {
    return this.hallsService.updateHall(user, id, dto);
  }

  @Post('tables')
  @Permissions(Permission.TABLE_MANAGE)
  createTable(@CurrentUser() user: JwtPayload, @Body() dto: CreateTableDto) {
    return this.hallsService.createTable(user, dto);
  }

  @Get('tables')
  listTables(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
    @Query('hallId') hallId?: string,
  ) {
    return this.hallsService.listTables(user, restaurantId, hallId);
  }

  @Patch('tables/:id')
  @Permissions(Permission.TABLE_MANAGE)
  updateTable(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.hallsService.updateTable(user, id, dto);
  }
}
