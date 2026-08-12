import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  ProductionCenter,
} from '../../common/enums';

export type OrderDocument = HydratedDocument<Order>;
export type OrderItemDocument = HydratedDocument<OrderItem>;
export type SubOrderDocument = HydratedDocument<SubOrder>;

@Schema({ _id: false })
export class OrderItemModifierSnapshot {
  @Prop({ type: Types.ObjectId })
  modifierId!: Types.ObjectId;

  @Prop({ required: true })
  nameSnapshot!: string;

  @Prop({ required: true, min: 0 })
  priceSnapshot!: number;
}

export const OrderItemModifierSnapshotSchema = SchemaFactory.createForClass(
  OrderItemModifierSnapshot,
);

@Schema({ timestamps: true, collection: 'order_items' })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubOrder', default: null })
  subOrderId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  nameSnapshot!: string;

  /** Unit price in tiyns (product + modifiers), server-calculated. */
  @Prop({ required: true, min: 0 })
  priceSnapshot!: number;

  @Prop({ required: true, min: 1, default: 1 })
  quantity!: number;

  /** Line total in tiyns. */
  @Prop({ required: true, min: 0 })
  lineTotalTiyns!: number;

  @Prop({ type: [OrderItemModifierSnapshotSchema], default: [] })
  modifiers!: OrderItemModifierSnapshot[];

  @Prop({ type: String, enum: ProductionCenter, required: true })
  productionCenter!: ProductionCenter;

  @Prop({ type: String, enum: OrderItemStatus, default: OrderItemStatus.NEW })
  status!: OrderItemStatus;

  @Prop()
  note?: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true, collection: 'sub_orders' })
export class SubOrder {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: String, enum: ProductionCenter, required: true })
  productionCenter!: ProductionCenter;

  @Prop({ type: Number, required: true })
  sequence!: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'OrderItem' }], default: [] })
  itemIds!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export const SubOrderSchema = SchemaFactory.createForClass(SubOrder);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Hall', required: true })
  hallId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Table', required: true, index: true })
  tableId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  waiterId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Shift', default: null })
  shiftId!: Types.ObjectId | null;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.OPEN, index: true })
  status!: OrderStatus;

  /** Subtotal before discount, tiyns. */
  @Prop({ required: true, default: 0, min: 0 })
  subtotalTiyns!: number;

  /** Discount amount in tiyns. */
  @Prop({ required: true, default: 0, min: 0 })
  discountTiyns!: number;

  /** Service charge (обслуживание), tiyns. */
  @Prop({ required: true, default: 0, min: 0 })
  serviceChargeTiyns!: number;

  /** Grand total in tiyns (subtotal - discount + service). */
  @Prop({ required: true, default: 0, min: 0 })
  totalTiyns!: number;

  @Prop({ type: Types.ObjectId, ref: 'Discount', default: null })
  discountId!: Types.ObjectId | null;

  /** Guest deposit / prepayment in tiyns (applied before final payment). */
  @Prop({ default: 0, min: 0 })
  prepaidTiyns!: number;

  @Prop({ type: String, enum: [PaymentMethod.CASH, PaymentMethod.CARD], default: null })
  prepaidMethod!: PaymentMethod.CASH | PaymentMethod.CARD | null;

  @Prop()
  prepaidNote?: string;

  @Prop({ type: Date, default: null })
  prepaidAt!: Date | null;

  @Prop({ default: 0 })
  guests!: number;

  @Prop()
  note?: string;

  @Prop({ default: 0 })
  subOrderSeq!: number;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
