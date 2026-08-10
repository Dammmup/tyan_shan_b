import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema, OrderItem, OrderItemSchema } from '../orders/order.schemas';
import { Payment, PaymentSchema } from '../payments/payment.schemas';
import { Shift, ShiftSchema } from '../shifts/shift.schemas';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Shift.name, schema: ShiftSchema },
    ]),
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
