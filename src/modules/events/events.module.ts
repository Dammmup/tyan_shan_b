import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  PrintJob,
  PrintJobSchema,
  PrinterAgentToken,
  PrinterAgentTokenSchema,
} from '../printers/printer.schemas';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    MongooseModule.forFeature([
      { name: PrinterAgentToken.name, schema: PrinterAgentTokenSchema },
      { name: PrintJob.name, schema: PrintJobSchema },
    ]),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
