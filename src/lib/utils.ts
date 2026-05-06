import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MS_PER_DAY = 86400000;

function toLocalDateStart(dateInput: string): number {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).setHours(0, 0, 0, 0);
  }
  const parsed = new Date(dateInput);
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  ).setHours(0, 0, 0, 0);
}

function todayLocalStart(): number {
  return new Date().setHours(0, 0, 0, 0);
}

/** Days the invoice is overdue (0 if not yet due or paid). */
export function getDaysOverdue(dueDate: string): number {
  const diff = todayLocalStart() - toLocalDateStart(dueDate);
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

/** Days until due (positive = future, 0 = today or past). */
export function getDaysUntilDue(dueDate: string): number {
  const diff = toLocalDateStart(dueDate) - todayLocalStart();
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

/** True if due_date is in the past (today or earlier counts as due). */
export function isOverdueByDate(dueDate: string): boolean {
  return toLocalDateStart(dueDate) < todayLocalStart();
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
