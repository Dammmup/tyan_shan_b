import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../events/events.module';
import {
  Printer,
  PrinterSchema,
  PrintJob,
  PrintJobSchema,
  PrinterAgentToken,
  PrinterAgentTokenSchema,
} from './printer.schemas';
import { PrintersService } from './printers.service';
import { PrintersController } from './printers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Printer.name, schema: PrinterSchema },
      { name: PrintJob.name, schema: PrintJobSchema },
      { name: PrinterAgentToken.name, schema: PrinterAgentTokenSchema },
    ]),
    EventsModule,
  ],
  providers: [PrintersService],
  controllers: [PrintersController],
  exports: [PrintersService, MongooseModule],
})
export class PrintersModule {}
