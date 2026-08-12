import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscountType } from '../../common/enums';
import { applyPercentDiscount, applyPercentMarkup } from '../../common/utils/money';
import { Product, ProductDocument, Price, PriceDocument, Modifier, ModifierDocument } from '../menu/menu.schemas';
import { Discount, DiscountDocument } from '../discounts/discount.schema';
import { OrderItem } from '../orders/order.schemas';

/** Cafe policy: обслуживание 10% (from printed menu). */
export const SERVICE_CHARGE_PERCENT = 10;
export interface ComputedItemLine {
  productId: Types.ObjectId;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  lineTotalTiyns: number;
  modifiers: Array<{
    modifierId: Types.ObjectId;
    nameSnapshot: string;
    priceSnapshot: number;
  }>;
  productionCenter: string;
}

@Injectable()
export class PricingService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Price.name) private readonly priceModel: Model<PriceDocument>,
    @InjectModel(Modifier.name) private readonly modifierModel: Model<ModifierDocument>,
    @InjectModel(Discount.name) private readonly discountModel: Model<DiscountDocument>,
  ) {}

  async resolveUnitPriceTiyns(
    productId: Types.ObjectId | string,
    restaurantId: Types.ObjectId | string,
    hallId?: Types.ObjectId | string | null,
  ): Promise<{ product: ProductDocument; unitPriceTiyns: number }> {
    const product = await this.productModel.findById(productId).exec();
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    if (String(product.restaurantId) !== String(restaurantId)) {
      throw new BadRequestException('Product does not belong to restaurant');
    }

    let priceDoc: PriceDocument | null = null;
    if (hallId) {
      priceDoc = await this.priceModel
        .findOne({
          productId: product._id,
          restaurantId,
          hallId,
          isActive: true,
        })
        .exec();
    }
    if (!priceDoc) {
      priceDoc = await this.priceModel
        .findOne({
          productId: product._id,
          restaurantId,
          hallId: null,
          channel: null,
          isActive: true,
        })
        .exec();
    }

    const unitPriceTiyns = priceDoc
      ? Math.trunc(Number(priceDoc.priceTiyns) || 0)
      : Math.trunc(Number(product.basePriceTiyns) || 0);

    return { product, unitPriceTiyns };
  }

  async computeItemLine(input: {
    productId: string;
    quantity: number;
    modifierIds?: string[];
    restaurantId: string;
    hallId?: string | null;
    note?: string;
  }): Promise<ComputedItemLine> {
    const qty = Math.trunc(input.quantity);
    if (qty < 1) {
      throw new BadRequestException('quantity must be >= 1');
    }

    const { product, unitPriceTiyns } = await this.resolveUnitPriceTiyns(
      input.productId,
      input.restaurantId,
      input.hallId,
    );

    const modifiers: ComputedItemLine['modifiers'] = [];
    let modifiersTotal = 0;
    if (input.modifierIds?.length) {
      const mods = await this.modifierModel
        .find({
          _id: { $in: input.modifierIds },
          restaurantId: input.restaurantId,
          isActive: true,
        })
        .exec();
      if (mods.length !== input.modifierIds.length) {
        throw new BadRequestException('Invalid modifiers');
      }
      for (const m of mods) {
        const p = Math.trunc(m.priceTiyns);
        modifiersTotal += p;
        modifiers.push({
          modifierId: m._id as Types.ObjectId,
          nameSnapshot: m.name,
          priceSnapshot: p,
        });
      }
    }

    const priceSnapshot = unitPriceTiyns + modifiersTotal;
    const lineTotalTiyns = priceSnapshot * qty;

    return {
      productId: product._id as Types.ObjectId,
      nameSnapshot: product.name,
      priceSnapshot,
      quantity: qty,
      lineTotalTiyns,
      modifiers,
      productionCenter: product.productionCenter,
    };
  }

  computeOrderTotals(
    items: Array<Pick<OrderItem, 'lineTotalTiyns' | 'status'>>,
    discountTiyns = 0,
    servicePercent = SERVICE_CHARGE_PERCENT,
  ): {
    subtotalTiyns: number;
    discountTiyns: number;
    serviceChargeTiyns: number;
    totalTiyns: number;
  } {
    const subtotalTiyns = items
      .filter((i) => i.status !== 'CANCELLED')
      .reduce((sum, i) => sum + Math.trunc(i.lineTotalTiyns), 0);
    const disc = Math.min(Math.max(0, Math.trunc(discountTiyns)), subtotalTiyns);
    const afterDiscount = subtotalTiyns - disc;
    const serviceChargeTiyns = applyPercentMarkup(afterDiscount, servicePercent);
    return {
      subtotalTiyns,
      discountTiyns: disc,
      serviceChargeTiyns,
      totalTiyns: afterDiscount + serviceChargeTiyns,
    };
  }

  async computeDiscountAmount(
    discountId: string,
    subtotalTiyns: number,
    restaurantId: string,
  ): Promise<{ discount: DiscountDocument; discountTiyns: number }> {
    const discount = await this.discountModel.findById(discountId).exec();
    if (!discount || !discount.isActive) {
      throw new NotFoundException('Discount not found');
    }
    if (String(discount.restaurantId) !== restaurantId) {
      throw new BadRequestException('Discount does not belong to restaurant');
    }

    const sub = Math.trunc(subtotalTiyns);
    let discountTiyns = 0;
    if (discount.type === DiscountType.PERCENT) {
      discountTiyns = sub - applyPercentDiscount(sub, discount.value);
    } else {
      discountTiyns = Math.min(sub, Math.trunc(discount.value));
    }
    return { discount, discountTiyns };
  }
}
