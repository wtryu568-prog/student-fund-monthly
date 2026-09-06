/**
 * System Routes
 * /api/system/diagnostics, /api/system/reset, /api/system/sync-cloud, /api/system/generate-summary, /api/system/log-error
 * /api/state, /api/settings, /api/health
 */

import { Router } from "express";
import { supabase, testSupabaseConnection, dbConnected, dbSyncError } from "../config/supabase";
import { ENV } from "../config/env";
import { convertKeysToCamel } from "../utils/camelCase";
import { getMonthThaiName } from "../utils/thaiMonths";
import { loadFullState } from "../services/stateLoader";
import { writeLog } from "../services/logService";
import { asyncHandler } from "../middleware/errorHandler";
import { getAccessToken as getDriveAccessToken, parseFolderId, getOrCreateFolder, uploadFile } from "../services/googleDriveService";
import { REAL_STUDENTS } from "../data/seedStudents";
import { User, MonthlyBill, Transaction } from "../../src/types";
import JSZip from "jszip";

const router = Router();

// Health check endpoint for Cloud Run
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), dbConnected });
});

// System Diagnostics
router.get("/system/diagnostics", asyncHandler(async (req, res) => {
  const connected = await testSupabaseConnection();
  const { count: usersCount } = await supabase.from("users").select("*", { count: "exact", head: true });
  const { count: billsCount } = await supabase.from("monthly_bills").select("*", { count: "exact", head: true });
  const { count: paymentsCount } = await supabase.from("payments").select("*", { count: "exact", head: true });
  const { count: txCount } = await supabase.from("transactions").select("*", { count: "exact", head: true });
  const { count: actCount } = await supabase.from("activities").select("*", { count: "exact", head: true });
  const { count: petCount } = await supabase.from("petitions").select("*", { count: "exact", head: true });

  // Count raw base64 images in images table
  const { count: rawBase64ImagesCount } = await supabase
    .from("images")
    .select("id", { count: "exact", head: true })
    .not("base64", "like", "google_drive:%");

  // Count embedded market cost items base64 notes
  const { count: rawBase64MarketNotesCount } = await supabase
    .from("market_items")
    .select("id", { count: "exact", head: true })
    .like("note", "SLIP_URL:data:image/%");

  const pendingMigrationCount = (rawBase64ImagesCount || 0) + (rawBase64MarketNotesCount || 0);

  let googleDriveConnected = false;
  let googleDriveError = "";
  try {
    const token = await getDriveAccessToken();
    googleDriveConnected = !!token;
  } catch (err: any) {
    googleDriveError = err.message;
  }

  res.json({
    firebase: { connected, error: dbSyncError, databaseId: "Supabase PostgreSQL", projectId: "student_fund" },
    mongodb: { connected, error: dbSyncError, database: "student_fund", uri: ENV.SUPABASE_URL ? "configured" : "not-configured" },
    localFile: { exists: false, sizeBytes: 0, path: "N/A (using Supabase)" },
    googleDrive: { 
      connected: googleDriveConnected, 
      error: googleDriveError, 
      rootFolderLink: ENV.GOOGLE_DRIVE_ROOT_FOLDER_LINK || "not-configured",
      pendingMigrationCount
    },
    counts: { users: usersCount || 0, bills: billsCount || 0, payments: paymentsCount || 0, transactions: txCount || 0, activities: actCount || 0, petitions: petCount || 0 }
  });
}));

// Client Error Logger Endpoint
router.post("/system/log-error", asyncHandler(async (req, res) => {
  const { errorMsg, componentStack, userId, url } = req.body;
  const logId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await supabase.from("logs").insert({
    id: logId,
    user_id: userId || "anonymous",
    action: "client_error",
    target_type: "system",
    target_id: url || "client_page",
    details: {
      message: errorMsg || "Unknown React error",
      stack: componentStack || "",
      userAgent: req.headers["user-agent"] || "unknown",
      ip: req.ip || ""
    },
    created_at: new Date().toISOString()
  });
  res.json({ success: true, logId });
}));

