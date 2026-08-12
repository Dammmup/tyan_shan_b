import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, TableStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { resolveRestaurantId, tenantFilter, toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { Order, OrderDocument } from '../orders/order.schemas';
import { Hall, HallDocument, Table, TableDocument } from './hall-table.schema';
import {
  CreateHallDto,
  CreateTableDto,
  UpdateHallDto,
  UpdateTableDto,
} from './halls.dto';

@Injectable()
export class HallsService {
  constructor(
    @InjectModel(Hall.name) private readonly hallModel: Model<HallDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly audit: AuditService,
    private readonly events: EventsGateway,
  ) {}

  async createHall(user: JwtPayload, dto: CreateHallDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    const doc = await this.hallModel.create({
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
      ...tenant,
      isActive: true,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.userId,
      action: 'HALL_CREATE',
      entityType: 'Hall',
      entityId: String(doc._id),
    });
    return doc;
  }

  listHalls(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    return this.hallModel.find({ ...tenant, isActive: true }).sort({ sortOrder: 1 }).exec();
  }

  async updateHall(user: JwtPayload, id: string, dto: UpdateHallDto) {
    const doc = await this.hallModel
      .findOne({ _id: toObjectId(id), organizationId: toObjectId(user.organizationId) })
      .exec();
    if (!doc) throw new NotFoundException('Hall not found');
    if (dto.name) doc.name = dto.name;
    if (dto.sortOrder !== undefined) doc.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    return doc;
  }

  async createTable(user: JwtPayload, dto: CreateTableDto) {
    const hall = await this.hallModel.findById(dto.hallId).exec();
    if (!hall) throw new NotFoundException('Hall not found');
    const rid = resolveRestaurantId(user, dto.restaurantId ?? String(hall.restaurantId));
    if (String(hall.restaurantId) !== rid) {
      throw new NotFoundException('Hall not in restaurant');
    }
    const doc = await this.tableModel.create({
      name: dto.name,
      hallId: hall._id,
      organizationId: hall.organizationId,
      restaurantId: hall.restaurantId,
      positionX: dto.positionX ?? 0,
      positionY: dto.positionY ?? 0,
      width: dto.width ?? 80,
      height: dto.height ?? 80,
      seats: dto.seats ?? 4,
      status: TableStatus.FREE,
      isActive: true,
    });
    this.events.emitToRestaurant(rid, 'TABLE_CREATED', doc);
    return doc;
  }

  async listTables(user: JwtPayload, restaurantId?: string, hallId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const q: Record<string, unknown> = { ...tenant, isActive: true };
    if (hallId) q.hallId = toObjectId(hallId);
    const tables = await this.tableModel.find(q).sort({ name: 1 }).exec();

    const openOrders = await this.orderModel
      .find({
        ...tenant,
        status: {
          $in: [
            OrderStatus.OPEN,
            OrderStatus.IN_PROGRESS,
            OrderStatus.READY,
            OrderStatus.SERVED,
          ],
        },
      })
      .select('_id tableId')
      .lean()
      .exec();

    const orderByTable = new Map<string, string>();
    for (const o of openOrders) {
      orderByTable.set(String(o.tableId), String(o._id));
    }

    return tables.map((table) => {
      const plain = table.toObject();
      const openId = orderByTable.get(String(table._id));
      if (openId) {
        plain.currentOrderId = openId as unknown as typeof plain.currentOrderId;
        if (plain.status === TableStatus.FREE) {
          plain.status = TableStatus.OCCUPIED;
        }
      }
      return plain;
    });
  }

  async updateTable(user: JwtPayload, id: string, dto: UpdateTableDto) {
    const doc = await this.tableModel
      .findOne({ _id: toObjectId(id), organizationId: toObjectId(user.organizationId) })
      .exec();
    if (!doc) throw new NotFoundException('Table not found');
    if (dto.name) doc.name = dto.name;
    if (dto.positionX !== undefined) doc.positionX = dto.positionX;
    if (dto.positionY !== undefined) doc.positionY = dto.positionY;
    if (dto.width !== undefined) doc.width = dto.width;
    if (dto.height !== undefined) doc.height = dto.height;
    if (dto.seats !== undefined) doc.seats = dto.seats;
    if (dto.status) doc.status = dto.status;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    this.events.emitToRestaurant(String(doc.restaurantId), 'TABLE_UPDATED', doc);
    return doc;
  }
}
