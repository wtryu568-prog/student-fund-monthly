/**
 * Bill Service
 * Bill status calculation and update helpers
 */

import { supabase } from "../config/supabase";

export async function updateBillStatus(billId: string) {
  const { data: bill } = await supabase.from("monthly_bills").select("*").eq("id", billId).single();
  if (!bill) return;

  const { data: billPayments } = await supabase.from("payments").select("*").eq("bill_id", billId);
  const totalApproved = (billPayments || []).filter((p: { status: string }) => p.status === "approved").reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
  const hasPendingReview = (billPayments || []).some((p: { status: string }) => p.status === "pending_review");

  let newStatus = "pending";
  let paidAt = bill.paid_at;
  if (totalApproved >= bill.amount) {
    newStatus = "paid";
    if (!paidAt) paidAt = new Date().toISOString();
  } else if (hasPendingReview) {
    newStatus = "pending_review";
  }

  await supabase.from("monthly_bills").update({ status: newStatus, paid_at: paidAt }).eq("id", billId);
}
