import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  OrderStatus,
  PaymentMethod,
  ShiftStatus,
  TableStatus,
} from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { Table, TableDocument } from '../halls/hall-table.schema';
import { Order, OrderDocument } from '../orders/order.schemas';
import { Shift, ShiftDocument } from '../shifts/shift.schemas';
import { Payment, PaymentDocument } from './payment.schemas';
import { CreatePaymentDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(Shift.name) private readonly shiftModel: Model<ShiftDocument>,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  async create(user: JwtPayload, dto: CreatePaymentDto) {
    const order = await this.orderModel
      .findOne({
        _id: toObjectId(dto.orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Order already paid');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order cancelled');
    }

    const amount = Math.trunc(dto.amountTiyns);
    const prepaid = Math.trunc(order.prepaidTiyns || 0);
    const dueTiyns = Math.max(0, Math.trunc(order.totalTiyns) - prepaid);
    if (amount < dueTiyns) {
      throw new BadRequestException(
        `Payment ${amount} tiyns is less than remaining due ${dueTiyns} (total ${order.totalTiyns} − prepaid ${prepaid})`,
      );
    }

    let splits = dto.splits ?? [];
    if (dto.method === PaymentMethod.SPLIT) {
      if (!splits.length) {
        throw new BadRequestException('splits required for SPLIT payment');
      }
      const splitSum = splits.reduce((s, p) => s + Math.trunc(p.amountTiyns), 0);
      if (splitSum < dueTiyns) {
        throw new BadRequestException('Split sum less than remaining due');
      }
    } else {
      splits = [{ method: dto.method, amountTiyns: amount }];
    }

    const shift = await this.shiftModel
      .findOne({
        restaurantId: order.restaurantId,
        status: ShiftStatus.OPEN,
      })
      .exec();

    const payment = await this.paymentModel.create({
      orderId: order._id,
      organizationId: order.organizationId,
      restaurantId: order.restaurantId,
      shiftId: shift?._id ?? order.shiftId,
      method: dto.method,
      amountTiyns: amount,
      splits: splits.map((s) => ({
        method: s.method,
        amountTiyns: Math.trunc(s.amountTiyns),
      })),
      createdBy: toObjectId(user.userId),
      isRefunded: false,
    });

    order.status = OrderStatus.PAID;
    await order.save();

    const table = await this.tableModel.findById(order.tableId).exec();
    if (table) {
      table.status = TableStatus.FREE;
      table.currentOrderId = null;
      await table.save();
      this.events.emitToRestaurant(String(order.restaurantId), 'TABLE_UPDATED', {
        tableId: String(table._id),
        status: TableStatus.FREE,
        currentOrderId: null,
      });
    }

    this.events.emitToRestaurant(String(order.restaurantId), 'PAYMENT_CREATED', {
      payment,
      orderId: String(order._id),
    });
    this.events.emitToRestaurant(String(order.restaurantId), 'ORDER_PAID', {
      orderId: String(order._id),
    });

    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: order.restaurantId,
      userId: user.userId,
      action: 'PAYMENT_CREATE',
      entityType: 'Payment',
      entityId: String(payment._id),
      meta: { amountTiyns: amount, orderId: String(order._id) },
    });

    return { payment, order };
  }
}
