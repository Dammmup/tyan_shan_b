import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User, UserDocument } from '../users/user.schema';
import { Role, RoleDocument } from '../roles/role.schema';
import { UserStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { toObjectId } from '../../common/utils/tenant';
import { AuditService } from '../audit/audit.service';
import {
  ChangePasswordDto,
  LoginDto,
  LoginPinDto,
} from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async buildPayload(user: UserDocument): Promise<JwtPayload> {
    const role = await this.roleModel.findById(user.roleId).exec();
    if (!role) {
      throw new UnauthorizedException('Role missing');
    }
    return {
      userId: String(user._id),
      organizationId: String(user.organizationId),
      restaurantId: user.restaurantId ? String(user.restaurantId) : null,
      role: role.name,
      roleId: String(role._id),
      permissions: role.permissions ?? [],
      email: user.email,
      name: user.name,
    };
  }

  private async issueTokens(user: UserDocument) {
    const payload = await this.buildPayload(user);
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES') || '15m';
    const accessToken = await this.jwtService.signAsync(
      { ...payload },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: expiresIn as `${number}m` | `${number}d` | `${number}h` | `${number}s`,
      },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const hashed = this.hashRefresh(refreshToken);
    user.refreshTokens = [...(user.refreshTokens ?? []), hashed].slice(-10);
    await user.save();
    return { accessToken, refreshToken, user: payload };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .exec();
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.issueTokens(user);
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      userId: user._id,
      action: 'AUTH_LOGIN',
    });
    return {
      ...tokens,
      user: {
        ...tokens.user,
        id: tokens.user.userId,
      },
    };
  }

  async loginPin(dto: LoginPinDto) {
    const filter: Record<string, unknown> = {
      status: UserStatus.ACTIVE,
      pinHash: { $exists: true, $ne: null },
    };
    if (dto.restaurantId) {
      filter.restaurantId = toObjectId(dto.restaurantId);
    }
    const users = await this.userModel.find(filter).exec();

    const matched: UserDocument[] = [];
    for (const u of users) {
      if (u.pinHash && (await bcrypt.compare(dto.pin, u.pinHash))) {
        matched.push(u);
      }
    }
    if (!matched.length) {
      throw new UnauthorizedException('Invalid PIN');
    }
    if (matched.length > 1) {
      throw new UnauthorizedException('PIN is not unique; contact admin');
    }
    const [userDoc] = matched;
    const tokens = await this.issueTokens(userDoc);
    await this.audit.log({
      organizationId: userDoc.organizationId,
      restaurantId: userDoc.restaurantId,
      userId: userDoc._id,
      action: 'AUTH_LOGIN_PIN',
    });
    return {
      ...tokens,
      user: {
        ...tokens.user,
        id: tokens.user.userId,
      },
    };
  }

  async refresh(refreshToken: string) {
    const hashed = this.hashRefresh(refreshToken);
    const user = await this.userModel
      .findOne({ refreshTokens: hashed, status: UserStatus.ACTIVE })
      .exec();
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    user.refreshTokens = (user.refreshTokens ?? []).filter((t) => t !== hashed);
    await user.save();
    return this.issueTokens(user);
  }

  async logout(userId: string, refreshToken?: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return { ok: true };
    if (refreshToken) {
      const hashed = this.hashRefresh(refreshToken);
      user.refreshTokens = (user.refreshTokens ?? []).filter((t) => t !== hashed);
    } else {
      user.refreshTokens = [];
    }
    await user.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      userId: user._id,
      action: 'AUTH_LOGOUT',
    });
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.refreshTokens = [];
    await user.save();
    await this.audit.log({
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      userId: user._id,
      action: 'AUTH_CHANGE_PASSWORD',
    });
    return { ok: true };
  }
}
