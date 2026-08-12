import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { KitchenStatus, ProductionCenter, PRODUCTION_CENTER_VALUES } from '../../common/enums';

export type KitchenOrderDocument = HydratedDocument<KitchenOrder>;

@Schema({ timestamps: true, collection: 'kitchen_orders' })
export class KitchenOrder {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubOrder', required: true, index: true })
  subOrderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Table', required: true })
  tableId!: Types.ObjectId;

  @Prop({ type: String, enum: PRODUCTION_CENTER_VALUES, required: true, index: true })
  productionCenter!: ProductionCenter;

  @Prop({ type: String, enum: KitchenStatus, default: KitchenStatus.NEW, index: true })
  status!: KitchenStatus;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'OrderItem' }], default: [] })
  itemIds!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  acceptedBy!: Types.ObjectId | null;

  @Prop({ type: Date })
  acceptedAt?: Date;

  @Prop({ type: Date })
  readyAt?: Date;

  @Prop({ type: Date })
  servedAt?: Date;
}

export const KitchenOrderSchema = SchemaFactory.createForClass(KitchenOrder);
KitchenOrderSchema.index({ restaurantId: 1, status: 1, productionCenter: 1 });
