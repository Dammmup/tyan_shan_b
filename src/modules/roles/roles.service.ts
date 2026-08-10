import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ALL_PERMISSIONS } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import { Role, RoleDocument } from './role.schema';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly audit: AuditService,
  ) {}

  private assertPermissions(perms: string[]) {
    const invalid = perms.filter((p) => !ALL_PERMISSIONS.includes(p as never));
    if (invalid.length) {
      throw new BadRequestException(`Invalid permissions: ${invalid.join(', ')}`);
    }
  }

  async create(user: JwtPayload, dto: CreateRoleDto) {
    this.assertPermissions(dto.permissions);
    const exists = await this.roleModel
      .findOne({
        organizationId: user.organizationId,
        name: dto.name.toUpperCase(),
      })
      .exec();
    if (exists) throw new BadRequestException('Role already exists');
    const doc = await this.roleModel.create({
      name: dto.name.toUpperCase(),
      permissions: dto.permissions,
      organizationId: toObjectId(user.organizationId),
      isSystem: false,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      userId: user.userId,
      action: 'ROLE_CREATE',
      entityType: 'Role',
      entityId: String(doc._id),
    });
    return doc;
  }

  list(user: JwtPayload) {
    return this.roleModel
      .find({ organizationId: toObjectId(user.organizationId) })
      .sort({ name: 1 })
      .exec();
  }

  async get(user: JwtPayload, id: string) {
    const doc = await this.roleModel
      .findOne({
        _id: toObjectId(id),
        organizationId: toObjectId(user.organizationId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Role not found');
    return doc;
  }

  async update(user: JwtPayload, id: string, dto: UpdateRoleDto) {
    const doc = await this.get(user, id);
    if (dto.permissions) this.assertPermissions(dto.permissions);
    if (dto.name) doc.name = dto.name.toUpperCase();
    if (dto.permissions) doc.permissions = dto.permissions;
    await doc.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      userId: user.userId,
      action: 'ROLE_UPDATE',
      entityType: 'Role',
      entityId: id,
    });
    return doc;
  }

  async remove(user: JwtPayload, id: string) {
    const doc = await this.get(user, id);
    if (doc.isSystem) {
      throw new BadRequestException('Cannot delete system role');
    }
    await doc.deleteOne();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      userId: user.userId,
      action: 'ROLE_DELETE',
      entityType: 'Role',
      entityId: id,
    });
    return { ok: true };
  }
}
