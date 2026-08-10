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
import { DiscountsService } from './discounts.service';
import {
  ApplyDiscountDto,
  CreateDiscountDto,
  UpdateDiscountDto,
} from './discounts.dto';

@ApiTags('discounts')
@ApiBearerAuth()
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @Permissions(Permission.DISCOUNT_MANAGE)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDiscountDto) {
    return this.discountsService.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.discountsService.list(user, restaurantId);
  }

  @Patch(':id')
  @Permissions(Permission.DISCOUNT_MANAGE)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discountsService.update(user, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.DISCOUNT_MANAGE)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.discountsService.softDelete(user, id);
  }

  @Post('orders/:orderId/apply')
  @Permissions(Permission.ORDER_DISCOUNT)
  apply(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: ApplyDiscountDto,
  ) {
    return this.discountsService.apply(user, orderId, dto);
  }
}
