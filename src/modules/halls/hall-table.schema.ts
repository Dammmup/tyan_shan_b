import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TableStatus } from '../../common/enums';

export type HallDocument = HydratedDocument<Hall>;
export type TableDocument = HydratedDocument<Table>;

@Schema({ timestamps: true, collection: 'halls' })
export class Hall {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;
}

export const HallSchema = SchemaFactory.createForClass(Hall);

@Schema({ timestamps: true, collection: 'tables' })
export class Table {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Hall', required: true, index: true })
  hallId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  positionX!: number;

  @Prop({ required: true, default: 0 })
  positionY!: number;

  @Prop({ required: true, default: 80 })
  width!: number;

  @Prop({ required: true, default: 80 })
  height!: number;

  @Prop({ type: String, enum: TableStatus, default: TableStatus.FREE })
  status!: TableStatus;

  @Prop({ type: Types.ObjectId, ref: 'Order', default: null })
  currentOrderId!: Types.ObjectId | null;

  @Prop({ default: 4 })
  seats!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const TableSchema = SchemaFactory.createForClass(Table);
TableSchema.index({ restaurantId: 1, hallId: 1, name: 1 });
