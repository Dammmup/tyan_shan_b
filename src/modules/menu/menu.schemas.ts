import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProductAvailability, ProductionCenter, PRODUCTION_CENTER_VALUES } from '../../common/enums';

export type CategoryDocument = HydratedDocument<Category>;
export type ProductDocument = HydratedDocument<Product>;
export type PriceDocument = HydratedDocument<Price>;
export type ModifierGroupDocument = HydratedDocument<ModifierGroup>;
export type ModifierDocument = HydratedDocument<Modifier>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  /** Base price in tiyns (fallback if no Price row). */
  @Prop({ required: true, min: 0 })
  basePriceTiyns!: number;

  @Prop({ type: String, enum: PRODUCTION_CENTER_VALUES, default: ProductionCenter.KITCHEN })
  productionCenter!: ProductionCenter;

  @Prop({
    type: String,
    enum: ProductAvailability,
    default: ProductAvailability.AVAILABLE,
  })
  availability!: ProductAvailability;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'ModifierGroup' }], default: [] })
  modifierGroupIds!: Types.ObjectId[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  description?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

@Schema({ timestamps: true, collection: 'prices' })
export class Price {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  /** Optional hall-specific or channel price. */
  @Prop({ type: Types.ObjectId, ref: 'Hall', default: null })
  hallId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  channel!: string | null;

  /** Price in tiyns. */
  @Prop({ required: true, min: 0 })
  priceTiyns!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const PriceSchema = SchemaFactory.createForClass(Price);
PriceSchema.index({ productId: 1, hallId: 1, channel: 1 });

@Schema({ timestamps: true, collection: 'modifier_groups' })
export class ModifierGroup {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ default: false })
  required!: boolean;

  @Prop({ default: 1 })
  minSelect!: number;

  @Prop({ default: 1 })
  maxSelect!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ModifierGroupSchema = SchemaFactory.createForClass(ModifierGroup);

@Schema({ timestamps: true, collection: 'modifiers' })
export class Modifier {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'ModifierGroup', required: true, index: true })
  groupId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  /** Extra price in tiyns. */
  @Prop({ required: true, default: 0, min: 0 })
  priceTiyns!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ModifierSchema = SchemaFactory.createForClass(Modifier);
