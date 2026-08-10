import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { Table, TableSchema } from '../halls/hall-table.schema';
import { Order, OrderSchema } from '../orders/order.schemas';
import { Shift, ShiftSchema } from '../shifts/shift.schemas';
import { Payment, PaymentSchema, Refund, RefundSchema } from './payment.schemas';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Table.name, schema: TableSchema },
      { name: Shift.name, schema: ShiftSchema },
    ]),
    EventsModule,
    AuditModule,
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService, MongooseModule],
})
export class PaymentsModule {}
