import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { Order, OrderDocument, OrderItem, OrderItemDocument } from '../orders/order.schemas';
import { Payment, PaymentDocument } from '../payments/payment.schemas';
import { Shift, ShiftDocument } from '../shifts/shift.schemas';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(OrderItem.name) private readonly itemModel: Model<OrderItemDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Shift.name) private readonly shiftModel: Model<ShiftDocument>,
  ) {}

  private todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async dashboardToday(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = this.todayRange();
    const orders = await this.orderModel
      .find({
        ...tenant,
        createdAt: { $gte: start, $lte: end },
      })
      .exec();
    const paid = orders.filter((o) => o.status === OrderStatus.PAID);
    const revenueTiyns = paid.reduce((s, o) => s + o.totalTiyns, 0);
    const openCount = orders.filter(
      (o) => o.status !== OrderStatus.PAID && o.status !== OrderStatus.CANCELLED,
    ).length;
    return {
      ordersTotal: orders.length,
      ordersPaid: paid.length,
      ordersOpen: openCount,
      revenueTiyns,
      averageCheckTiyns: paid.length ? Math.trunc(revenueTiyns / paid.length) : 0,
      guestsCount: paid.reduce((s, o) => s + (o.guests || 0), 0),
      // aliases for frontend dashboard
      revenueTodayTiyns: revenueTiyns,
      ordersCount: paid.length,
      avgCheckTiyns: paid.length ? Math.trunc(revenueTiyns / paid.length) : 0,
    };
  }

  async byWaiters(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = this.todayRange();
    const rows = await this.orderModel.aggregate([
      {
        $match: {
          organizationId: tenant.organizationId,
          restaurantId: tenant.restaurantId,
          status: OrderStatus.PAID,
          createdAt: { $gte: start, $lte: end },
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
    return rows;
  }

  async byProducts(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = this.todayRange();
    const paidOrders = await this.orderModel
      .find({
        ...tenant,
        status: OrderStatus.PAID,
        createdAt: { $gte: start, $lte: end },
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

  async byPaymentMethods(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const { start, end } = this.todayRange();
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