// Generate Summary
router.post("/system/generate-summary", asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const state = await loadFullState();
  const dateReadable = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });
  const totalBalance = (state.transactions || []).reduce((sum: number, tx: Transaction) => sum + (tx.type === "income" ? tx.amount : -tx.amount), 0);
  const totalIncome = (state.transactions || []).filter((tx: Transaction) => tx.type === "income").reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
  const totalExpense = (state.transactions || []).filter((tx: Transaction) => tx.type === "expense").reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);

  let latestCycle = { month: 6, year: 2569 };
  if (state.monthlyBills.length > 0) {
    const sorted = [...state.monthlyBills].sort((a: MonthlyBill, b: MonthlyBill) => b.year !== a.year ? b.year - a.year : b.month - a.month);
    latestCycle = { month: sorted[0].month, year: sorted[0].year };
  }
  const currentBills = state.monthlyBills.filter((b: MonthlyBill) => b.month === latestCycle.month && b.year === latestCycle.year);
  const paidMembers = currentBills.filter((b: MonthlyBill) => b.status === "paid").map((b: MonthlyBill) => { const u = state.users.find((user: User) => user.id === b.userId); return u ? `${u.fullName} (${u.nickname || ""})` : "ไม่พบ"; });
  const pendingReviewMembers = currentBills.filter((b: MonthlyBill) => b.status === "pending_review").map((b: MonthlyBill) => { const u = state.users.find((user: User) => user.id === b.userId); return u ? `${u.fullName} (${u.nickname || ""})` : "ไม่พบ"; });
  const unpaidMembers = currentBills.filter((b: MonthlyBill) => b.status === "pending").map((b: MonthlyBill) => { const u = state.users.find((user: User) => user.id === b.userId); return u ? `${u.fullName} (${u.nickname || ""})` : "ไม่พบ"; });

  const fundName = state.settings?.fundName || "เงินเก็บรุ่น";
  let summaryText = `🌟 รายงานสรุปบัญชีและสถานะกองทุน 🌟\n🏫 กองทุน: ${fundName}\n📅 อัปเดต ณ วันที่: ${dateReadable}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  summaryText += `💵 [สรุปยอดบัญชีรับ-จ่ายรวม]\n💰 ยอดเงินคงเหลือสุทธิ: ฿${totalBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n📈 รายรับสะสมทั้งหมด: ฿${totalIncome.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n📉 รายจ่ายสะสมทั้งหมด: ฿${totalExpense.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n\n`;
  summaryText += `🔔 [สถานะการจ่ายเงินค่าบำรุงรายเดือน]\nรอบบิลล่าสุด: เดือน${getMonthThaiName(latestCycle.month)} ${latestCycle.year}\n\n`;
  summaryText += `✅ ชำระเงินแล้ว (${paidMembers.length} คน):\n${paidMembers.length > 0 ? paidMembers.map((n, i) => `  ${i + 1}. ${n}`).join("\n") : "  - ยังไม่มีการชำระเงิน"}\n\n`;
  summaryText += `⏳ รอตรวจสอบสลิป (${pendingReviewMembers.length} คน):\n${pendingReviewMembers.length > 0 ? pendingReviewMembers.map((n, i) => `  ${i + 1}. ${n}`).join("\n") : "  - ไม่มีคิวรอยืนยัน"}\n\n`;
  summaryText += `❌ ยังไม่ได้ชำระเงิน (${unpaidMembers.length} คน):\n${unpaidMembers.length > 0 ? unpaidMembers.map((n, i) => `  ${i + 1}. ${n}`).join("\n") : "  - สมาชิกทุกคนชำระครบถ้วนแล้ว! 🎉"}`;

  if (userId) await writeLog(userId, "generate_summary_backup", "system", undefined, { dateReadable });
  res.json({ success: true, summaryText, dateReadable });
}));

// Download all slips and receipts as a ZIP archive down to local computer
router.post("/system/download-all-slips", asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  const allowedRoles = ["treasurer", "president", "committee", "teacher", "admin", "leader"];
  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: "เฉพาะเหรัญญิกและคณะกรรมการเท่านั้นที่มีสิทธิ์ดาวน์โหลดรูปภาพสลิปทั้งหมด" });
  }

  const zip = new JSZip();

  // Fetch image records and associated metadata
  const { data: rawImages } = await supabase.from("images").select("id, base64");
  const { data: payments } = await supabase.from("payments").select("*");
  const { data: users } = await supabase.from("users").select("id, full_name, student_id");
  const { data: bills } = await supabase.from("monthly_bills").select("id, month, year");
  const { data: marketItems } = await supabase.from("market_items").select("*");
  const { data: marketWeeks } = await supabase.from("market_weeks").select("*");

  const dateStr = new Date().toISOString().split("T")[0];
  let fileCount = 0;

  const getBufferFromBase64 = (str: string): { buffer: Buffer; ext: string } | null => {
    if (!str || typeof str !== "string") return null;
    let clean = str;
    let ext = "jpg";

    if (clean.includes("|NOTE:")) {
      clean = clean.split("|NOTE:")[0];
    }
    if (clean.startsWith("SLIP_URL:")) {
      clean = clean.replace("SLIP_URL:", "");
    }

    if (clean.startsWith("data:image/")) {
      const match = clean.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (match) {
        ext = match[1] === "jpeg" ? "jpg" : match[1];
        return { buffer: Buffer.from(match[2], "base64"), ext };
      }
    } else if (!clean.startsWith("http") && !clean.startsWith("google_drive:") && !clean.startsWith("/")) {
      return { buffer: Buffer.from(clean, "base64"), ext: "jpg" };
    }
    return null;
  };

  const processedImageIds = new Set<string>();

  // 1. Package Monthly Bills Slips
  for (const p of (payments || [])) {
    if (!p.slip_url || p.slip_url === "cash" || p.slip_url === "deleted") continue;

    let imgData: { buffer: Buffer; ext: string } | null = null;

    if (p.slip_url.startsWith("/api/images/")) {
      const imgId = p.slip_url.replace("/api/images/", "").split("|")[0];
      processedImageIds.add(imgId);
      const imgRow = (rawImages || []).find(i => i.id === imgId);
      if (imgRow?.base64) {
        imgData = getBufferFromBase64(imgRow.base64);
      }
    } else if (p.slip_url.startsWith("data:image/")) {
      imgData = getBufferFromBase64(p.slip_url);
    }

    if (imgData) {
      const bill = (bills || []).find(b => b.id === p.bill_id);
      const payUser = (users || []).find(u => u.id === p.user_id);
      const month = bill?.month || new Date().getMonth() + 1;
      const year = bill?.year || 2569;
      const studentId = payUser?.student_id || "unknown";
      const fullName = (payUser?.full_name || "member").replace(/[\s\/\\]+/g, "_");
      const amount = p.amount || 0;

      const folderPath = `สลิปค่าบำรุงรายเดือน/ปี_${year}/เดือน_${String(month).padStart(2, "0")}`;
      const fileName = `สลิป_${studentId}_${fullName}_${amount}บาท.${imgData.ext}`;
      zip.folder(folderPath)?.file(fileName, imgData.buffer);
      fileCount++;
    }
  }

  // 2. Package Wednesday Market Receipt Slips
  for (const item of (marketItems || [])) {
    if (!item.note || !item.note.includes("SLIP_URL:")) continue;

    const parts = item.note.split("|NOTE:");
    const rawSlipUrl = parts[0].replace("SLIP_URL:", "");
    let imgData: { buffer: Buffer; ext: string } | null = null;

    if (rawSlipUrl.startsWith("/api/images/")) {
      const imgId = rawSlipUrl.replace("/api/images/", "");
      processedImageIds.add(imgId);
      const imgRow = (rawImages || []).find(i => i.id === imgId);
      if (imgRow?.base64) {
        imgData = getBufferFromBase64(imgRow.base64);
      }
    } else if (rawSlipUrl.startsWith("data:image/")) {
      imgData = getBufferFromBase64(rawSlipUrl);
    }

    if (imgData) {
      const week = (marketWeeks || []).find(w => w.id === item.market_week_id);
      const weekDate = week?.week_date || dateStr;
      const teamName = (week?.team_name || "กลุ่มจำหน่ายสินค้า").replace(/[\s\/\\]+/g, "_");
      const cleanItemName = (item.item_name || "สินค้า").replace(/[\s\/\\]+/g, "_");

      const folderPath = `หลักฐานตลาดวันพุธ/รอบ_${weekDate}_${teamName}`;
      const fileName = `ใบเสร็จ_${cleanItemName}_${item.amount}บาท.${imgData.ext}`;
      zip.folder(folderPath)?.file(fileName, imgData.buffer);
      fileCount++;
    }
  }

  // 3. Package Any Remaining Unmapped Base64 Images
  for (const img of (rawImages || [])) {
    if (processedImageIds.has(img.id) || !img.base64 || img.base64.startsWith("google_drive:")) continue;
    const imgData = getBufferFromBase64(img.base64);
    if (imgData) {
      zip.folder("รูปภาพอื่นๆในระบบ")?.file(`รูปภาพ_${img.id}.${imgData.ext}`);
      fileCount++;
    }
  }

  // Add Summary Manifest File
  const manifest = `================================================
รายงานสรุปการส่งออกรูปภาพสลิปและหลักฐานทั้งหมด
วันที่ดาวน์โหลด: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
ผู้ส่งออก: ${userId}
จำนวนรูปภาพที่รวมเข้า ZIP: ${fileCount} รายการ
================================================
คำแนะนำ:
หลังจากตรวจสอบไฟล์ ZIP ในเครื่องคอมพิวเตอร์ของคุณเรียบร้อยแล้ว
คุณสามารถกดปุ่ม "เคลียร์รูปภาพออกจากระบบ (Purge Storage)" 
ในหน้าแอดมินเพื่อลบรูปภาพสลิปออกจากฐานข้อมูล 
เพื่อช่วยให้แอดมินใช้งานแอปได้อย่างเบาหวิวและรวดเร็วตลอด 2.5 ปีค่ะ!
================================================`;

  zip.file("สรุปรายการหลักฐานสลิปทั้งหมด.txt", manifest);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  await writeLog(userId, "download_all_slips_zip", "system", undefined, { fileCount, sizeBytes: zipBuffer.length });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="student_fund_slips_${dateStr}.zip"`);
  res.send(zipBuffer);
}));

