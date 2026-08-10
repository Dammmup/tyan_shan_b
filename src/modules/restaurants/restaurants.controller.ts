import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto, UpdateRestaurantDto } from './restaurants.dto';

@ApiTags('restaurants')
@ApiBearerAuth()
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @Permissions(Permission.RESTAURANT_MANAGE)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRestaurantDto) {
    return this.restaurantsService.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.restaurantsService.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.restaurantsService.get(user, id);
  }

  @Patch(':id')
  @Permissions(Permission.RESTAURANT_MANAGE)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.update(user, id, dto);
  }
}
