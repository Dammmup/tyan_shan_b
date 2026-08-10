import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { Hall, HallSchema, Table, TableSchema } from './hall-table.schema';
import { HallsService } from './halls.service';
import { HallsController } from './halls.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Hall.name, schema: HallSchema },
      { name: Table.name, schema: TableSchema },
    ]),
    AuditModule,
    EventsModule,
  ],
  providers: [HallsService],
  controllers: [HallsController],
  exports: [HallsService, MongooseModule],
})
export class HallsModule {}
