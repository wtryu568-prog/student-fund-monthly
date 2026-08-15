/**
 * Members Routes
 * /api/members/update, /api/members/add, /api/members/delete
 */

import { Router } from "express";
import { supabase } from "../config/supabase";
import { convertKeysToCamel } from "../utils/camelCase";
import { writeLog } from "../services/logService";
import { asyncHandler } from "../middleware/errorHandler";
import { hashPassword } from "../utils/crypto";

const router = Router();

// Members - Update
router.post("/members/update", asyncHandler(async (req, res) => {
  const { targetUserId, role, position, isActive, userId, fullName, nickname, email, phone, classroom } = req.body;
  if (!targetUserId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: actingUser } = await supabase.from("users").select("*").eq("id", userId).single();
  const { data: targetUser } = await supabase.from("users").select("*").eq("id", targetUserId).single();
  if (!actingUser || !targetUser) return res.status(404).json({ error: "User not found" });

  const isSelf = targetUserId === userId;
  let hasEditPermission = isSelf;
  if (actingUser.role === "treasurer") hasEditPermission = true;
  else if (actingUser.role === "leader" && actingUser.classroom === targetUser.classroom) hasEditPermission = true;
  if (!hasEditPermission) return res.status(403).json({ error: "ไม่มีสิทธิ์แก้ไขข้อมูลคนนี้" });

  const isChangingPrivileged = role !== undefined || position !== undefined || isActive !== undefined || classroom !== undefined;
  if (isChangingPrivileged && actingUser.role !== "treasurer") return res.status(403).json({ error: "ไม่มีสิทธิ์ปรับแต่งบทบาทสิทธิ์/ตำแหน่ง/ห้องเรียน" });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) updates.full_name = fullName;
  if (nickname !== undefined) updates.nickname = nickname;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (actingUser.role === "treasurer") {
    if (role !== undefined) updates.role = role;
    if (position !== undefined) updates.position = position;
    if (isActive !== undefined) updates.is_active = isActive;
    if (classroom !== undefined) updates.classroom = classroom;
  }

  await supabase.from("users").update(updates).eq("id", targetUserId);
  await writeLog(userId, "update_member_profile", "users", targetUserId, { role, position, isActive, fullName, nickname });
  const { data: updated } = await supabase.from("users").select("*").eq("id", targetUserId).single();
  res.json({ success: true, user: convertKeysToCamel(updated) });
}));

// Members - Add
router.post("/members/add", asyncHandler(async (req, res) => {
  const { studentId, fullName, nickname, email, phone, role, position, classroom, userId } = req.body;
  if (!studentId || !fullName || !userId) return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });

  const { data: creator } = await supabase.from("users").select("*").eq("id", userId).single();
  if (!creator) return res.status(403).json({ error: "User unauthorized" });
  if (creator.role !== "treasurer" && creator.role !== "leader") return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ" });

  const { data: existing } = await supabase.from("users").select("id").eq("student_id", studentId);
  if (existing && existing.length > 0) return res.status(400).json({ error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" });

  let targetClassroom = classroom || "ห้อง 1";
  let targetRole = role || "member";
  if (creator.role === "leader") {
    targetClassroom = creator.classroom || "ห้อง 1";
    targetRole = "member";
  }

  const newUserId = `usr_${studentId}`;
  const hashedDefault = hashPassword("123456");
  const newUser = { id: newUserId, student_id: studentId, full_name: fullName, nickname: nickname || fullName.split(" ")[0], email: email || `${studentId}@student.university.ac.th`, phone: phone || "", role: targetRole, position: position || "นักศึกษาชั้นปีที่ 3", classroom: targetClassroom, is_active: true, password: hashedDefault, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await supabase.from("users").insert(newUser);
  await writeLog(userId, "add_member", "users", newUserId, { fullName, studentId, role: targetRole });
  res.json({ success: true, user: convertKeysToCamel(newUser) });
}));

// Members - Delete
router.post("/members/delete", asyncHandler(async (req, res) => {
  const { targetUserId, userId } = req.body;
  if (!targetUserId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: creator } = await supabase.from("users").select("role").eq("id", userId).single();
  if (!creator || creator.role !== "treasurer") return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ (เฉพาะเหรัญญิกเท่านั้น)" });
  if (targetUserId === userId) return res.status(400).json({ error: "ไม่สามารถลบตัวเองได้" });

  const { data: deletedUser } = await supabase.from("users").select("*").eq("id", targetUserId).single();
  if (!deletedUser) return res.status(404).json({ error: "User not found" });

  const { data: userBills } = await supabase.from("monthly_bills").select("id").eq("user_id", targetUserId);
  const billIds = (userBills || []).map((b: { id: string }) => b.id);
  if (billIds.length > 0) await supabase.from("payments").delete().in("bill_id", billIds);
  await supabase.from("monthly_bills").delete().eq("user_id", targetUserId);
  await supabase.from("payments").delete().eq("user_id", targetUserId);
  await supabase.from("users").delete().eq("id", targetUserId);

  await writeLog(userId, "delete_member", "users", targetUserId, { fullName: deletedUser.full_name, studentId: deletedUser.student_id });
  res.json({ success: true });
}));

export default router;
