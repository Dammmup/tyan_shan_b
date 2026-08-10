import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../events/events.module';
import { OrderItem, OrderItemSchema } from '../orders/order.schemas';
import { KitchenOrder, KitchenOrderSchema } from './kitchen-order.schema';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KitchenOrder.name, schema: KitchenOrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
    ]),
    EventsModule,
  ],
  providers: [KitchenService],
  controllers: [KitchenController],
  exports: [KitchenService, MongooseModule],
})
export class KitchenModule {}
