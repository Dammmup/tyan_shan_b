import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Product,
  ProductSchema,
  Price,
  PriceSchema,
  Modifier,
  ModifierSchema,
} from '../menu/menu.schemas';
import { Discount, DiscountSchema } from '../discounts/discount.schema';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Price.name, schema: PriceSchema },
      { name: Modifier.name, schema: ModifierSchema },
      { name: Discount.name, schema: DiscountSchema },
    ]),
  ],
  providers: [PricingService],
  exports: [PricingService, MongooseModule],
})
export class PricingModule {}