// Purge raw Base64 images from DB to free up storage space 100%
router.post("/system/purge-base64-slips", asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  const allowedRoles = ["treasurer", "president", "committee", "teacher", "admin", "leader"];
  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: "เฉพาะเหรัญญิกและคณะกรรมการเท่านั้นที่มีสิทธิ์สั่งเคลียร์รูปภาพจากระบบ" });
  }

  // Find all images in 'images' table that are raw Base64 (not starting with google_drive:)
  const { data: rawImages, error: fetchErr } = await supabase
    .from("images")
    .select("id, base64")
    .not("base64", "like", "google_drive:%");

  if (fetchErr) throw fetchErr;

  const count = rawImages?.length || 0;
  const idsToPurge = (rawImages || []).map(img => img.id);

  if (idsToPurge.length > 0) {
    const { error: deleteErr } = await supabase.from("images").delete().in("id", idsToPurge);
    if (deleteErr) throw deleteErr;

    // Update any payments pointing to these purged image ids
    for (const id of idsToPurge) {
      await supabase.from("payments").update({ slip_url: "deleted" }).eq("slip_url", `/api/images/${id}`);
    }
  }

  // Also clean up any direct data:image URI strings stored directly in payments.slip_url
  const { data: dataUriPayments } = await supabase
    .from("payments")
    .select("id")
    .like("slip_url", "data:image%");

  if (dataUriPayments && dataUriPayments.length > 0) {
    const payIds = dataUriPayments.map(p => p.id);
    await supabase.from("payments").update({ slip_url: "deleted" }).in("id", payIds);
  }

  const totalPurged = count + (dataUriPayments?.length || 0);

  await writeLog(userId, "purge_base64_slips", "system", undefined, { purgedCount: totalPurged });

  res.json({
    success: true,
    purgedCount: totalPurged,
    message: totalPurged > 0 
      ? `🎉 เคลียร์รูปภาพ Base64 ออกจากคลาวด์ DB สำเร็จเรียบร้อยจำนวน ${totalPurged} รูป! ฐานข้อมูลว่างเปล่าและเบาหวิว 100% แล้วค่ะ`
      : "ไม่มีรูปภาพ Base64 ตกค้างในระบบแล้วค่ะ (ฐานข้อมูลว่างเปล่าและเชื่อมต่อ Google Drive 100%)"
  });
}));

