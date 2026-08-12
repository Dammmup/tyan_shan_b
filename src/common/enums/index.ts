export enum UserStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  BLOCKED = 'BLOCKED',
}

export enum TableStatus {
  FREE = 'FREE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  DISABLED = 'DISABLED',
}

export enum OrderStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
  SERVED = 'SERVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum OrderItemStatus {
  NEW = 'NEW',
  SENT = 'SENT',
  COOKING = 'COOKING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export enum KitchenStatus {
  NEW = 'NEW',
  ACCEPTED = 'ACCEPTED',
  COOKING = 'COOKING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export enum ProductionCenter {
  COLD = 'COLD',
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  GRILL = 'GRILL',
  DESSERT = 'DESSERT',
  OTHER = 'OTHER',
}

/** Explicit list for Mongoose enums (avoids stale/partial TS enum values in prod). */
export const PRODUCTION_CENTER_VALUES: ProductionCenter[] = [
  ProductionCenter.COLD,
  ProductionCenter.KITCHEN,
  ProductionCenter.BAR,
  ProductionCenter.GRILL,
  ProductionCenter.DESSERT,
  ProductionCenter.OTHER,
];

export function normalizeProductionCenter(
  value?: string | null,
): ProductionCenter {
  if (
    value &&
    (PRODUCTION_CENTER_VALUES as string[]).includes(value)
  ) {
    return value as ProductionCenter;
  }
  return ProductionCenter.KITCHEN;
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  SPLIT = 'SPLIT',
}

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashOpType {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
}

export enum PrintJobStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  PRINTED = 'PRINTED',
  FAILED = 'FAILED',
  ACKED = 'ACKED',
}

export enum DiscountType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum ProductAvailability {
  AVAILABLE = 'AVAILABLE',
  STOPPED = 'STOPPED',
  HIDDEN = 'HIDDEN',
}

export enum Permission {
  ORGANIZATION_MANAGE = 'ORGANIZATION_MANAGE',
  RESTAURANT_MANAGE = 'RESTAURANT_MANAGE',
  USER_MANAGE = 'USER_MANAGE',
  ROLE_MANAGE = 'ROLE_MANAGE',
  MENU_MANAGE = 'MENU_MANAGE',
  MENU_STOPLIST = 'MENU_STOPLIST',
  HALL_MANAGE = 'HALL_MANAGE',
  TABLE_MANAGE = 'TABLE_MANAGE',
  ORDER_CREATE = 'ORDER_CREATE',
  ORDER_VIEW = 'ORDER_VIEW',
  ORDER_CANCEL = 'ORDER_CANCEL',
  ORDER_DISCOUNT = 'ORDER_DISCOUNT',
  KITCHEN_VIEW = 'KITCHEN_VIEW',
  KITCHEN_MANAGE = 'KITCHEN_MANAGE',
  PAYMENT_CREATE = 'PAYMENT_CREATE',
  PAYMENT_REFUND = 'PAYMENT_REFUND',
  SHIFT_OPEN = 'SHIFT_OPEN',
  SHIFT_CLOSE = 'SHIFT_CLOSE',
  SHIFT_CASH = 'SHIFT_CASH',
  PRINTER_MANAGE = 'PRINTER_MANAGE',
  PRINT_JOB_MANAGE = 'PRINT_JOB_MANAGE',
  REPORT_VIEW = 'REPORT_VIEW',
  AUDIT_VIEW = 'AUDIT_VIEW',
  DISCOUNT_MANAGE = 'DISCOUNT_MANAGE',
}

export const ALL_PERMISSIONS = Object.values(Permission);

export const PERMISSION_CODES = ALL_PERMISSIONS;
