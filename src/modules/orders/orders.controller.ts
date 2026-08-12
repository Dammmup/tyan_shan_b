import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { OrdersService } from './orders.service';
import {
  AddOrderItemDto,
  CreateOrderDto,
  CreateSubOrderDto,
  TransferOrderDto,
} from './orders.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Permissions(Permission.ORDER_CREATE)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user, dto);
  }

  @Get()
  @Permissions(Permission.ORDER_VIEW)
  list(
    @CurrentUser() user: JwtPayload,
    @Query('restaurantId') restaurantId?: string,
    @Query('status') status?: string,
  ) {
    return this.ordersService.list(user, restaurantId, status);
  }

  @Get(':id')
  @Permissions(Permission.ORDER_VIEW)
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.getById(user, id);
  }

  @Post(':id/items')
  @Permissions(Permission.ORDER_CREATE)
  addItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddOrderItemDto,
  ) {
    return this.ordersService.addItem(user, id, dto);
  }

  @Delete(':id/items/:itemId')
  @Permissions(Permission.ORDER_CANCEL)
  cancelItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.cancelItem(user, id, itemId);
  }

  @Post(':id/cancel')
  @Permissions(Permission.ORDER_CANCEL)
  cancelOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.cancelOrder(user, id);
  }

  @Post(':id/transfer')
  @Permissions(Permission.ORDER_CREATE)
  transfer(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TransferOrderDto,
  ) {
    return this.ordersService.transferToTable(user, id, dto);
  }

  @Post(':id/suborders')
  @Permissions(Permission.ORDER_CREATE)
  createSubOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateSubOrderDto,
  ) {
    return this.ordersService.createSubOrder(user, id, dto);
  }

  @Post(':id/precheck')
  @Permissions(Permission.ORDER_CREATE)
  printPrecheck(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.printPrecheck(user, id);
  }
}
