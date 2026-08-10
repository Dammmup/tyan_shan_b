import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '../../common/enums';

export class CreateDiscountDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({ description: 'PERCENT 0-100 or FIXED tiyns' })
  @IsInt()
  @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxPercentAllowed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class UpdateDiscountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @ApiPropertyOptional({ description: 'PERCENT 0-100 or FIXED tiyns' })
  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxPercentAllowed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ApplyDiscountDto {
  @ApiProperty()
  @IsMongoId()
  discountId!: string;
}
