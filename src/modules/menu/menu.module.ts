import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import {
  Category,
  CategorySchema,
  Product,
  ProductSchema,
  Price,
  PriceSchema,
  ModifierGroup,
  ModifierGroupSchema,
  Modifier,
  ModifierSchema,
} from './menu.schemas';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
      { name: Price.name, schema: PriceSchema },
      { name: ModifierGroup.name, schema: ModifierGroupSchema },
      { name: Modifier.name, schema: ModifierSchema },
    ]),
    AuditModule,
  ],
  providers: [MenuService],
  controllers: [MenuController],
  exports: [MenuService, MongooseModule],
})
export class MenuModule {}
