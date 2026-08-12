import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  KitchenStatus,
  OrderItemStatus,
  OrderStatus,
  PrintJobStatus,
  ProductAvailability,
  ProductionCenter,
  ShiftStatus,
  TableStatus,
} from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { PricingService } from '../pricing/pricing.service';
import { Table, TableDocument } from '../halls/hall-table.schema';
import { Product, ProductDocument } from '../menu/menu.schemas';
import { KitchenOrder, KitchenOrderDocument } from '../kitchen/kitchen-order.schema';
import {
  Printer,
  PrinterDocument,
  PrintJob,
  PrintJobDocument,
} from '../printers/printer.schemas';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { Shift, ShiftDocument } from '../shifts/shift.schemas';
import { User, UserDocument } from '../users/user.schema';
import {
  Order,
  OrderDocument,
  OrderItem,
  OrderItemDocument,
  SubOrder,
  SubOrderDocument,
} from './order.schemas';
import {
  AddOrderItemDto,
  CreateOrderDto,
  CreateSubOrderDto,
} from './orders.dto';

const CENTER_LABEL_RU: Record<string, string> = {
  [ProductionCenter.KITCHEN]: 'Кухня',
  [ProductionCenter.BAR]: 'Бар',
};

function cafeTitle(restaurantName?: string | null): string {
  const n = (restaurantName || '').trim();
  if (!n || /^главн/i.test(n)) return 'Кафе «Тянь-Шань»';
  return `Кафе «${n}»`;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(OrderItem.name)
    private readonly itemModel: Model<OrderItemDocument>,
    @InjectModel(SubOrder.name)
    private readonly subOrderModel: Model<SubOrderDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(KitchenOrder.name)
    private readonly kitchenModel: Model<KitchenOrderDocument>,
    @InjectModel(PrintJob.name)
    private readonly printJobModel: Model<PrintJobDocument>,
    @InjectModel(Printer.name)
    private readonly printerModel: Model<PrinterDocument>,
    @InjectModel(Shift.name) private readonly shiftModel: Model<ShiftDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly pricing: PricingService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  private async recalcOrder(orderId: Types.ObjectId) {
    const items = await this.itemModel.find({ orderId }).exec();
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) return null;
    const totals = this.pricing.computeOrderTotals(items, order.discountTiyns);
    order.subtotalTiyns = totals.subtotalTiyns;
    order.discountTiyns = totals.discountTiyns;
    order.totalTiyns = totals.totalTiyns;
    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.CANCELLED
    ) {
      const active = items.filter((i) => i.status !== OrderItemStatus.CANCELLED);
      if (active.some((i) => i.status === OrderItemStatus.SENT || i.status === OrderItemStatus.COOKING)) {
        order.status = OrderStatus.IN_PROGRESS;
      } else if (active.length && active.every((i) => i.status === OrderItemStatus.READY)) {
        order.status = OrderStatus.READY;
      } else if (active.length && active.every((i) => i.status === OrderItemStatus.SERVED)) {
        order.status = OrderStatus.SERVED;
      } else if (active.some((i) => i.status === OrderItemStatus.NEW)) {
        order.status = OrderStatus.OPEN;
      }
    }
    await order.save();
    return order;
  }

  async create(user: JwtPayload, dto: CreateOrderDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    const table = await this.tableModel
      .findOne({ _id: toObjectId(dto.tableId), ...tenant, isActive: true })
      .exec();
    if (!table) throw new NotFoundException('Table not found');

    const openShift = await this.shiftModel
      .findOne({ ...tenant, status: ShiftStatus.OPEN })
      .exec();

    const session = await this.connection.startSession();
    let order: OrderDocument | null = null;
    try {
      session.startTransaction();
      const created = await this.orderModel.create(
        [
          {
            ...tenant,
            hallId: table.hallId,
            tableId: table._id,
            waiterId: toObjectId(user.userId),
            shiftId: openShift?._id ?? null,
            status: OrderStatus.OPEN,
            subtotalTiyns: 0,
            discountTiyns: 0,
            totalTiyns: 0,
            guests: dto.guests ?? 1,
            note: dto.note,
            subOrderSeq: 0,
          },
        ],
        { session },
      );
      order = created[0];
      table.status = TableStatus.OCCUPIED;
      table.currentOrderId = order._id as Types.ObjectId;
      await table.save({ session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction().catch(() => undefined);
      // Fallback without replica set
      if (!order) {
        order = await this.orderModel.create({
          ...tenant,
          hallId: table.hallId,
          tableId: table._id,
          waiterId: toObjectId(user.userId),
          shiftId: openShift?._id ?? null,
          status: OrderStatus.OPEN,
          subtotalTiyns: 0,
          discountTiyns: 0,
          totalTiyns: 0,
          guests: dto.guests ?? 1,
          note: dto.note,
          subOrderSeq: 0,
        });
        table.status = TableStatus.OCCUPIED;
        table.currentOrderId = order._id as Types.ObjectId;
        await table.save();
      }
    } finally {
      session.endSession();
    }

    if (dto.items?.length) {
      for (const item of dto.items) {
        await this.addItem(user, String(order!._id), item);
      }
    }

    const full = await this.getById(user, String(order!._id));
    this.events.emitToRestaurant(String(tenant.restaurantId), 'ORDER_CREATED', full);
    this.events.emitToRestaurant(String(tenant.restaurantId), 'TABLE_UPDATED', {
      tableId: String(table._id),
      status: TableStatus.OCCUPIED,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.userId,
      action: 'ORDER_CREATE',
      entityType: 'Order',
      entityId: String(order!._id),
    });
    return full;
  }

  async addItem(user: JwtPayload, orderId: string, dto: AddOrderItemDto) {
    const order = await this.orderModel
      .findOne({
        _id: toObjectId(orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is closed');
    }

    const product = await this.productModel.findById(dto.productId).exec();
    if (!product || product.availability === ProductAvailability.STOPPED) {
      throw new BadRequestException('Product unavailable');
    }

    const line = await this.pricing.computeItemLine({
      productId: dto.productId,
      quantity: dto.quantity,
      modifierIds: dto.modifierIds,
      restaurantId: String(order.restaurantId),
      hallId: String(order.hallId),
      note: dto.note,
    });

    const item = await this.itemModel.create({
      orderId: order._id,
      subOrderId: null,
      productId: line.productId,
      nameSnapshot: line.nameSnapshot,
      priceSnapshot: line.priceSnapshot,
      quantity: line.quantity,
      lineTotalTiyns: line.lineTotalTiyns,
      modifiers: line.modifiers,
      productionCenter: line.productionCenter as ProductionCenter,
      status: OrderItemStatus.NEW,
      note: dto.note,
      organizationId: order.organizationId,
      restaurantId: order.restaurantId,
    });

    const updated = await this.recalcOrder(order._id as Types.ObjectId);
    this.events.emitToRestaurant(String(order.restaurantId), 'ORDER_ITEM_ADDED', {
      orderId,
      item,
      order: updated,
    });
    return item;
  }

  async cancelItem(user: JwtPayload, orderId: string, itemId: string) {
    const item = await this.itemModel
      .findOne({
        _id: toObjectId(itemId),
        orderId: toObjectId(orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === OrderItemStatus.SERVED) {
      throw new BadRequestException('Cannot cancel served item');
    }
    item.status = OrderItemStatus.CANCELLED;
    await item.save();
    const order = await this.recalcOrder(item.orderId as Types.ObjectId);
    this.events.emitToRestaurant(String(item.restaurantId), 'ORDER_ITEM_CANCELLED', {
      orderId,
      itemId,
      order,
    });
    return item;
  }

  async createSubOrder(user: JwtPayload, orderId: string, dto: CreateSubOrderDto) {
    const order = await this.orderModel
      .findOne({
        _id: toObjectId(orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is closed');
    }

    const q: Record<string, unknown> = {
      orderId: order._id,
      status: OrderItemStatus.NEW,
    };
    if (dto.itemIds?.length) {
      q._id = { $in: dto.itemIds.map((id) => toObjectId(id)) };
    }
    const items = await this.itemModel.find(q).exec();
    if (!items.length) {
      throw new BadRequestException('No NEW items to send');
    }

    const [table, waiter, restaurant] = await Promise.all([
      this.tableModel.findById(order.tableId).select('name').exec(),
      this.userModel.findById(order.waiterId).select('name').exec(),
      this.restaurantModel.findById(order.restaurantId).select('name').exec(),
    ]);
    const cafeName = cafeTitle(restaurant?.name);
    const waiterName = waiter?.name || user.name || '—';
    const tableName = table?.name || String(order.tableId).slice(-4);
    const orderNumber = String(order._id).slice(-6).toUpperCase();

    const byCenter = new Map<ProductionCenter, OrderItemDocument[]>();
    for (const item of items) {
      const list = byCenter.get(item.productionCenter) ?? [];
      list.push(item);
      byCenter.set(item.productionCenter, list);
    }

    const results: unknown[] = [];
    for (const [center, centerItems] of byCenter) {
      order.subOrderSeq += 1;
      const sub = await this.subOrderModel.create({
        orderId: order._id,
        productionCenter: center,
        sequence: order.subOrderSeq,
        itemIds: centerItems.map((i) => i._id),
        organizationId: order.organizationId,
        restaurantId: order.restaurantId,
        createdBy: toObjectId(user.userId),
      });

      for (const item of centerItems) {
        item.status = OrderItemStatus.SENT;
        item.subOrderId = sub._id as Types.ObjectId;
        await item.save();
      }

      const kitchen = await this.kitchenModel.create({
        orderId: order._id,
        subOrderId: sub._id,
        organizationId: order.organizationId,
        restaurantId: order.restaurantId,
        tableId: order.tableId,
        productionCenter: center,
        status: KitchenStatus.NEW,
        itemIds: centerItems.map((i) => i._id),
      });

      const printer = await this.printerModel
        .findOne({
          restaurantId: order.restaurantId,
          productionCenter: center,
          isActive: true,
        })
        .exec();

      const centerLabel = CENTER_LABEL_RU[center] || center;
      const idempotencyKey = `suborder:${String(sub._id)}:${center}`;
      const itemLines = centerItems.map((i) => {
        const mods = (i.modifiers || [])
          .map((m) => m.nameSnapshot)
          .filter(Boolean)
          .join(', ');
        const note = i.note ? ` — ${i.note}` : '';
        return `${i.quantity}× ${i.nameSnapshot}${mods ? ` (${mods})` : ''}${note}`;
      });
      const payload = {
        orderId: String(order._id),
        subOrderId: String(sub._id),
        kitchenOrderId: String(kitchen._id),
        tableId: String(order.tableId),
        tableName,
        cafeName,
        waiterName,
        productionCenter: center,
        centerLabel,
        subOrderSeq: order.subOrderSeq,
        items: centerItems.map((i) => ({
          name: i.nameSnapshot,
          qty: i.quantity,
          note: i.note,
          modifiers: i.modifiers,
        })),
        lines: itemLines,
      };

      let printJob = await this.printJobModel.findOne({ idempotencyKey }).exec();
      if (!printJob) {
        printJob = await this.printJobModel.create({
          organizationId: order.organizationId,
          restaurantId: order.restaurantId,
          printerId: printer?._id ?? null,
          orderId: order._id,
          kitchenOrderId: kitchen._id,
          productionCenter: center,
          status: PrintJobStatus.PENDING,
          idempotencyKey,
          payload,
          attempts: 0,
        });
      }

      const agentPayload = {
        jobId: String(printJob._id),
        printer: {
          ip: printer?.ip || '127.0.0.1',
          port: printer?.port || 9100,
          name: printer?.name || centerLabel,
        },
        cafeName,
        waiterName,
        centerLabel,
        subOrderSeq: order.subOrderSeq,
        lines: itemLines,
        orderNumber,
        tableName,
      };

      const rid = String(order.restaurantId);
      this.events.emitToKitchen(rid, 'KITCHEN_ORDER_CREATED', {
        kitchen,
        items: centerItems,
      });
      this.events.emitToAgent(rid, 'PRINT_JOB', agentPayload);
      this.events.emitToRestaurant(rid, 'ORDER_SUBORDER_CREATED', {
        orderId,
        subOrder: sub,
        kitchenOrderId: kitchen._id,
      });

      results.push({ subOrder: sub, kitchen, printJob });
    }

    await order.save();
    const updated = await this.recalcOrder(order._id as Types.ObjectId);
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: order.restaurantId,
      userId: user.userId,
      action: 'ORDER_SUBORDER',
      entityType: 'Order',
      entityId: orderId,
    });
    return { order: updated, batches: results };
  }

  async list(user: JwtPayload, restaurantId?: string, status?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const q: Record<string, unknown> = { ...tenant };
    if (status) {
      const parts = status.split(',').map((s) => s.trim()).filter(Boolean);
      q.status = parts.length > 1 ? { $in: parts } : parts[0];
    }
    return this.orderModel.find(q).sort({ createdAt: -1 }).limit(100).exec();
  }

  async getById(user: JwtPayload, id: string) {
    const order = await this.orderModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    const items = await this.itemModel.find({ orderId: order._id }).exec();
    const subOrders = await this.subOrderModel.find({ orderId: order._id }).exec();
    return { order, items, subOrders };
  }
}
