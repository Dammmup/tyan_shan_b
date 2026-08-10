import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { Role, RoleSchema } from './role.schema';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }]),
    AuditModule,
  ],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService, MongooseModule],
})
export class RolesModule {}
