import { IsArray, IsOptional, IsString, ArrayUnique } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission } from '../../common/enums';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: Permission, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: Permission, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[];
}
