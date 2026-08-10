import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashOpType } from '../../common/enums';

export class OpenShiftDto {
  @ApiProperty({ description: 'Opening cash in tiyns' })
  @IsInt()
  @Min(0)
  openingCashTiyns!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class CloseShiftDto {
  @ApiProperty({ description: 'Actual counted cash in tiyns' })
  @IsInt()
  @Min(0)
  actualCashTiyns!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closeNote?: string;
}

export class CashOperationDto {
  @ApiProperty({ enum: CashOpType })
  @IsEnum(CashOpType)
  type!: CashOpType;

  @ApiProperty({ description: 'Amount in tiyns' })
  @IsInt()
  @Min(1)
  amountTiyns!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
