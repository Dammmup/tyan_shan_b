import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { HallsModule } from './modules/halls/halls.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { PrintersModule } from './modules/printers/printers.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    OrganizationsModule,
    RestaurantsModule,
    RolesModule,
    UsersModule,
    AuthModule,
    HallsModule,
    MenuModule,
    PricingModule,
    OrdersModule,
    KitchenModule,
    PaymentsModule,
    ShiftsModule,
    DiscountsModule,
    PrintersModule,
    ReportsModule,
    AuditModule,
    EventsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
