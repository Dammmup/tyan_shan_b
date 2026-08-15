import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { Order, OrderDocument, OrderItem, OrderItemDocument } from '../orders/order.schemas';
import { Payment, PaymentDocument } from '../payments/payment.schemas';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { Shift, ShiftDocument } from '../shifts/shift.schemas';
import { Table, TableDocument } from '../halls/hall-table.schema';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(OrderItem.name) private readonly itemModel: Model<OrderItemDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Shift.name) private readonly shiftModel: Model<ShiftDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Local calendar day in restaurant timezone (default Asia/Almaty = UTC+5). */
  private async dayRange(restaurantId: unknown, dateStr?: string) {
    let tz = 'Asia/Almaty';
    if (restaurantId) {
      const r = await this.restaurantModel
        .findById(restaurantId)
        .select('timezone')
        .lean()
        .exec();
      if (r?.timezone) tz = r.timezone;
    }
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const day =
      dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : today;

    // Resolve offset for this timezone (KZ has no DST; still compute generally).
    const probe = new Date(`${day}T12:00:00.000Z`);
    const utcHour = probe.getUTCHours();
    const localHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
        hourCycle: 'h23',
      }).format(probe),
    );
    let offsetHours = localHour - utcHour;
    if (offsetHours > 14) offsetHours -= 24;
    if (offsetHours < -14) offsetHours += 24;

    const start = new Date(`${day}T00:00:00.000Z`);
    start.setUTCHours(start.getUTCHours() - offsetHours);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start, end, timezone: tz, day };
  }

  async dashboardToday(user: JwtPayload, restaurantId?: string, date?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = await this.dayRange(tenant.restaurantId, date);

    const paidToday = await this.orderModel
      .find({
        ...tenant,
        status: OrderStatus.PAID,
        $or: [
          { paidAt: { $gte: start, $lte: end } },
          // legacy: paid before paidAt existed
          { paidAt: null, updatedAt: { $gte: start, $lte: end } },
        ],
      })
      .sort({ paidAt: -1, updatedAt: -1 })
      .limit(100)
      .exec();

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
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    const revenueTiyns = paidToday.reduce((s, o) => s + (o.totalTiyns || 0), 0);
    const guestsCount = paidToday.reduce((s, o) => s + (o.guests || 0), 0);

    const tableIds = [
      ...new Set(
        [...paidToday, ...openOrders].map((o) => String(o.tableId)).filter(Boolean),
      ),
    ];
    const waiterIds = [
      ...new Set(paidToday.map((o) => String(o.waiterId)).filter(Boolean)),
    ];
    const [tables, waiters] = await Promise.all([
      this.tableModel.find({ _id: { $in: tableIds } }).select('name').exec(),
      this.userModel.find({ _id: { $in: waiterIds } }).select('name').exec(),
    ]);
    const tableName = new Map(tables.map((t) => [String(t._id), t.name]));
    const waiterName = new Map(waiters.map((w) => [String(w._id), w.name]));

    const mapOrder = (o: OrderDocument) => ({
      _id: String(o._id),
      status: o.status,
      totalTiyns: o.totalTiyns,
      prepaidTiyns: o.prepaidTiyns || 0,
      guests: o.guests || 0,
      tableId: String(o.tableId),
      tableName: tableName.get(String(o.tableId)) || undefined,
      waiterId: String(o.waiterId),
      waiterName: waiterName.get(String(o.waiterId)) || undefined,
      createdAt: (o as unknown as { createdAt?: Date }).createdAt,
      paidAt: o.paidAt || (o as unknown as { updatedAt?: Date }).updatedAt || null,
      number: String(o._id).slice(-4).toUpperCase(),
    });

    return {
      ordersTotal: paidToday.length + openOrders.length,
      ordersPaid: paidToday.length,
      ordersOpen: openOrders.length,
      revenueTiyns,
      averageCheckTiyns: paidToday.length
        ? Math.trunc(revenueTiyns / paidToday.length)
        : 0,
      guestsCount,
      revenueTodayTiyns: revenueTiyns,
      ordersCount: paidToday.length,
      avgCheckTiyns: paidToday.length
        ? Math.trunc(revenueTiyns / paidToday.length)
        : 0,
      paidOrders: paidToday.map(mapOrder),
      openOrders: openOrders.map(mapOrder),
    };
  }

  async byWaiters(user: JwtPayload, restaurantId?: string, date?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = await this.dayRange(tenant.restaurantId, date);
    const rows = await this.orderModel.aggregate([
      {
        $match: {
          organizationId: tenant.organizationId,
          restaurantId: tenant.restaurantId,
          status: OrderStatus.PAID,
          $or: [
            { paidAt: { $gte: start, $lte: end } },
            { paidAt: null, updatedAt: { $gte: start, $lte: end } },
          ],
        },
      },
      {
        $group: {
          _id: '$waiterId',
          orders: { $sum: 1 },
          revenueTiyns: { $sum: '$totalTiyns' },
        },
      },
      { $sort: { revenueTiyns: -1 } },
    ]);
    const ids = rows.map((r) => String(r._id));
    const waiters = await this.userModel.find({ _id: { $in: ids } }).select('name').exec();
    const nameById = new Map(waiters.map((w) => [String(w._id), w.name]));
    return rows.map((r) => ({
      ...r,
      _id: nameById.get(String(r._id)) || String(r._id).slice(-4),
    }));
  }

  async byProducts(user: JwtPayload, restaurantId?: string, date?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = await this.dayRange(tenant.restaurantId, date);
    const paidOrders = await this.orderModel
      .find({
        ...tenant,
        status: OrderStatus.PAID,
        $or: [
          { paidAt: { $gte: start, $lte: end } },
          { paidAt: null, updatedAt: { $gte: start, $lte: end } },
        ],
      })
      .select('_id')
      .exec();
    const ids = paidOrders.map((o) => o._id);
    if (!ids.length) return [];
    return this.itemModel.aggregate([
      {
        $match: {
          orderId: { $in: ids },
          status: { $ne: 'CANCELLED' },
        },
      },
      {
        $group: {
          _id: { productId: '$productId', name: '$nameSnapshot' },
          qty: { $sum: '$quantity' },
          revenueTiyns: { $sum: '$lineTotalTiyns' },
        },
      },
      { $sort: { revenueTiyns: -1 } },
    ]);
  }

  async byPaymentMethods(user: JwtPayload, restaurantId?: string, date?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = await this.dayRange(tenant.restaurantId, date);
    return this.paymentModel.aggregate([
      {
        $match: {
          organizationId: tenant.organizationId,
          restaurantId: tenant.restaurantId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          amountTiyns: { $sum: '$amountTiyns' },
        },
      },
    ]);
  }

  async shiftReport(user: JwtPayload, shiftId: string) {
    const shift = await this.shiftModel
      .findOne({
        _id: toObjectId(shiftId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!shift) return null;
    const payments = await this.paymentModel.find({ shiftId: shift._id }).exec();
    const orders = await this.orderModel.find({ shiftId: shift._id }).exec();
    const byMethod: Record<string, { count: number; amountTiyns: number }> = {};
    for (const p of payments) {
      const key = String(p.method || 'OTHER');
      if (!byMethod[key]) byMethod[key] = { count: 0, amountTiyns: 0 };
      byMethod[key].count += 1;
      byMethod[key].amountTiyns += p.amountTiyns;
    }
    return {
      shift,
      paymentsCount: payments.length,
      paymentsTotalTiyns: payments.reduce((s, p) => s + p.amountTiyns, 0),
      ordersCount: orders.length,
      paidOrders: orders.filter((o) => o.status === OrderStatus.PAID).length,
      cancelledOrders: orders.filter((o) => o.status === OrderStatus.CANCELLED).length,
      byMethod,
    };
  }
}
