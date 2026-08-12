import { Permission } from './enums';

/** Canonical role → permissions map (seed + sync:roles). */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: Object.values(Permission),
  ADMIN: Object.values(Permission),
  MANAGER: [
    Permission.USER_MANAGE,
    Permission.MENU_MANAGE,
    Permission.MENU_STOPLIST,
    Permission.HALL_MANAGE,
    Permission.TABLE_MANAGE,
    Permission.ORDER_CREATE,
    Permission.ORDER_VIEW,
    Permission.ORDER_CANCEL,
    Permission.ORDER_DISCOUNT,
    Permission.KITCHEN_VIEW,
    Permission.KITCHEN_MANAGE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_REFUND,
    Permission.SHIFT_OPEN,
    Permission.SHIFT_CLOSE,
    Permission.SHIFT_CASH,
    Permission.PRINTER_MANAGE,
    Permission.PRINT_JOB_MANAGE,
    Permission.REPORT_VIEW,
    Permission.AUDIT_VIEW,
    Permission.DISCOUNT_MANAGE,
  ],
  /** Senior waiter: discounts + cancel after punch. */
  SENIOR_WAITER: [
    Permission.ORDER_CREATE,
    Permission.ORDER_VIEW,
    Permission.ORDER_CANCEL,
    Permission.ORDER_DISCOUNT,
    Permission.TABLE_MANAGE,
    Permission.MENU_STOPLIST,
  ],
  /** Regular waiter: no discounts; cancel only NEW items (enforced in service). */
  WAITER: [
    Permission.ORDER_CREATE,
    Permission.ORDER_VIEW,
    Permission.ORDER_CANCEL,
    Permission.TABLE_MANAGE,
    Permission.MENU_STOPLIST,
  ],
  CASHIER: [
    Permission.ORDER_VIEW,
    Permission.ORDER_DISCOUNT,
    Permission.PAYMENT_CREATE,
    Permission.SHIFT_OPEN,
    Permission.SHIFT_CLOSE,
    Permission.SHIFT_CASH,
    Permission.REPORT_VIEW,
  ],
  KITCHEN: [Permission.KITCHEN_VIEW, Permission.KITCHEN_MANAGE],
  BAR: [Permission.KITCHEN_VIEW, Permission.KITCHEN_MANAGE],
};

/** Can cancel sent/cooking items and apply discounts without admin. */
export function canManageSentItems(role: string): boolean {
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'SENIOR_WAITER'
  );
}

export function canApplyOrderDiscount(role: string, permissions: string[]): boolean {
  if (permissions.includes(Permission.ORDER_DISCOUNT)) return true;
  return canManageSentItems(role);
}
