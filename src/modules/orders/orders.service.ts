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
  PaymentMethod,
  PrintJobStatus,
  ProductAvailability,
  ProductionCenter,
  CashOpType,
  ShiftStatus,
  TableStatus,
} from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { tiynsToTengeDisplay } from '../../common/utils/money';
import { canManageSentItems } from '../../common/role-permissions';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { PricingService, SERVICE_CHARGE_PERCENT } from '../pricing/pricing.service';
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
import {
  CashOperation,
  CashOperationDocument,
  Shift,
  ShiftDocument,
} from '../shifts/shift.schemas';
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
  SetPrepaidDto,
  TransferOrderDto,
} from './orders.dto';
const CENTER_LABEL_RU: Record<string, string> = {
  [ProductionCenter.COLD]: 'Холодный цех',
  [ProductionCenter.KITCHEN]: 'Китайский / горячий цех',
  [ProductionCenter.BAR]: 'Бар',
  [ProductionCenter.GRILL]: 'Мангал',
  [ProductionCenter.DESSERT]: 'Десерты',
  [ProductionCenter.OTHER]: 'Предчек',
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
    @InjectModel(CashOperation.name)
    private readonly cashModel: Model<CashOperationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly pricing: PricingService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  private async servicePercentFor(restaurantId: Types.ObjectId | string) {
    const restaurant = await this.restaurantModel
      .findById(restaurantId)
      .select('serviceChargePercent')
      .exec();
    const pct = restaurant?.serviceChargePercent;
    return typeof pct === 'number' && pct >= 0 ? pct : SERVICE_CHARGE_PERCENT;
  }

  private async recalcOrder(orderId: Types.ObjectId) {
    const items = await this.itemModel.find({ orderId }).exec();
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) return null;
    const servicePercent = await this.servicePercentFor(order.restaurantId);
    const totals = this.pricing.computeOrderTotals(items, order.discountTiyns, servicePercent);
    order.subtotalTiyns = totals.subtotalTiyns;
    order.discountTiyns = totals.discountTiyns;
    order.serviceChargeTiyns = totals.serviceChargeTiyns;
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
            serviceChargeTiyns: 0,
            totalTiyns: 0,
            prepaidTiyns: 0,
            prepaidMethod: null,
            prepaidAt: null,
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
          serviceChargeTiyns: 0,
          totalTiyns: 0,
          prepaidTiyns: 0,
          prepaidMethod: null,
          prepaidAt: null,
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
    // Regular waiter: only unsent (NEW) items; after punch — transfer only
    if (item.status !== OrderItemStatus.NEW && !canManageSentItems(user.role)) {
      throw new BadRequestException(
        'После пробития блюдо нельзя удалить — перенесите на свободный стол или обратитесь к старшему/админу',
      );
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

  async cancelOrder(user: JwtPayload, orderId: string) {
    const order = await this.orderModel
      .findOne({
        _id: toObjectId(orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Cannot cancel paid order');
    }
    if (order.status === OrderStatus.CANCELLED) {
      return this.getById(user, orderId);
    }

    const items = await this.itemModel.find({ orderId: order._id }).exec();
    const hasServed = items.some((i) => i.status === OrderItemStatus.SERVED);
    if (hasServed) {
      throw new BadRequestException('Cannot cancel order with served items');
    }
    if (
      user.role === 'WAITER' &&
      items.some(
        (i) =>
          i.status !== OrderItemStatus.NEW &&
          i.status !== OrderItemStatus.CANCELLED,
      )
    ) {
      throw new BadRequestException(
        'После пробития заказ нельзя отменить — перенесите блюда или обратитесь к старшему/админу',
      );
    }

    await this.itemModel.updateMany(
      {
        orderId: order._id,
        status: { $ne: OrderItemStatus.CANCELLED },
      },
      { $set: { status: OrderItemStatus.CANCELLED } },
    );

    await this.kitchenModel.updateMany(
      {
        orderId: order._id,
        status: {
          $nin: [KitchenStatus.SERVED, KitchenStatus.CANCELLED],
        },
      },
      { $set: { status: KitchenStatus.CANCELLED } },
    );

    order.status = OrderStatus.CANCELLED;
    order.discountTiyns = 0;
    order.serviceChargeTiyns = 0;
    order.subtotalTiyns = 0;
    order.totalTiyns = 0;
    await order.save();

    const table = await this.tableModel.findById(order.tableId).exec();
    if (table && String(table.currentOrderId) === String(order._id)) {
      table.status = TableStatus.FREE;
      table.currentOrderId = null;
      await table.save();
      this.events.emitToRestaurant(String(order.restaurantId), 'TABLE_UPDATED', {
        _id: table._id,
        status: TableStatus.FREE,
        currentOrderId: null,
      });
    }

    this.events.emitToRestaurant(String(order.restaurantId), 'ORDER_CANCELLED', {
      orderId,
      order,
    });
    this.events.emitToRestaurant(String(order.restaurantId), 'KITCHEN_UPDATED', {
      orderId,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: order.restaurantId,
      userId: user.userId,
      action: 'ORDER_CANCEL',
      entityType: 'Order',
      entityId: orderId,
    });

    return this.getById(user, orderId);
  }

  async setPrepaid(user: JwtPayload, orderId: string, dto: SetPrepaidDto) {
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

    const next = Math.trunc(dto.amountTiyns);
    if (next > 0 && next > order.totalTiyns && order.totalTiyns > 0) {
      // Allow prepaid above current total (guest may order more later), but cap soft warning — no hard fail
    }
    const method =
      next <= 0
        ? null
        : dto.method === PaymentMethod.CARD
          ? PaymentMethod.CARD
          : PaymentMethod.CASH;

    const prev = Math.trunc(order.prepaidTiyns || 0);
    const prevMethod = order.prepaidMethod;

    const shift = await this.shiftModel
      .findOne({
        restaurantId: order.restaurantId,
        status: ShiftStatus.OPEN,
      })
      .exec();

    // Adjust cash drawer for cash prepaid changes
    if (shift) {
      if (prev > 0 && prevMethod === PaymentMethod.CASH) {
        await this.cashModel.create({
          shiftId: shift._id,
          organizationId: order.organizationId,
          restaurantId: order.restaurantId,
          type: CashOpType.CASH_OUT,
          amountTiyns: prev,
          reason: `Сторно предоплаты заказ ${String(order._id).slice(-6)}`,
          createdBy: toObjectId(user.userId),
        });
      }
      if (next > 0 && method === PaymentMethod.CASH) {
        await this.cashModel.create({
          shiftId: shift._id,
          organizationId: order.organizationId,
          restaurantId: order.restaurantId,
          type: CashOpType.CASH_IN,
          amountTiyns: next,
          reason: `Предоплата заказ ${String(order._id).slice(-6)}`,
          createdBy: toObjectId(user.userId),
        });
      }
    }

    order.prepaidTiyns = next;
    order.prepaidMethod = method;
    order.prepaidNote = next > 0 ? dto.note : undefined;
    order.prepaidAt = next > 0 ? new Date() : null;
    await order.save();

    this.events.emitToRestaurant(String(order.restaurantId), 'ORDER_PREPAID', {
      orderId,
      prepaidTiyns: next,
      prepaidMethod: method,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: order.restaurantId,
      userId: user.userId,
      action: 'ORDER_PREPAID',
      entityType: 'Order',
      entityId: orderId,
      meta: { prepaidTiyns: next, prepaidMethod: method, note: dto.note },
    });

    return this.getById(user, orderId);
  }

  /**
   * Move dishes to another table (new or existing open order).
   * Updates kitchen tickets' table/order when items were already sent.
   */
  async transferToTable(user: JwtPayload, orderId: string, dto: TransferOrderDto) {
    const source = await this.orderModel
      .findOne({
        _id: toObjectId(orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!source) throw new NotFoundException('Order not found');
    if (source.status === OrderStatus.PAID || source.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is closed');
    }

    const targetTable = await this.tableModel
      .findOne({
        _id: toObjectId(dto.targetTableId),
        organizationId: toObjectId(user.organizationId),
        restaurantId: source.restaurantId,
        isActive: true,
      })
      .exec();
    if (!targetTable) throw new NotFoundException('Target table not found');
    if (String(targetTable._id) === String(source.tableId)) {
      throw new BadRequestException('Same table');
    }

    // Regular waiter may only move dishes to a free table
    if (user.role === 'WAITER' && targetTable.status !== TableStatus.FREE) {
      throw new BadRequestException(
        'Обычный официант может переносить блюда только на свободный стол',
      );
    }

    const transferableStatuses = new Set([
      OrderItemStatus.NEW,
      OrderItemStatus.SENT,
      OrderItemStatus.COOKING,
      OrderItemStatus.READY,
    ]);

    const itemQuery: Record<string, unknown> = {
      orderId: source._id,
      status: { $in: [...transferableStatuses] },
    };
    if (dto.itemIds?.length) {
      itemQuery._id = { $in: dto.itemIds.map((id) => toObjectId(id)) };
    }
    const items = await this.itemModel.find(itemQuery).exec();
    if (!items.length) {
      throw new BadRequestException('No items to transfer');
    }
    if (dto.itemIds?.length && items.length !== dto.itemIds.length) {
      throw new BadRequestException('Some items cannot be transferred');
    }

    let target = await this.orderModel
      .findOne({
        tableId: targetTable._id,
        restaurantId: source.restaurantId,
        status: {
          $in: [
            OrderStatus.OPEN,
            OrderStatus.IN_PROGRESS,
            OrderStatus.READY,
            OrderStatus.SERVED,
          ],
        },
      })
      .exec();

    if (!target) {
      const openShift = await this.shiftModel
        .findOne({
          restaurantId: source.restaurantId,
          status: ShiftStatus.OPEN,
        })
        .exec();
      target = await this.orderModel.create({
        organizationId: source.organizationId,
        restaurantId: source.restaurantId,
        hallId: targetTable.hallId,
        tableId: targetTable._id,
        waiterId: toObjectId(user.userId),
        shiftId: openShift?._id ?? source.shiftId,
        status: OrderStatus.OPEN,
        subtotalTiyns: 0,
        discountTiyns: 0,
        serviceChargeTiyns: 0,
        totalTiyns: 0,
        prepaidTiyns: 0,
        prepaidMethod: null,
        prepaidAt: null,
        guests: source.guests || 0,
        subOrderSeq: 0,
      });
      targetTable.status = TableStatus.OCCUPIED;
      targetTable.currentOrderId = target._id as Types.ObjectId;
      await targetTable.save();
    }

    const movedIds = items.map((i) => i._id as Types.ObjectId);
    const movedIdSet = new Set(movedIds.map((id) => String(id)));

    for (const item of items) {
      item.orderId = target._id as Types.ObjectId;
      await item.save();
    }

    // Kitchen tickets that reference moved items
    const kitchenTickets = await this.kitchenModel
      .find({
        orderId: source._id,
        status: { $nin: [KitchenStatus.SERVED, KitchenStatus.CANCELLED] },
        itemIds: { $in: movedIds },
      })
      .exec();

    for (const ko of kitchenTickets) {
      const stay = (ko.itemIds || []).filter((id) => !movedIdSet.has(String(id)));
      const moved = (ko.itemIds || []).filter((id) => movedIdSet.has(String(id)));
      if (!moved.length) continue;

      if (!stay.length) {
        ko.orderId = target._id as Types.ObjectId;
        ko.tableId = targetTable._id as Types.ObjectId;
        await ko.save();
      } else {
        ko.itemIds = stay;
        await ko.save();
        await this.kitchenModel.create({
          orderId: target._id,
          subOrderId: ko.subOrderId,
          organizationId: ko.organizationId,
          restaurantId: ko.restaurantId,
          tableId: targetTable._id,
          productionCenter: ko.productionCenter,
          status: ko.status,
          itemIds: moved,
          acceptedBy: ko.acceptedBy,
          acceptedAt: ko.acceptedAt,
          readyAt: ko.readyAt,
          servedAt: ko.servedAt,
        });
      }
    }

    await this.recalcOrder(source._id as Types.ObjectId);
    await this.recalcOrder(target._id as Types.ObjectId);

    const sourceLeft = await this.itemModel
      .find({
        orderId: source._id,
        status: { $ne: OrderItemStatus.CANCELLED },
      })
      .exec();
    const sourceActive = sourceLeft.filter((i) => i.status !== OrderItemStatus.SERVED);

    if (!sourceLeft.length || !sourceActive.length) {
      // No remaining billable/active items — close source and free table
      if (!sourceLeft.length) {
        source.status = OrderStatus.CANCELLED;
        source.subtotalTiyns = 0;
        source.discountTiyns = 0;
        source.serviceChargeTiyns = 0;
        source.totalTiyns = 0;
        await source.save();
      }
      const oldTable = await this.tableModel.findById(source.tableId).exec();
      if (oldTable && String(oldTable.currentOrderId) === String(source._id)) {
        // Only free if no served items left unpaid — if served remain, keep occupied
        if (!sourceLeft.some((i) => i.status === OrderItemStatus.SERVED)) {
          oldTable.status = TableStatus.FREE;
          oldTable.currentOrderId = null;
          await oldTable.save();
          this.events.emitToRestaurant(String(source.restaurantId), 'TABLE_UPDATED', {
            _id: oldTable._id,
            status: TableStatus.FREE,
            currentOrderId: null,
          });
        }
      }
    }

    this.events.emitToRestaurant(String(source.restaurantId), 'TABLE_UPDATED', {
      _id: targetTable._id,
      status: TableStatus.OCCUPIED,
      currentOrderId: target._id,
    });
    this.events.emitToRestaurant(String(source.restaurantId), 'ORDER_TRANSFERRED', {
      fromOrderId: orderId,
      toOrderId: String(target._id),
      itemIds: [...movedIdSet],
      targetTableId: String(targetTable._id),
    });
    this.events.emitToRestaurant(String(source.restaurantId), 'KITCHEN_UPDATED', {
      orderId: String(target._id),
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: source.restaurantId,
      userId: user.userId,
      action: 'ORDER_TRANSFER',
      entityType: 'Order',
      entityId: orderId,
      meta: {
        targetOrderId: String(target._id),
        targetTableId: String(targetTable._id),
        itemIds: [...movedIdSet],
      },
    });

    return {
      source: await this.getById(user, orderId),
      target: await this.getById(user, String(target._id)),
    };
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
        productionCenter: center,
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

  /** Print guest bill (предчек) to Windows/thermal agent. */
  async printPrecheck(user: JwtPayload, orderId: string) {
    const order = await this.orderModel
      .findOne({
        _id: toObjectId(orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order cancelled');
    }

    const items = await this.itemModel
      .find({
        orderId: order._id,
        status: { $ne: OrderItemStatus.CANCELLED },
      })
      .sort({ createdAt: 1 })
      .exec();
    if (!items.length) {
      throw new BadRequestException('No items to print');
    }

    const [table, waiter, restaurant] = await Promise.all([
      this.tableModel.findById(order.tableId).select('name').exec(),
      this.userModel.findById(order.waiterId).select('name').exec(),
      this.restaurantModel
        .findById(order.restaurantId)
        .select('name serviceChargePercent')
        .exec(),
    ]);
    const servicePercent =
      typeof restaurant?.serviceChargePercent === 'number' && restaurant.serviceChargePercent >= 0
        ? restaurant.serviceChargePercent
        : SERVICE_CHARGE_PERCENT;
    const totals = this.pricing.computeOrderTotals(items, order.discountTiyns, servicePercent);
    order.subtotalTiyns = totals.subtotalTiyns;
    order.discountTiyns = totals.discountTiyns;
    order.serviceChargeTiyns = totals.serviceChargeTiyns;
    order.totalTiyns = totals.totalTiyns;
    await order.save();

    const cafeName = cafeTitle(restaurant?.name);
    const waiterName = waiter?.name || user.name || '—';
    const tableName = table?.name || String(order.tableId).slice(-4);
    const orderNumber = String(order._id).slice(-6).toUpperCase();

    const money = (tiyns: number) => {
      const tenge = tiynsToTengeDisplay(tiyns);
      const [intPart, frac = '00'] = tenge.toFixed(2).split('.');
      const spaced = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return frac === '00' ? `${spaced} ₸` : `${spaced},${frac} ₸`;
    };

    const itemLines = items.map((i) => {
      const mods = (i.modifiers || [])
        .map((m) => m.nameSnapshot)
        .filter(Boolean)
        .join(', ');
      return `${i.quantity}× ${i.nameSnapshot}${mods ? ` (${mods})` : ''}  ${money(i.lineTotalTiyns)}`;
    });

    const billLines = [
      ...itemLines,
      '--------------------------------',
      `Сумма: ${money(totals.subtotalTiyns)}`,
      ...(totals.discountTiyns > 0 ? [`Скидка: −${money(totals.discountTiyns)}`] : []),
      `Обслуживание ${servicePercent}%: ${money(totals.serviceChargeTiyns)}`,
      `Итого: ${money(totals.totalTiyns)}`,
      ...((order.prepaidTiyns || 0) > 0
        ? [
            `Предоплата: −${money(order.prepaidTiyns)}`,
            `К оплате: ${money(Math.max(0, totals.totalTiyns - order.prepaidTiyns))}`,
          ]
        : []),
    ];

    const printer =
      (await this.printerModel
        .findOne({
          restaurantId: order.restaurantId,
          productionCenter: ProductionCenter.OTHER,
          isActive: true,
        })
        .exec()) ||
      (await this.printerModel
        .findOne({
          restaurantId: order.restaurantId,
          productionCenter: ProductionCenter.BAR,
          isActive: true,
        })
        .exec()) ||
      (await this.printerModel
        .findOne({ restaurantId: order.restaurantId, isActive: true })
        .exec());

    const idempotencyKey = `precheck:${String(order._id)}:${Date.now()}`;
    const printJob = await this.printJobModel.create({
      organizationId: order.organizationId,
      restaurantId: order.restaurantId,
      printerId: printer?._id ?? null,
      orderId: order._id,
      kitchenOrderId: null,
      productionCenter: printer?.productionCenter || ProductionCenter.OTHER,
      status: PrintJobStatus.PENDING,
      idempotencyKey,
      payload: {
        type: 'precheck',
        orderId: String(order._id),
        lines: billLines,
        totals,
      },
      attempts: 0,
    });

    const agentPayload = {
      jobId: String(printJob._id),
      ticketType: 'precheck' as const,
      productionCenter: ProductionCenter.OTHER,
      printer: {
        ip: printer?.ip || '127.0.0.1',
        port: printer?.port || 9100,
        name: printer?.name || 'Предчек',
      },
      cafeName,
      waiterName,
      centerLabel: 'Предчек',
      lines: billLines,
      orderNumber,
      tableName,
    };

    this.events.emitToAgent(String(order.restaurantId), 'PRINT_JOB', agentPayload);
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: order.restaurantId,
      userId: user.userId,
      action: 'ORDER_PRECHECK',
      entityType: 'Order',
      entityId: orderId,
    });

    return { ok: true, printJobId: String(printJob._id), order };
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
