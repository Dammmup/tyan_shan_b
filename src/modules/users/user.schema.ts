import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserStatus } from '../../common/enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ select: false })
  pinHash?: string;

  /** Plain PIN for owner/admin display (login still uses pinHash). */
  @Prop({ select: false })
  pinCode?: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true })
  roleId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', default: null, index: true })
  restaurantId!: Types.ObjectId | null;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Prop({ type: [String], default: [] })
  refreshTokens!: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });
