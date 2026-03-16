import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MS_PER_DAY = 86400000;

/** Days the invoice is overdue (0 if not yet due or paid). */
export function getDaysOverdue(dueDate: string): number {
  const diff = new Date().getTime() - new Date(dueDate).getTime();
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

/** Days until due (positive = future, 0 = today or past). */
export function getDaysUntilDue(dueDate: string): number {
  const diff = new Date(dueDate).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

/** True if due_date is in the past (today or earlier counts as due). */
export function isOverdueByDate(dueDate: string): boolean {
  return new Date(dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
