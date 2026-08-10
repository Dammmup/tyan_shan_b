import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  LoginPinDto,
  RefreshDto,
} from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('login-pin')
  loginPin(@Body() dto: LoginPinDto) {
    return this.authService.loginPin(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload, @Body() body: RefreshDto) {
    return this.authService.logout(user.userId, body?.refreshToken);
  }

  @ApiBearerAuth()
  @Post('change-password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }
}
