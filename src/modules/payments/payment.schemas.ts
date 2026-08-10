import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentMethod } from '../../common/enums';

export type PaymentDocument = HydratedDocument<Payment>;
export type RefundDocument = HydratedDocument<Refund>;

@Schema({ _id: false })
export class PaymentSplitPart {
  @Prop({ type: String, enum: PaymentMethod, required: true })
  method!: PaymentMethod;

  /** Amount in tiyns. */
  @Prop({ required: true, min: 0 })
  amountTiyns!: number;
}

export const PaymentSplitPartSchema = SchemaFactory.createForClass(PaymentSplitPart);

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Shift', default: null })
  shiftId!: Types.ObjectId | null;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  method!: PaymentMethod;

  /** Total paid in tiyns. */
  @Prop({ required: true, min: 0 })
  amountTiyns!: number;

  @Prop({ type: [PaymentSplitPartSchema], default: [] })
  splits!: PaymentSplitPart[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: false })
  isRefunded!: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

@Schema({ timestamps: true, collection: 'refunds' })
export class Refund {
  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true, index: true })
  paymentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  /** Refund amount in tiyns. */
  @Prop({ required: true, min: 0 })
  amountTiyns!: number;

  @Prop()
  reason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
