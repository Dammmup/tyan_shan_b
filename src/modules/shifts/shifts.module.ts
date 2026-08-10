import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { Payment, PaymentSchema } from '../payments/payment.schemas';
import {
  CashOperation,
  CashOperationSchema,
  Shift,
  ShiftSchema,
} from './shift.schemas';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shift.name, schema: ShiftSchema },
      { name: CashOperation.name, schema: CashOperationSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    AuditModule,
  ],
  providers: [ShiftsService],
  controllers: [ShiftsController],
  exports: [ShiftsService, MongooseModule],
})
export class ShiftsModule {}
