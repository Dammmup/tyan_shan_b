import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CashOpType, ShiftStatus } from '../../common/enums';

export type ShiftDocument = HydratedDocument<Shift>;
export type CashOperationDocument = HydratedDocument<CashOperation>;

@Schema({ timestamps: true, collection: 'shifts' })
export class Shift {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  openedBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  closedBy!: Types.ObjectId | null;

  @Prop({ type: String, enum: ShiftStatus, default: ShiftStatus.OPEN, index: true })
  status!: ShiftStatus;

  /** Opening float in tiyns. */
  @Prop({ required: true, min: 0, default: 0 })
  openingCashTiyns!: number;

  /** Expected cash at close in tiyns. */
  @Prop({ type: Number, default: null })
  expectedCashTiyns!: number | null;

  /** Actual counted cash in tiyns. */
  @Prop({ type: Number, default: null })
  actualCashTiyns!: number | null;

  /** expected - actual (can be negative). */
  @Prop({ type: Number, default: null })
  discrepancyTiyns!: number | null;

  @Prop({ type: Date, default: () => new Date() })
  openedAt!: Date;

  @Prop({ type: Date, default: null })
  closedAt!: Date | null;

  @Prop()
  closeNote?: string;
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);
ShiftSchema.index({ restaurantId: 1, status: 1 });

@Schema({ timestamps: true, collection: 'cash_operations' })
export class CashOperation {
  @Prop({ type: Types.ObjectId, ref: 'Shift', required: true, index: true })
  shiftId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: String, enum: CashOpType, required: true })
  type!: CashOpType;

  /** Amount in tiyns. */
  @Prop({ required: true, min: 0 })
  amountTiyns!: number;

  @Prop()
  reason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export const CashOperationSchema = SchemaFactory.createForClass(CashOperation);
