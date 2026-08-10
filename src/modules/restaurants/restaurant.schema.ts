import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RestaurantDocument = HydratedDocument<Restaurant>;

@Schema({ timestamps: true, collection: 'restaurants' })
export class Restaurant {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  address?: string;

  @Prop({ default: 'Asia/Almaty' })
  timezone!: string;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
RestaurantSchema.index({ organizationId: 1, name: 1 });