// Purge all or old slips from system (deletes from images table and sets payment slip_url to 'deleted')
router.post("/system/purge-all-slips", asyncHandler(async (req, res) => {
  const { userId, mode = "all" } = req.body; // mode: 'all' | 'older_30_days' | 'base64_only'
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  const allowedRoles = ["treasurer", "president", "committee", "teacher", "admin", "leader"];
  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: "เฉพาะเหรัญญิกและคณะกรรมการเท่านั้นที่มีสิทธิ์สั่งเคลียร์รูปภาพจากระบบ" });
  }

  let paymentQuery = supabase.from("payments").select("id, slip_url, created_at");
  if (mode === "older_30_days") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    paymentQuery = paymentQuery.lt("created_at", thirtyDaysAgo.toISOString());
  }

  const { data: targetPayments, error: payErr } = await paymentQuery;
  if (payErr) throw payErr;

  const validPayments = (targetPayments || []).filter(p => p.slip_url && p.slip_url !== "cash" && p.slip_url !== "deleted" && p.slip_url !== "");
  const imageIdsToDelete: string[] = [];
  const paymentIdsToUpdate: string[] = [];

  for (const p of validPayments) {
    if (p.slip_url.startsWith("/api/images/")) {
      imageIdsToDelete.push(p.slip_url.replace("/api/images/", ""));
      paymentIdsToUpdate.push(p.id);
    } else if (p.slip_url.startsWith("data:image")) {
      paymentIdsToUpdate.push(p.id);
    } else if (mode === "all" && (p.slip_url.startsWith("google_drive:") || p.slip_url.startsWith("http"))) {
      paymentIdsToUpdate.push(p.id);
    }
  }

  let deletedImagesCount = 0;
  if (imageIdsToDelete.length > 0) {
    const { error: delImgErr } = await supabase.from("images").delete().in("id", imageIdsToDelete);
    if (!delImgErr) deletedImagesCount = imageIdsToDelete.length;
  }

  if (paymentIdsToUpdate.length > 0) {
    await supabase.from("payments").update({ slip_url: "deleted" }).in("id", paymentIdsToUpdate);
  }

  await writeLog(userId, "purge_all_slips", "system", undefined, { mode, clearedPayments: paymentIdsToUpdate.length, deletedImages: deletedImagesCount });

  res.json({
    success: true,
    clearedCount: paymentIdsToUpdate.length,
    deletedImagesCount,
    message: `🧹 เคลียร์หลักฐานสลิปสำเร็จจำนวน ${paymentIdsToUpdate.length} รายการ (ประวัติการชำระเงินและบัญชีคงอยู่ครบถ้วน 100%)`
  });
}));

