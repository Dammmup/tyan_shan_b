import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { Restaurant, RestaurantSchema } from './restaurant.schema';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
    AuditModule,
  ],
  providers: [RestaurantsService],
  controllers: [RestaurantsController],
  exports: [RestaurantsService, MongooseModule],
})
export class RestaurantsModule {}
