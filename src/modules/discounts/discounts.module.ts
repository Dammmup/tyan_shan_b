import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PricingModule } from '../pricing/pricing.module';
import { Order, OrderSchema, OrderItem, OrderItemSchema } from '../orders/order.schemas';
import { Restaurant, RestaurantSchema } from '../restaurants/restaurant.schema';
import { Discount, DiscountSchema } from './discount.schema';
import { DiscountsService } from './discounts.service';
import { DiscountsController } from './discounts.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Discount.name, schema: DiscountSchema },
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
    PricingModule,
    EventsModule,
    AuditModule,
  ],
  providers: [DiscountsService],
  controllers: [DiscountsController],
  exports: [DiscountsService, MongooseModule],
})
export class DiscountsModule {}
