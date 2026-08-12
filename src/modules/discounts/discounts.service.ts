import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscountType, OrderStatus, Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { PricingService } from '../pricing/pricing.service';
import { Order, OrderDocument, OrderItem, OrderItemDocument } from '../orders/order.schemas';
import { Discount, DiscountDocument } from './discount.schema';
import {
  ApplyDiscountDto,
  CreateDiscountDto,
  UpdateDiscountDto,
} from './discounts.dto';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectModel(Discount.name) private readonly discountModel: Model<DiscountDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(OrderItem.name) private readonly itemModel: Model<OrderItemDocument>,
    private readonly pricing: PricingService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  async create(user: JwtPayload, dto: CreateDiscountDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    return this.discountModel.create({
      name: dto.name,
      type: dto.type,
      value: Math.trunc(dto.value),
      maxPercentAllowed: dto.maxPercentAllowed ?? 100,
      ...tenant,
      isActive: true,
    });
  }

  /** Returns all discounts for restaurant (incl. inactive); filter client-side. */
  list(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    return this.discountModel.find(tenant).exec();
  }

  async update(user: JwtPayload, id: string, dto: UpdateDiscountDto) {
    const doc = await this.discountModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Discount not found');
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.type !== undefined) doc.type = dto.type;
    if (dto.value !== undefined) doc.value = Math.trunc(dto.value);
    if (dto.maxPercentAllowed !== undefined) {
      doc.maxPercentAllowed = dto.maxPercentAllowed;
    }
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    return doc;
  }

  async softDelete(user: JwtPayload, id: string) {
    return this.update(user, id, { isActive: false });
  }

  async apply(user: JwtPayload, orderId: string, dto: ApplyDiscountDto) {
    if (!user.permissions.includes(Permission.ORDER_DISCOUNT)) {
      throw new ForbiddenException('ORDER_DISCOUNT required');
    }
    const order = await this.orderModel
      .findOne({
        _id: toObjectId(orderId),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order closed');
    }

    const items = await this.itemModel.find({ orderId: order._id }).exec();
    const { subtotalTiyns } = this.pricing.computeOrderTotals(items, 0);
    const { discount, discountTiyns } = await this.pricing.computeDiscountAmount(
      dto.discountId,
      subtotalTiyns,
      String(order.restaurantId),
    );

    if (discount.type === DiscountType.PERCENT) {
      const pct = Math.trunc(discount.value);
      if (pct > discount.maxPercentAllowed) {
        const elevated =
          user.permissions.includes(Permission.DISCOUNT_MANAGE) ||
          user.role === 'OWNER' ||
          user.role === 'MANAGER';
        if (!elevated) {
          throw new ForbiddenException(
            `Discount percent ${pct} exceeds limit ${discount.maxPercentAllowed}`,
          );
        }
      }
    }

    order.discountId = discount._id as Types.ObjectId;
    order.discountTiyns = discountTiyns;
    const totals = this.pricing.computeOrderTotals(items, discountTiyns);
    order.subtotalTiyns = totals.subtotalTiyns;
    order.serviceChargeTiyns = totals.serviceChargeTiyns;
    order.totalTiyns = totals.totalTiyns;
    await order.save();

    this.events.emitToRestaurant(String(order.restaurantId), 'ORDER_DISCOUNT_APPLIED', {
      orderId,
      discountTiyns,
      serviceChargeTiyns: order.serviceChargeTiyns,
      totalTiyns: order.totalTiyns,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: order.restaurantId,
      userId: user.userId,
      action: 'ORDER_DISCOUNT',
      entityType: 'Order',
      entityId: orderId,
      meta: { discountId: dto.discountId, discountTiyns },
    });
    return order;
  }
}
