import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DiscountType } from '../../common/enums';

export type DiscountDocument = HydratedDocument<Discount>;

@Schema({ timestamps: true, collection: 'discounts' })
export class Discount {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: DiscountType, required: true })
  type!: DiscountType;

  /** For PERCENT: 0-100. For FIXED: amount in tiyns. */
  @Prop({ required: true, min: 0 })
  value!: number;

  /** Max percent a role may apply without manager override. */
  @Prop({ default: 100, min: 0, max: 100 })
  maxPercentAllowed!: number;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;
}

export const DiscountSchema = SchemaFactory.createForClass(Discount);
