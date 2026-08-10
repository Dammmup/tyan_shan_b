import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', default: null, index: true })
  restaurantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, index: true })
  action!: string;

  @Prop({ trim: true })
  entityType?: string;

  @Prop({ trim: true })
  entityId?: string;

  @Prop({ type: Object, default: {} })
  meta!: Record<string, unknown>;

  @Prop()
  ip?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ restaurantId: 1, createdAt: -1 });
