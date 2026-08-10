import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload?.userId) {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      restaurantId: payload.restaurantId ?? null,
      role: payload.role,
      roleId: payload.roleId,
      permissions: payload.permissions ?? [],
      email: payload.email,
      name: payload.name,
    };
  }
}
