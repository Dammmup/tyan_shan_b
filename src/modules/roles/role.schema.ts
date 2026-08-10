import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Permission } from '../../common/enums';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: [String], default: [], enum: Object.values(Permission) })
  permissions!: string[];

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ default: false })
  isSystem!: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
RoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });
