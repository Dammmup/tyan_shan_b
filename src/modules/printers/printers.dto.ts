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
import { ProductionCenter } from '../../common/enums';

export class CreatePrinterDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ProductionCenter })
  @IsEnum(ProductionCenter)
  productionCenter!: ProductionCenter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiPropertyOptional({ default: '127.0.0.1' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ default: 9100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  restaurantId?: string;
}

export class UpdatePrinterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
