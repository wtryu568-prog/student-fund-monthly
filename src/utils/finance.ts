import { Transaction, MonthlyBill, Payment } from "../types";

/**
 * Calculates the net balance from a list of transactions
 */
export function calculateBalance(transactions: Transaction[]): number {
  return (transactions || []).reduce(
    (sum, tx) => sum + (tx.type === "income" ? tx.amount : -tx.amount),
    0
  );
}

/**
 * Calculates total income from a list of transactions
 */
export function calculateTotalIncome(transactions: Transaction[]): number {
  return (transactions || [])
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Calculates total expense from a list of transactions
 */
export function calculateTotalExpense(transactions: Transaction[]): number {
  return (transactions || [])
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Calculates total unpaid/pending bills amount
 */
export function calculateUnpaidBillsAmount(bills: MonthlyBill[]): number {
  return (bills || [])
    .filter((b) => b.status === "pending")
    .reduce((sum, b) => sum + b.amount, 0);
}
