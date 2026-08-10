import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { KitchenStatus } from '../../common/enums';

export class KitchenStatusQueryDto {
  @ApiPropertyOptional({ enum: KitchenStatus })
  @IsOptional()
  @IsEnum(KitchenStatus)
  status?: KitchenStatus;
}
