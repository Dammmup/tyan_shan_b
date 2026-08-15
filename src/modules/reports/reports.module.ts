import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hall, HallSchema, Table, TableSchema } from '../halls/hall-table.schema';
import { Order, OrderSchema, OrderItem, OrderItemSchema } from '../orders/order.schemas';
import { Payment, PaymentSchema } from '../payments/payment.schemas';
import { Restaurant, RestaurantSchema } from '../restaurants/restaurant.schema';
import { Shift, ShiftSchema } from '../shifts/shift.schemas';
import { User, UserSchema } from '../users/user.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Table.name, schema: TableSchema },
      { name: Hall.name, schema: HallSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
