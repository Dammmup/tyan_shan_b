import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { tenantFilter, toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import {
  Category,
  CategoryDocument,
  Product,
  ProductDocument,
  Price,
  PriceDocument,
  ModifierGroup,
  ModifierGroupDocument,
  Modifier,
  ModifierDocument,
} from './menu.schemas';
import {
  CreateCategoryDto,
  CreateModifierDto,
  CreateModifierGroupDto,
  CreatePriceDto,
  CreateProductDto,
  StopListDto,
  UpdateCategoryDto,
  UpdateModifierDto,
  UpdateModifierGroupDto,
  UpdateProductDto,
} from './menu.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Price.name) private readonly priceModel: Model<PriceDocument>,
    @InjectModel(ModifierGroup.name) private readonly groupModel: Model<ModifierGroupDocument>,
    @InjectModel(Modifier.name) private readonly modifierModel: Model<ModifierDocument>,
    private readonly audit: AuditService,
  ) {}

  async createCategory(user: JwtPayload, dto: CreateCategoryDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    return this.categoryModel.create({
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
      ...tenant,
      isActive: true,
    });
  }

  listCategories(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    return this.categoryModel
      .find({ ...tenant, isActive: true })
      .sort({ sortOrder: 1 })
      .exec();
  }

  async updateCategory(user: JwtPayload, id: string, dto: UpdateCategoryDto) {
    const doc = await this.categoryModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Category not found');
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.sortOrder !== undefined) doc.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    return doc;
  }

  async softDeleteCategory(user: JwtPayload, id: string) {
    return this.updateCategory(user, id, { isActive: false });
  }

  async createProduct(user: JwtPayload, dto: CreateProductDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    const doc = await this.productModel.create({
      name: dto.name,
      categoryId: toObjectId(dto.categoryId),
      basePriceTiyns: Math.trunc(dto.basePriceTiyns),
      productionCenter: dto.productionCenter,
      description: dto.description,
      modifierGroupIds: (dto.modifierGroupIds ?? []).map((id) => toObjectId(id)),
      ...tenant,
      isActive: true,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.userId,
      action: 'PRODUCT_CREATE',
      entityType: 'Product',
      entityId: String(doc._id),
    });
    return doc;
  }

  async listProducts(user: JwtPayload, restaurantId?: string, categoryId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const q: Record<string, unknown> = { ...tenant, isActive: true };
    if (categoryId) q.categoryId = toObjectId(categoryId);
    const rows = await this.productModel.find(q).sort({ name: 1 }).exec();

    const groupIds = [
      ...new Set(rows.flatMap((p) => (p.modifierGroupIds || []).map((id) => String(id)))),
    ];
    const groups = groupIds.length
      ? await this.groupModel
          .find({ _id: { $in: groupIds }, isActive: true })
          .exec()
      : [];
    const modifiers = groupIds.length
      ? await this.modifierModel
          .find({ groupId: { $in: groupIds }, isActive: true })
          .exec()
      : [];
    const modsByGroup = new Map<string, typeof modifiers>();
    for (const m of modifiers) {
      const key = String(m.groupId);
      const list = modsByGroup.get(key) || [];
      list.push(m);
      modsByGroup.set(key, list);
    }
    const groupById = new Map(
      groups.map((g) => [
        String(g._id),
        {
          _id: String(g._id),
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          required: g.required,
          modifiers: (modsByGroup.get(String(g._id)) || []).map((m) => ({
            _id: String(m._id),
            name: m.name,
            priceTiyns: m.priceTiyns,
            isActive: m.isActive,
          })),
        },
      ]),
    );

    return rows.map((p) => {
      const obj = p.toObject();
      const modifierGroups = (obj.modifierGroupIds || [])
        .map((id) => groupById.get(String(id)))
        .filter(Boolean);
      return {
        ...obj,
        priceTiyns: obj.basePriceTiyns,
        modifierGroups,
      };
    });
  }

  async updateProduct(user: JwtPayload, id: string, dto: UpdateProductDto) {
    const doc = await this.productModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Product not found');
    if (dto.name) doc.name = dto.name;
    if (dto.categoryId !== undefined) doc.categoryId = toObjectId(dto.categoryId);
    if (dto.basePriceTiyns !== undefined) {
      doc.basePriceTiyns = Math.trunc(dto.basePriceTiyns);
    }
    if (dto.productionCenter) doc.productionCenter = dto.productionCenter;
    if (dto.description !== undefined) doc.description = dto.description;
    if (dto.modifierGroupIds !== undefined) {
      doc.modifierGroupIds = dto.modifierGroupIds.map((gid) => toObjectId(gid));
    }
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    return doc;
  }

  async softDeleteProduct(user: JwtPayload, id: string) {
    return this.updateProduct(user, id, { isActive: false });
  }

  async setStopList(user: JwtPayload, id: string, dto: StopListDto) {
    const doc = await this.productModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Product not found');
    doc.availability = dto.availability;
    await doc.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: doc.restaurantId,
      userId: user.userId,
      action: 'PRODUCT_STOPLIST',
      entityType: 'Product',
      entityId: id,
      meta: { availability: dto.availability },
    });
    return doc;
  }

  async createPrice(user: JwtPayload, dto: CreatePriceDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    return this.priceModel.create({
      productId: toObjectId(dto.productId),
      priceTiyns: Math.trunc(dto.priceTiyns),
      hallId: dto.hallId ? toObjectId(dto.hallId) : null,
      channel: dto.channel ?? null,
      ...tenant,
      isActive: true,
    });
  }

  listPrices(user: JwtPayload, restaurantId?: string, productId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const q: Record<string, unknown> = { ...tenant, isActive: true };
    if (productId) q.productId = toObjectId(productId);
    return this.priceModel.find(q).exec();
  }

  async createModifierGroup(user: JwtPayload, dto: CreateModifierGroupDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    return this.groupModel.create({
      name: dto.name,
      required: dto.required ?? false,
      minSelect: dto.minSelect ?? 0,
      maxSelect: dto.maxSelect ?? 1,
      ...tenant,
      isActive: true,
    });
  }

  listModifierGroups(user: JwtPayload, restaurantId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    return this.groupModel.find({ ...tenant, isActive: true }).exec();
  }

  async createModifier(user: JwtPayload, dto: CreateModifierDto) {
    const tenant = tenantFilter(user, dto.restaurantId);
    return this.modifierModel.create({
      name: dto.name,
      groupId: toObjectId(dto.groupId),
      priceTiyns: Math.trunc(dto.priceTiyns),
      ...tenant,
      isActive: true,
    });
  }

  listModifiers(user: JwtPayload, restaurantId?: string, groupId?: string) {
    const tenant = tenantFilter(user, restaurantId);
    const q: Record<string, unknown> = { ...tenant, isActive: true };
    if (groupId) q.groupId = toObjectId(groupId);
    return this.modifierModel.find(q).exec();
  }

  async updateModifierGroup(user: JwtPayload, id: string, dto: UpdateModifierGroupDto) {
    const doc = await this.groupModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Modifier group not found');
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.required !== undefined) doc.required = dto.required;
    if (dto.minSelect !== undefined) doc.minSelect = dto.minSelect;
    if (dto.maxSelect !== undefined) doc.maxSelect = dto.maxSelect;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    return doc;
  }

  async softDeleteModifierGroup(user: JwtPayload, id: string) {
    return this.updateModifierGroup(user, id, { isActive: false });
  }

  async updateModifier(user: JwtPayload, id: string, dto: UpdateModifierDto) {
    const doc = await this.modifierModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Modifier not found');
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.priceTiyns !== undefined) doc.priceTiyns = Math.trunc(dto.priceTiyns);
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();
    return doc;
  }

  async softDeleteModifier(user: JwtPayload, id: string) {
    return this.updateModifier(user, id, { isActive: false });
  }
}
