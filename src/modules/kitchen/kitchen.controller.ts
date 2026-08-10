import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { KitchenStatus, Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { KitchenService } from './kitchen.service';

@ApiTags('kitchen')
@ApiBearerAuth()
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get()
  @Permissions(Permission.KITCHEN_VIEW)
  list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: KitchenStatus,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.kitchenService.list(user, status, restaurantId);
  }

  @Post(':id/accept')
  @Permissions(Permission.KITCHEN_MANAGE)
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.kitchenService.accept(user, id);
  }

  @Post(':id/cooking')
  @Permissions(Permission.KITCHEN_MANAGE)
  cooking(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.kitchenService.cooking(user, id);
  }

  @Post(':id/ready')
  @Permissions(Permission.KITCHEN_MANAGE)
  ready(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.kitchenService.ready(user, id);
  }

  @Post(':id/served')
  @Permissions(Permission.KITCHEN_MANAGE)
  served(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.kitchenService.served(user, id);
  }
}
