import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async log(params: {
    organizationId: string | Types.ObjectId;
    restaurantId?: string | Types.ObjectId | null;
    userId?: string | Types.ObjectId | null;
    action: string;
    entityType?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
    ip?: string;
  }): Promise<void> {
    await this.auditModel.create({
      organizationId: new Types.ObjectId(String(params.organizationId)),
      restaurantId: params.restaurantId
        ? new Types.ObjectId(String(params.restaurantId))
        : null,
      userId: params.userId ? new Types.ObjectId(String(params.userId)) : null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      meta: params.meta ?? {},
      ip: params.ip,
    });
  }

  async list(filter: {
    organizationId: string;
    restaurantId?: string;
    limit?: number;
    skip?: number;
  }) {
    const q: Record<string, unknown> = {
      organizationId: new Types.ObjectId(filter.organizationId),
    };
    if (filter.restaurantId) {
      q.restaurantId = new Types.ObjectId(filter.restaurantId);
    }
    return this.auditModel
      .find(q)
      .sort({ createdAt: -1 })
      .skip(filter.skip ?? 0)
      .limit(Math.min(filter.limit ?? 50, 200))
      .lean()
      .exec();
  }
}
