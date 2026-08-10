import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { Permission } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './payments.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Permissions(Permission.PAYMENT_CREATE)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user, dto);
  }
}
