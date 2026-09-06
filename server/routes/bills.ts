/**
 * Bills Routes
 * /api/bills/create, /api/bills/delete-cycle
 */

import { Router } from "express";
import { supabase } from "../config/supabase";
import { createNotification } from "../services/notificationService";
import { writeLog } from "../services/logService";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Create Monthly Bills
router.post("/bills/create", asyncHandler(async (req, res) => {
  const month = req.body.month !== undefined ? Number(req.body.month) : undefined;
  const year = req.body.year !== undefined ? Number(req.body.year) : undefined;
  const dueDate = req.body.dueDate || req.body.due_date || req.body.duedate || "สิ้นเดือน";
  const userId = req.body.userId || req.body.user_id || "system";

  if (month === undefined || year === undefined || isNaN(month) || isNaN(year)) {
    return res.status(400).json({ error: "กรุณาระบุเดือนและปีของรอบบิลให้ถูกต้องค่ะ" });
  }

  const { data: activeStudents } = await supabase.from("users").select("*").eq("is_active", true);
  const { data: existingBills } = await supabase.from("monthly_bills").select("user_id").eq("month", Number(month)).eq("year", Number(year));
  const { data: settingsArr } = await supabase.from("settings").select("monthly_fee").eq("id", "main").single();
  const monthlyFee = settingsArr?.monthly_fee || 150;

  const existingUserIds = new Set((existingBills || []).map((b: { user_id: string }) => b.user_id));
  const newBills: Array<{
    id: string; user_id: string; month: number; year: number;
    amount: number; status: string; due_date: string; created_at: string;
  }> = [];

  for (const student of (activeStudents || [])) {
    if (!existingUserIds.has(student.id)) {
      const billId = `bill_${student.student_id}_${month}_${year}`;
      newBills.push({
        id: billId, user_id: student.id, month: Number(month), year: Number(year),
        amount: monthlyFee, status: "pending", due_date: dueDate, created_at: new Date().toISOString()
      });
    }
  }

  if (newBills.length > 0) {
    await supabase.from("monthly_bills").insert(newBills);
    for (const bill of newBills) {
      await createNotification(bill.user_id, "แจ้งเตือนบิลค่าบำรุงกองทุนใหม่", `บิลค่าบำรุงกองทุนเดือน ${month}/${year} จำนวน ${monthlyFee} บาท ครบกำหนดชำระในวันที่ ${dueDate}`, "bill", bill.id, "bill");
    }
    await writeLog(userId, "create_monthly_bills", "monthly_bills", `${month}/${year}`, { count: newBills.length });
  }

  res.json({ success: true, createdCount: newBills.length });
}));

// Delete bills cycle
router.post("/bills/delete-cycle", asyncHandler(async (req, res) => {
  const month = req.body.month !== undefined ? Number(req.body.month) : undefined;
  const year = req.body.year !== undefined ? Number(req.body.year) : undefined;
  const userId = req.body.userId || req.body.user_id || "system";

  if (month === undefined || year === undefined || isNaN(month) || isNaN(year)) {
    return res.status(400).json({ error: "กรุณาระบุเดือนและปีของรอบบิลที่ต้องการลบค่ะ" });
  }

  const { data: billsToDelete } = await supabase.from("monthly_bills").select("id").eq("month", Number(month)).eq("year", Number(year));
  if (!billsToDelete || billsToDelete.length === 0) return res.status(444).json({ error: "ไม่พบบิลของเดือนและปีที่ระบุในระบบ" });

  const billIds = billsToDelete.map((b: { id: string }) => b.id);
  await supabase.from("payments").delete().in("bill_id", billIds);
  await supabase.from("monthly_bills").delete().eq("month", Number(month)).eq("year", Number(year));

  await writeLog(userId, "delete_monthly_bills", "monthly_bills", `${month}/${year}`, { count: billsToDelete.length });
  res.json({ success: true, deletedCount: billsToDelete.length });
}));

export default router;
