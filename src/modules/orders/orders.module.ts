import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PricingModule } from '../pricing/pricing.module';
import { Hall, HallSchema, Table, TableSchema } from '../halls/hall-table.schema';
import { Product, ProductSchema } from '../menu/menu.schemas';
import {
  KitchenOrder,
  KitchenOrderSchema,
} from '../kitchen/kitchen-order.schema';
import {
  Printer,
  PrinterSchema,
  PrintJob,
  PrintJobSchema,
} from '../printers/printer.schemas';
import { Shift, ShiftSchema } from '../shifts/shift.schemas';
import {
  Order,
  OrderSchema,
  OrderItem,
  OrderItemSchema,
  SubOrder,
  SubOrderSchema,
} from './order.schemas';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: SubOrder.name, schema: SubOrderSchema },
      { name: Table.name, schema: TableSchema },
      { name: Hall.name, schema: HallSchema },
      { name: Product.name, schema: ProductSchema },
      { name: KitchenOrder.name, schema: KitchenOrderSchema },
      { name: Printer.name, schema: PrinterSchema },
      { name: PrintJob.name, schema: PrintJobSchema },
      { name: Shift.name, schema: ShiftSchema },
    ]),
    PricingModule,
    EventsModule,
    AuditModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
