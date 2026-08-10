import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PrintJobStatus, ProductionCenter } from '../../common/enums';

export type PrinterDocument = HydratedDocument<Printer>;
export type PrintJobDocument = HydratedDocument<PrintJob>;
export type PrinterAgentTokenDocument = HydratedDocument<PrinterAgentToken>;

@Schema({ timestamps: true, collection: 'printers' })
export class Printer {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: String, enum: ProductionCenter, required: true })
  productionCenter!: ProductionCenter;

  @Prop({ trim: true })
  connectionString?: string;

  @Prop({ trim: true, default: '127.0.0.1' })
  ip!: string;

  @Prop({ default: 9100 })
  port!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const PrinterSchema = SchemaFactory.createForClass(Printer);

@Schema({ timestamps: true, collection: 'print_jobs' })
export class PrintJob {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Printer', default: null })
  printerId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'KitchenOrder', default: null })
  kitchenOrderId!: Types.ObjectId | null;

  @Prop({ type: String, enum: ProductionCenter, required: true })
  productionCenter!: ProductionCenter;

  @Prop({ type: String, enum: PrintJobStatus, default: PrintJobStatus.PENDING, index: true })
  status!: PrintJobStatus;

  @Prop({ required: true, unique: true, index: true })
  idempotencyKey!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop()
  lastError?: string;

  @Prop({ type: Date })
  ackedAt?: Date;
}

export const PrintJobSchema = SchemaFactory.createForClass(PrintJob);

@Schema({ timestamps: true, collection: 'printer_agent_tokens' })
export class PrinterAgentToken {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  token!: string;

  @Prop({ required: true, trim: true })
  deviceName!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  lastSeenAt!: Date | null;
}

export const PrinterAgentTokenSchema =
  SchemaFactory.createForClass(PrinterAgentToken);
