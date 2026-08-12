import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  KitchenStatus,
  OrderItemStatus,
} from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { EventsGateway } from '../events/events.gateway';
import { Table, TableDocument } from '../halls/hall-table.schema';
import { OrderItem, OrderItemDocument } from '../orders/order.schemas';
import { KitchenOrder, KitchenOrderDocument } from './kitchen-order.schema';

@Injectable()
export class KitchenService {
  constructor(
    @InjectModel(KitchenOrder.name)
    private readonly kitchenModel: Model<KitchenOrderDocument>,
    @InjectModel(OrderItem.name)
    private readonly itemModel: Model<OrderItemDocument>,
    @InjectModel(Table.name)
    private readonly tableModel: Model<TableDocument>,
    private readonly events: EventsGateway,
  ) {}

  async list(user: JwtPayload, status?: KitchenStatus, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const q: Record<string, unknown> = { ...tenant };
    if (status) q.status = status;
    const rows = await this.kitchenModel.find(q).sort({ createdAt: 1 }).limit(200).exec();
    const tableIds = [...new Set(rows.map((r) => String(r.tableId)))];
    const tables = await this.tableModel
      .find({ _id: { $in: tableIds.map((id) => toObjectId(id)) } })
      .select('name')
      .exec();
    const tableNameById = new Map(tables.map((t) => [String(t._id), t.name]));
    const result = [];
    for (const row of rows) {
      const items = await this.itemModel.find({ _id: { $in: row.itemIds } }).exec();
      const obj = row.toObject() as Record<string, unknown>;
      result.push({
        ...obj,
        _id: String(row._id),
        orderId: String(row.orderId),
        orderNumber: String(row.orderId).slice(-4).toUpperCase(),
        tableName: tableNameById.get(String(row.tableId)) || undefined,
        createdAt: (obj as { createdAt?: Date }).createdAt,
        items: items.map((i) => ({
          name: i.nameSnapshot,
          quantity: i.quantity,
          note: i.note,
          modifiers: i.modifiers,
        })),
      });
    }
    return result;
  }

  private async setStatus(
    user: JwtPayload,
    id: string,
    next: KitchenStatus,
    itemStatus: OrderItemStatus,
  ) {
    const doc = await this.kitchenModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Kitchen order not found');

    const allowed: Record<KitchenStatus, KitchenStatus[]> = {
      [KitchenStatus.NEW]: [KitchenStatus.ACCEPTED, KitchenStatus.CANCELLED],
      [KitchenStatus.ACCEPTED]: [KitchenStatus.COOKING, KitchenStatus.CANCELLED],
      [KitchenStatus.COOKING]: [KitchenStatus.READY, KitchenStatus.CANCELLED],
      [KitchenStatus.READY]: [KitchenStatus.SERVED],
      [KitchenStatus.SERVED]: [],
      [KitchenStatus.CANCELLED]: [],
    };
    if (!allowed[doc.status].includes(next)) {
      throw new BadRequestException(`Cannot transition ${doc.status} -> ${next}`);
    }

    doc.status = next;
    if (next === KitchenStatus.ACCEPTED) {
      doc.acceptedBy = toObjectId(user.userId);
      doc.acceptedAt = new Date();
    }
    if (next === KitchenStatus.READY) doc.readyAt = new Date();
    if (next === KitchenStatus.SERVED) doc.servedAt = new Date();
    await doc.save();

    await this.itemModel.updateMany(
      { _id: { $in: doc.itemIds }, status: { $ne: OrderItemStatus.CANCELLED } },
      { $set: { status: itemStatus } },
    );

    const rid = String(doc.restaurantId);
    this.events.emitToKitchen(rid, 'KITCHEN_STATUS_CHANGED', doc);
    this.events.emitToRestaurant(rid, 'KITCHEN_STATUS_CHANGED', doc);
    return doc;
  }

  accept(user: JwtPayload, id: string) {
    return this.setStatus(user, id, KitchenStatus.ACCEPTED, OrderItemStatus.COOKING);
  }

  cooking(user: JwtPayload, id: string) {
    return this.setStatus(user, id, KitchenStatus.COOKING, OrderItemStatus.COOKING);
  }

  ready(user: JwtPayload, id: string) {
    return this.setStatus(user, id, KitchenStatus.READY, OrderItemStatus.READY);
  }

  served(user: JwtPayload, id: string) {
    return this.setStatus(user, id, KitchenStatus.SERVED, OrderItemStatus.SERVED);
  }
}
