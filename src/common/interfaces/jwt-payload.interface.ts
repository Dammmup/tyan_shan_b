export class JwtPayload {
  userId!: string;
  organizationId!: string;
  restaurantId!: string | null;
  role!: string;
  roleId!: string;
  permissions!: string[];
  email?: string;
  name?: string;
}