// Clear/Delete single slip by payment ID
router.post("/system/clear-single-slip", asyncHandler(async (req, res) => {
  const { userId, paymentId } = req.body;
  if (!userId || !paymentId) return res.status(400).json({ error: "Missing userId or paymentId" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  const allowedRoles = ["treasurer", "president", "committee", "teacher", "admin", "leader"];
  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: "เฉพาะเหรัญญิกและคณะกรรมการเท่านั้นที่มีสิทธิ์ลบรูปสลิป" });
  }

  const { data: payment } = await supabase.from("payments").select("id, slip_url").eq("id", paymentId).single();
  if (!payment) return res.status(404).json({ error: "ไม่พบรายการชำระเงินนี้" });

  if (payment.slip_url && payment.slip_url.startsWith("/api/images/")) {
    const imgId = payment.slip_url.replace("/api/images/", "");
    await supabase.from("images").delete().eq("id", imgId);
  }

  await supabase.from("payments").update({ slip_url: "deleted" }).eq("id", paymentId);
  await writeLog(userId, "clear_single_slip", "payment", paymentId);

  res.json({ success: true, message: "ลบและเคลียร์ไฟล์รูปสลิปของรายการนี้เรียบร้อยแล้วค่ะ" });
}));


// Force sync
router.post("/system/sync-cloud", asyncHandler(async (req, res) => {
  const connected = await testSupabaseConnection();
  if (!connected) return res.status(500).json({ error: "ไม่สามารถเชื่อมต่อ Supabase ได้" });
  res.json({ success: true, message: "ข้อมูลจาก Supabase ถูกต้องและพร้อมใช้งานแล้วค่ะ! 🔄" });
}));

