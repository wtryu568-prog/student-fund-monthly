/**
 * Authentication Routes
 * /api/auth/* and /api/treasurer/resolve-reset-password
 */

import { Router } from "express";
import { supabase } from "../config/supabase";
import { convertKeysToCamel } from "../utils/camelCase";
import { createNotification } from "../services/notificationService";
import { writeLog } from "../services/logService";
import { asyncHandler } from "../middleware/errorHandler";
import { authRateLimiter } from "../middleware/security";
import { hashPassword, verifyPassword } from "../utils/crypto";
import type { BasicUser } from "../types/server";

const router = Router();

// Login
router.post("/auth/login", authRateLimiter, asyncHandler(async (req, res) => {
  const { studentId, password } = req.body;
  if (!studentId || !password) {
    return res.status(400).json({ error: "กรุณากรอกรหัสนักศึกษาและรหัสผ่าน" });
  }

  const { data: users, error } = await supabase.from("users").select("*");
  if (error) return res.status(500).json({ error: error.message });

  const user = (users as BasicUser[] || []).find((u: BasicUser) => {
    const last3Digits = u.student_id ? u.student_id.slice(-3) : "";
    const isIdMatch = studentId === last3Digits || studentId === u.student_id;
    return isIdMatch && verifyPassword(password, u.password || "");
  });

  if (!user) {
    return res.status(401).json({ error: "รหัสท้ายนักศึกษาหรือรหัสผ่านไม่ถูกต้อง" });
  }

  // Auto-migrate legacy plain-text password to hashed PBKDF2 password
  if (user.password && !user.password.startsWith("pbkdf2:")) {
    const hashed = hashPassword(password);
    await supabase.from("users").update({ password: hashed, updated_at: new Date().toISOString() }).eq("id", user.id);
    user.password = hashed;
    console.log(`[Auth] Auto-migrated user ${user.id} to PBKDF2 hashed password.`);
  }

  res.json({ success: true, user: convertKeysToCamel(user) });
}));

// Email Login
router.post("/auth/email-login", authRateLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "กรุณาระบุอีเมลมหาลัยในการเข้าสู่ระบบค่ะ" });

  const { data: users } = await supabase.from("users").select("*").ilike("email", email.trim());
  const user = users && users.length > 0 ? users[0] : null;
  if (!user) return res.status(404).json({ error: "ไม่พบข้อมูลอีเมลนี้ในระบบกองทุนห้องค่ะ กรุณาป้อนรหัสนักศึกษาเข้าสู่ระบบแบบปกติ แล้วเข้าไปอัปเดตอีเมลมหาลัยของท่านที่เมนูข้อมูลส่วนตัวก่อนนะคะ" });

  res.json({ success: true, user: convertKeysToCamel(user) });
}));

// Change Password
router.post("/auth/change-password", authRateLimiter, asyncHandler(async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });

  const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
  if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });
  if (!verifyPassword(oldPassword, user.password || "")) return res.status(400).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });

  const hashedNew = hashPassword(newPassword);
  await supabase.from("users").update({ password: hashedNew, updated_at: new Date().toISOString() }).eq("id", userId);
  res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จแล้ว" });
}));

// Forgot Password
router.post("/auth/forgot-password", authRateLimiter, asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: "กรุณาระบุรหัสนักศึกษาหรือเลข 3 ตัวท้าย" });

  const { data: users } = await supabase.from("users").select("*");
  const user = (users as BasicUser[] || []).find((u: BasicUser) => {
    const last3Digits = u.student_id ? u.student_id.slice(-3) : "";
    return studentId === last3Digits || studentId === u.student_id;
  });
  if (!user) return res.status(404).json({ error: "ไม่พบข้อมูลรหัสนักศึกษาของท่านในระบบ" });

  const { data: existing } = await supabase.from("password_resets").select("*").eq("user_id", user.id).eq("status", "pending");
  if (existing && existing.length > 0) {
    return res.json({ success: true, message: "ท่านได้ส่งคำขอรีเซ็ตรหัสผ่านไว้แล้ว โปรดแจ้งเตือนเหรัญญิกเพื่อให้ดำเนินการค่ะ" });
  }

  const newRequest = {
    id: `reset_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    user_id: user.id,
    student_id: user.student_id,
    full_name: user.full_name,
    classroom: user.classroom || "ห้อง 1",
    status: "pending",
    requested_at: new Date().toISOString()
  };
  await supabase.from("password_resets").insert(newRequest);

  const { data: treasurers } = await supabase.from("users").select("id").in("role", ["treasurer", "committee", "leader"]);
  for (const t of (treasurers || [])) {
    await createNotification(t.id, "🔔 คำขอรีเซ็ตรหัสผ่านใหม่", `เพื่อน ${user.full_name} (${user.student_id}) ได้ส่งคำขอรีเซ็ตรหัสผ่านกลับไปเป็นค่าเริ่มต้น`, "petition");
  }

  res.json({ success: true, message: "ส่งคำขอรีเซ็ตรหัสผ่านไปยังเหรัญญิกเรียบร้อยแล้วค่ะ โปรดติดต่อเหรัญญิกเพื่อทำรายการต่อนะคะ" });
}));

// Treasurer: Resolve Reset Password
router.post("/treasurer/resolve-reset-password", asyncHandler(async (req, res) => {
  const { resetId, treasurerId } = req.body;
  if (!resetId || !treasurerId) return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });

  const { data: actingUser } = await supabase.from("users").select("*").eq("id", treasurerId).single();
  if (!actingUser || actingUser.role !== "treasurer") return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ (เฉพาะเหรัญญิกเท่านั้น)" });

  const { data: request } = await supabase.from("password_resets").select("*").eq("id", resetId).single();
  if (!request) return res.status(404).json({ error: "ไม่พบคำขอรีเซ็ตรหัสผ่านนี้" });

  const hashedDefault = hashPassword("123456");
  await supabase.from("users").update({ password: hashedDefault, updated_at: new Date().toISOString() }).eq("id", request.user_id);
  await supabase.from("password_resets").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: treasurerId }).eq("id", resetId);

  await createNotification(request.user_id, "🔑 รีเซ็ตรหัสผ่านสำเร็จ", "เหรัญญิกได้รีเซ็ตรหัสผ่านของท่านกลับไปเป็น '123456' เรียบร้อยแล้วค่ะ โปรดเข้าสู่ระบบและรีบเปลี่ยนรหัสผ่านเพื่อความปลอดภัยนะคะ", "system");
  await writeLog(treasurerId, "reset_user_password", "user", request.user_id, { message: `เหรัญญิก ${actingUser.full_name} ได้รีเซ็ตรหัสผ่านของ ${request.full_name} กลับเป็น 123456` });

  res.json({ success: true, message: "รีเซ็ตรหัสผ่านเป็น 123456 สำเร็จเรียบร้อยแล้วค่ะ!" });
}));

export default router;