// System Reset
router.post("/system/reset", asyncHandler(async (req, res) => {
  const { userId, keepUsers, keepSettings } = req.body;
  if (!keepUsers) {
    await supabase.from("users").delete().neq("id", "");
    const seedUsers = REAL_STUDENTS.map(item => {
      const studentId = `169214210${item.idSuffix}`;
      return {
        id: `usr_${studentId}`, student_id: studentId, full_name: item.name, nickname: item.nickname,
        email: studentId === "169214210002" ? "kritsana.khw@rmutsvmail.com" : `${studentId}@student.university.ac.th`,
        role: item.role, position: item.pos, phone: "", password: "123456", is_active: true, classroom: item.classroom,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
    });
    await supabase.from("users").upsert(seedUsers, { onConflict: "id" });
  } else {
    await supabase.from("users").update({ password: "123456" }).neq("id", "");
  }

  if (!keepSettings) {
    await supabase.from("settings").delete().neq("id", "");
    await supabase.from("settings").upsert({
      id: "main", fund_name: "เงินเก็บTns รุ่น06", monthly_fee: 150,
      promptpay_number: "081-234-5678", promptpay_name: "นภาวรรณ แก้วดี (เหรัญญิกกองทุน)",
      promptpay_qr_url: "", bank_name: "พร้อมเพย์"
    }, { onConflict: "id" });
  }

  await Promise.all([
    supabase.from("monthly_bills").delete().neq("id", ""),
    supabase.from("payments").delete().neq("id", ""),
    supabase.from("transactions").delete().neq("id", ""),
    supabase.from("market_items").delete().neq("id", ""),
    supabase.from("market_teams").delete().neq("id", ""),
    supabase.from("market_weeks").delete().neq("id", ""),
    supabase.from("activities").delete().neq("id", ""),
    supabase.from("budget_requests").delete().neq("id", ""),
    supabase.from("announcements").delete().neq("id", ""),
    supabase.from("notifications").delete().neq("id", ""),
    supabase.from("logs").delete().neq("id", ""),
    supabase.from("petitions").delete().neq("id", ""),
    supabase.from("password_resets").delete().neq("id", ""),
  ]);

  await writeLog(userId || "usr_169214210002", "reset_system", "system", undefined, { message: "รีเซ็ตข้อมูลระบบเป็นค่าเริ่มต้น", keepUsers, keepSettings });
  res.json({ success: true, message: "รีเซ็ตระบบสำเร็จแล้วค่ะ!" });
}));

// GET State - Main data endpoint
router.get("/state", asyncHandler(async (req, res) => {
  const state = await loadFullState();
  res.json(state);
}));

// Update Settings
router.post("/settings", asyncHandler(async (req, res) => {
  const { fundName, monthlyFee, promptpayNumber, promptpayName, promptpayQrUrl, bankName, userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const numericFee = Number(monthlyFee);
  const settingsData = {
    id: "main", fund_name: fundName, monthly_fee: numericFee, promptpay_number: promptpayNumber,
    promptpay_name: promptpayName, promptpay_qr_url: promptpayQrUrl || "", bank_name: bankName || "พร้อมเพย์",
    updated_at: new Date().toISOString()
  };
  await supabase.from("settings").upsert(settingsData, { onConflict: "id" });
  await supabase.from("monthly_bills").update({ amount: numericFee }).eq("status", "pending");

  await writeLog(userId, "update_settings", "settings", "global", settingsData);
  const { data: updatedSettings } = await supabase.from("settings").select("*").eq("id", "main").single();
  res.json({ success: true, settings: convertKeysToCamel(updatedSettings) });
}));

// Supabase config for client-side realtime
router.get("/supabase-config", (req, res) => {
  res.json({
    supabaseUrl: ENV.SUPABASE_URL,
    supabaseKey: ENV.SUPABASE_SERVICE_KEY,
  });
});

export default router;
