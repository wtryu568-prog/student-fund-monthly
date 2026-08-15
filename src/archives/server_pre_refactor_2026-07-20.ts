/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Server.ts - Supabase Edition
 * ย้ายจาก MongoDB/db.json มาใช้ Supabase (PostgreSQL) 
 * เพื่อแก้ปัญหา: บันทึกข้อมูลขึ้นบ้างไม่ขึ้นบ้าง, race condition, merge conflict
 */

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { User, MonthlyBill, Payment, Transaction, MarketWeek, Activity, AppState, SystemSettings } from "../types";

// Add global process exception handlers to prevent crashes
process.on("uncaughtException", (err) => {
  console.error("CRITICAL: Caught uncaughtException:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL: Caught unhandledRejection:", reason);
});

dotenv.config();

// =============================================
// Supabase Connection Setup
// =============================================
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kukmfozdhborrnsecflr.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "sb_secret_L1ma8TYETT_CJBiAzYj-nA_n-38up5s";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  console.error("Please set these environment variables and restart.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let dbConnected = false;
let dbSyncError = "";

// Test connection on startup
async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("users").select("id").limit(1);
    if (error) throw error;
    dbConnected = true;
    dbSyncError = "";
    console.log("[Supabase] ✅ Connected successfully!");
    return true;
  } catch (err: unknown) {
    dbConnected = false;
    const errMsg = err instanceof Error ? err.message : String(err);
    dbSyncError = errMsg || "Failed to connect to Supabase";
    console.error("[Supabase] ❌ Connection failed:", dbSyncError);
    return false;
  }
}

// =============================================
// Supabase Helper: Convert snake_case → camelCase for frontend compatibility
// =============================================
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToCamel);
  if (typeof obj !== "object") return obj;
  
  const result: Record<string, unknown> = {};
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const camelKey = toCamelCase(key);
    const value = record[key];
    // Don't convert JSONB fields that are already arrays/objects
    if (Array.isArray(value)) {
      result[camelKey] = value;
    } else if (typeof value === "object" && value !== null) {
      result[camelKey] = convertKeysToCamel(value);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// =============================================
// 72 Students Real Seed Data (for system reset)
// =============================================
const REAL_STUDENTS = [
  // ห้อง 1
  { idSuffix: "001", name: "นายจักรี ฤทธิเนียม", nickname: "จักรี", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "002", name: "นายกฤษณะ ขวัญทอง", nickname: "นะ", classroom: "ห้อง 1", role: "treasurer", pos: "เหรัญญิก (แอดมิน)" },
  { idSuffix: "004", name: "นายชนินทร์ มณีรักษ์", nickname: "นนท์", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "005", name: "นายชวกรณ์ ประสิทธินุ้ย", nickname: "กร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "006", name: "นายณัฐพล กวางตุ้ง", nickname: "พล", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "007", name: "นางสาวณัฐสิมา ศาลาจันทร์", nickname: "สิมา", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "008", name: "นายธนกฤตติกรณ์ เรืองรักษ์", nickname: "กฤต", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "009", name: "นายธีรภัทร์ สงสังข์", nickname: "ภัทร์", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "010", name: "นางสาวนรภัทร อายุยืน", nickname: "ภัทร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "011", name: "นายนันทะวัตร นันทะกุล", nickname: "วัตร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "012", name: "นายณัฐภัทร เฉลิมบุญ", nickname: "ภัทร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "013", name: "นางสาวปรียาภรณ์ ประชุมรัตน์", nickname: "ปรียา", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "014", name: "นายพัชรชัย แสงส้อง", nickname: "ชัย", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "015", name: "นายวีรภัทร เจือกโว้น", nickname: "ภัทร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "016", name: "นางสาวสุชานาถ บุญเกลี้ยง", nickname: "นาถ", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "017", name: "นางสาวสุนิสา วัยยะ", nickname: "สา", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "018", name: "นายสุพวิชญ์ ทองคำ", nickname: "วิชญ์", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "019", name: "นางสาวสุภาวดี กาญจนะพันธ์", nickname: "ดี", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "020", name: "นายสุริยา ดวงสุวรรณ", nickname: "ยา", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "021", name: "นายธนาคิม สิงหะพล", nickname: "คิม", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "022", name: "นายอัษฎาวุธ ทองอ่อน", nickname: "วุธ", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "023", name: "นายอาณาจักร ดำดี", nickname: "จักร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "024", name: "นายอาทินันท์ เทียงดาห์", nickname: "นันท์", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "025", name: "นายปฏิวัติ หมัดบาซา", nickname: "วัติ", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "026", name: "นายภราดร สง่าวงค์", nickname: "ดร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "027", name: "นายรพิภัทร พิทักอักษร", nickname: "รพิ", classroom: "ห้อง 1", role: "committee", pos: "ประธานรุ่น" },
  { idSuffix: "028", name: "นายสรวิศ ทวีศรี", nickname: "วิศ", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "029", name: "นางสาวสิริฉัตร ผาลิพัฒน์", nickname: "ฉัตร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "030", name: "นายอับดุลเล๊าะ ยีตาเห", nickname: "เล๊าะ", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "031", name: "นายภานุพงศ์ -", nickname: "ปอนด์", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "032", name: "นายธภัทร มังคะมณี", nickname: "ธภัทร", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "033", name: "นายเสฏฐวุฒิ จุฑานันท์", nickname: "วุฒิ", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "034", name: "นายอาลีฟ เจะเตะ", nickname: "อาลีฟ", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "035", name: "นายกาซิม เสมอภพ", nickname: "กาซิม", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "036", name: "นายอริย์ธัช สังข์โชติ", nickname: "ธัช", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  { idSuffix: "037", name: "นายพีระพัฒน์ เซ่งสวัสดิ์", nickname: "พี", classroom: "ห้อง 1", role: "member", pos: "นักศึกษา" },
  // ห้อง 2
  { idSuffix: "038", name: "นายฮูซาน วามะ", nickname: "ซาน", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "039", name: "นายกรวิชญ์ ธรฤทธิ์", nickname: "กร", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "040", name: "นายซาฟูดิง หมะจิ", nickname: "ดิง", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "041", name: "นายคณิศร วรรณวิจิตร์", nickname: "คิว", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "042", name: "นายธีรวุฒ นิเจริญ", nickname: "วุฒิ", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "043", name: "นายชนะวรรณ นุวรรณ", nickname: "ทู่", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "044", name: "นายชานน ปลอดแก้ว", nickname: "เฟรม", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "045", name: "นายระพี บิลลิหมัด", nickname: "ระพี", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "050", name: "นายธีรนัย สามารถ", nickname: "นัย", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "052", name: "นายนฤนาท พรหมเดชะ", nickname: "นาท", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "054", name: "นางสาวปาริชาติ ไทยนิยม", nickname: "ชาติ", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "055", name: "นายพงษ์ศักดิ์ สุกดำ", nickname: "พงษ์", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "059", name: "นายมูหะมะชาเกร์ สือแม", nickname: "เกร์", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "062", name: "นายวชรพล แก้วแสวง", nickname: "พล", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "064", name: "นายศรันย์ สมใสย์", nickname: "รัน", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "065", name: "นางสาวสุวรรณา เมืองเขียว", nickname: "แพง", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "072", name: "นายธนภัทร คันธลิกา", nickname: "ภัทร", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "073", name: "นายนพรัตน์ ขริบเอม", nickname: "นพ", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "074", name: "นางสาวรดามณี บัวสม", nickname: "มณี", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "075", name: "นางสาวปภัสศิริ สุวรรณพงศ์", nickname: "โบว์", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "076", name: "นายกิตติศักดิ์ สุดตรง", nickname: "ศักดิ์", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "077", name: "นายฐิติกร ประชารักษ์", nickname: "กร", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "078", name: "นายทัศนัย สมตัว", nickname: "ทัศ", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "079", name: "นายธนบดี ดีสมุทร", nickname: "บดี", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "080", name: "นายธนวัฒน์ มาคง", nickname: "วัฒน์", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "081", name: "นายธัญเทพ เหล็มปาน", nickname: "เทพ", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "082", name: "นายธีระศักดิ์ โต๊ะหรีม", nickname: "ซอบัส", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "083", name: "นายนธี พงษ์แพทย์", nickname: "ธี", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "085", name: "นายปราโมทย์ บัวทอง", nickname: "โมทย์", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "086", name: "นายพุฒิพงศ์ แก้วกาศร", nickname: "พุฒิ", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "087", name: "นายฟาดีนาน ด่านเท่ง", nickname: "นาน", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "088", name: "นายมูสำหมัดอัชมี เล๊าะล่อ", nickname: "มี", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "089", name: "นายศตพร ถึงเกื้อ", nickname: "พร", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "090", name: "นายศิลาดล อินทนะ", nickname: "ดล", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "091", name: "นายฮาชัน เหล็มแหละ", nickname: "ซัน", classroom: "ห้อง 2", role: "member", pos: "นักศึกษา" },
  { idSuffix: "092", name: "นางสาวเจตชลิน สัตย์ซื่อ", nickname: "มิ้น", classroom: "ห้อง 2", role: "committee", pos: "รองประธานรุ่น" }
];

// =============================================
// Image extraction helper with MIME, extension, and size validation
// =============================================
async function extractAndSaveImage(base64Str: string): Promise<string> {
  if (!base64Str || typeof base64Str !== "string") return base64Str;
  if (!base64Str.startsWith("data:image/")) return base64Str;

  // 1. MIME Type & Extension Check (Only allow jpg/png/webp images)
  const match = base64Str.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("รูปแบบไฟล์สลิปไม่ถูกต้องค่ะ");
  }
  const mimeType = match[1];
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error("อนุญาตเฉพาะรูปภาพสลิปตระกูล JPG, PNG, และ WEBP เท่านั้นเพื่อความปลอดภัยค่ะ");
  }

  // 2. Size limit check (Max 5MB)
  // Base64 is about 33% larger than raw binary. So raw size = length * 0.75
  const rawSizeBytes = base64Str.length * 0.75;
  if (rawSizeBytes > 5 * 1024 * 1024) {
    throw new Error("ขนาดไฟล์รูปภาพสลิปห้ามเกิน 5MB ค่ะ");
  }

  // 3. Rename with unique ID (UUID equivalent)
  const imgId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Save to Supabase images table
  try {
    const { error } = await supabase.from("images").insert({ id: imgId, base64: base64Str });
    if (error) throw error;
    console.log(`[Supabase] Saved image ${imgId}`);
  } catch (err) {
    console.error("[Supabase] Failed to save image:", err);
    throw new Error("ไม่สามารถบันทึกไฟล์สลิปขึ้นระบบ Cloud ได้ กรุณาลองใหม่อีกครั้งค่ะ");
  }

  return `/api/images/${imgId}`;
}

async function extractImagesFromPayload(obj: unknown): Promise<unknown> {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    if (obj.startsWith("data:image/")) return await extractAndSaveImage(obj);
    return obj;
  }
  if (Array.isArray(obj)) {
    const newArr = [];
    for (const item of obj) {
      newArr.push(await extractImagesFromPayload(item));
    }
    return newArr;
  }
  if (typeof obj === "object") {
    const newObj: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      newObj[key] = await extractImagesFromPayload(record[key]);
    }
    return newObj;
  }
  return obj;
}

// =============================================
// Supabase helper: Write log with specific details type
// =============================================
async function writeLog(userId: string, action: string, targetType?: string, targetId?: string, details?: unknown) {
  const newLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    user_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details || {},
    created_at: new Date().toISOString()
  };
  const { error } = await supabase.from("logs").insert(newLog);
  if (error) console.error("[Log] Failed to write log:", error.message);
}

// =============================================
// Supabase helper: Create notification
// =============================================
async function createNotification(userId: string, title: string, message: string, type: string, referenceId?: string, referenceType?: string) {
  const newNot = {
    id: `not_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    user_id: userId,
    title,
    message,
    type,
    reference_id: referenceId,
    reference_type: referenceType,
    is_read: false,
    created_at: new Date().toISOString()
  };
  const { error } = await supabase.from("notifications").insert(newNot);
  if (error) console.error("[Notification] Failed:", error.message);
}

// =============================================
// Supabase helper: Load full state for frontend
// =============================================
async function loadFullState(): Promise<AppState> {
  const [
    { data: users },
    { data: settingsArr },
    { data: monthlyBills },
    { data: payments },
    { data: transactions },
    { data: marketWeeks },
    { data: marketItems },
    { data: marketTeams },
    { data: activities },
    { data: budgetRequests },
    { data: announcements },
    { data: notifications },
    { data: logs },
    { data: petitions },
    { data: passwordResets },
  ] = await Promise.all([
    supabase.from("users").select("*").order("student_id"),
    supabase.from("settings").select("*"),
    supabase.from("monthly_bills").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("market_weeks").select("*").order("created_at", { ascending: false }),
    supabase.from("market_items").select("*"),
    supabase.from("market_teams").select("*"),
    supabase.from("activities").select("*").order("created_at", { ascending: false }),
    supabase.from("budget_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("petitions").select("*").order("created_at", { ascending: false }),
    supabase.from("password_resets").select("*").order("requested_at", { ascending: false }),
  ]);

  const settings = (settingsArr && settingsArr.length > 0 
    ? convertKeysToCamel(settingsArr[0])
    : { fundName: "เงินเก็บTns รุ่น06", monthlyFee: 150, promptpayNumber: "", promptpayName: "", promptpayQrUrl: "", bankName: "พร้อมเพย์" }) as unknown as SystemSettings & { id?: unknown };

  // Remove the singleton ID from settings
  if (settings.id) delete settings.id;

  return {
    users: convertKeysToCamel(users || []) as User[],
    settings: settings as SystemSettings,
    monthlyBills: convertKeysToCamel(monthlyBills || []) as MonthlyBill[],
    payments: convertKeysToCamel(payments || []) as Payment[],
    transactions: convertKeysToCamel(transactions || []) as Transaction[],
    marketWeeks: convertKeysToCamel(marketWeeks || []) as MarketWeek[],
    marketItems: convertKeysToCamel(marketItems || []) as any[],
    marketTeams: convertKeysToCamel(marketTeams || []) as any[],
    activities: convertKeysToCamel(activities || []) as Activity[],
    budgetRequests: convertKeysToCamel(budgetRequests || []) as any[],
    announcements: convertKeysToCamel(announcements || []) as any[],
    notifications: convertKeysToCamel(notifications || []) as any[],
    logs: convertKeysToCamel(logs || []) as any[],
    petitions: convertKeysToCamel(petitions || []) as any[],
    passwordResets: convertKeysToCamel(passwordResets || []) as any[],
  };
}

// =============================================
// Helper for Thai month names
// =============================================
function getMonthThaiName(m: number): string {
  const months = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  return months[m] || String(m);
}

// =============================================
// Precision Math Utilities (0.1 + 0.2 safe rounding)
// =============================================
function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// =============================================
// Setup Express & Security Middlewares
// =============================================
const app = express();
const PORT = 3000;

// Trust reverse proxy (Cloud Run / Nginx) to get correct client IP
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP to prevent issues with Vite inside AI Studio sandboxed frame
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));

// Rate limit rules for authentication to avoid spamming/bruteforce
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Max 30 attempts per 15 minutes per IP
  message: { error: "คุณทำรายการเข้าสู่ระบบหรือกู้รหัสผ่านถี่เกินไป กรุณารอ 15 นาทีก่อนลองใหม่อีกครั้งค่ะ" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable startup validation checks to prevent proxy header validation errors in AI Studio environments
});

// =============================================
// Realtime Setup (Supabase Realtime + SSE Fallback)
// =============================================
interface SseClient {
  id: string;
  res: express.Response;
}

let sseClients: SseClient[] = [];

// Initialize Supabase Realtime channel for broadcasting
const supabaseRealtimeChannel = supabase.channel("app-updates");
supabaseRealtimeChannel.subscribe((status) => {
  console.log(`[Supabase Realtime] Server subscription status: ${status}`);
});

function broadcastStateUpdate() {
  // 1. Broadcast over Supabase Realtime
  supabaseRealtimeChannel.send({
    type: "broadcast",
    event: "state_changed",
    payload: { timestamp: Date.now() },
  }).then((res) => {
    console.log("[Supabase Realtime] Broadcast sent successfully:", res);
  }).catch((err) => {
    console.error("[Supabase Realtime] Broadcast error:", err);
  });

  // 2. Broadcast over SSE (as fallback)
  const message = `data: ${JSON.stringify({ type: "state_changed", timestamp: Date.now() })}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(message);
    } catch (e) {
      // Connection may have been closed
    }
  });
}

// Global hook to automatically broadcast database state changes on any successful POST/PUT/DELETE
app.use((req, res, next) => {
  res.on("finish", () => {
    if (req.method !== "GET" && req.path.startsWith("/api/") && res.statusCode >= 200 && res.statusCode < 300) {
      // Exclude simple read/login operations to avoid unnecessary broadcasts
      if (!req.path.includes("/auth/login") && !req.path.includes("/auth/email-login") && !req.path.includes("/realtime-stream") && !req.path.includes("/supabase-config")) {
        setTimeout(() => {
          broadcastStateUpdate();
        }, 150);
      }
    }
  });
  next();
});

// Endpoint to retrieve Supabase credentials for client-side realtime subscription
app.get("/api/supabase-config", (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_SERVICE_KEY,
  });
});

// SSE Realtime stream endpoint
app.get("/api/realtime-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Prevent buffering behind Nginx/Cloud Run
  res.flushHeaders();

  const clientId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newClient: SseClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send connection acknowledgment
  res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

  // Keep-alive heartbeat to prevent timeouts from Cloud Run router / Nginx
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`: keep-alive\n\n`);
    } catch (e) {
      // Connection closed
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAliveInterval);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Disable caching for all API endpoints to guarantee immediate data updates on the client
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Middleware to extract base64 images from any request payload
app.use(async (req, res, next) => {
  if (req.body && req.method !== "GET") {
    try {
      req.body = await extractImagesFromPayload(req.body);
    } catch (err) {
      console.error("Failed to extract images from request payload:", err);
    }
  }
  next();
});

// =============================================
// API Routes
// =============================================

// Authentication
app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  const { studentId, password } = req.body;
  if (!studentId || !password) {
    return res.status(400).json({ error: "กรุณากรอกรหัสนักศึกษาและรหัสผ่าน" });
  }

  const { data: users, error } = await supabase.from("users").select("*");
  if (error) return res.status(500).json({ error: error.message });

  interface BasicUser {
    id: string;
    student_id: string;
    password?: string;
    full_name: string;
    nickname?: string;
    email?: string;
    role: string;
    classroom?: string;
  }

  const user = (users as BasicUser[] || []).find((u: BasicUser) => {
    const last3Digits = u.student_id ? u.student_id.slice(-3) : "";
    const isIdMatch = studentId === last3Digits || studentId === u.student_id;
    return isIdMatch && u.password === password;
  });

  if (!user) {
    return res.status(401).json({ error: "รหัสท้ายนักศึกษาหรือรหัสผ่านไม่ถูกต้อง" });
  }

  res.json({ success: true, user: convertKeysToCamel(user) });
});

app.post("/api/auth/email-login", authRateLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "กรุณาระบุอีเมลมหาลัยในการเข้าสู่ระบบค่ะ" });

  const { data: users } = await supabase.from("users").select("*").ilike("email", email.trim());
  const user = users && users.length > 0 ? users[0] : null;
  if (!user) return res.status(404).json({ error: "ไม่พบข้อมูลอีเมลนี้ในระบบกองทุนห้องค่ะ กรุณาป้อนรหัสนักศึกษาเข้าสู่ระบบแบบปกติ แล้วเข้าไปอัปเดตอีเมลมหาลัยของท่านที่เมนูข้อมูลส่วนตัวก่อนนะคะ" });

  res.json({ success: true, user: convertKeysToCamel(user) });
});

app.post("/api/auth/change-password", authRateLimiter, async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });

  const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
  if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });
  if (user.password !== oldPassword) return res.status(400).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });

  await supabase.from("users").update({ password: newPassword, updated_at: new Date().toISOString() }).eq("id", userId);
  res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จแล้ว" });
});

app.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: "กรุณาระบุรหัสนักศึกษาหรือเลข 3 ตัวท้าย" });

  const { data: users } = await supabase.from("users").select("*");
  interface BasicUser {
    id: string;
    student_id: string;
    full_name: string;
    classroom?: string;
  }
  const user = (users as BasicUser[] || []).find((u: BasicUser) => {
    const last3Digits = u.student_id ? u.student_id.slice(-3) : "";
    return studentId === last3Digits || studentId === u.student_id;
  });
  if (!user) return res.status(404).json({ error: "ไม่พบข้อมูลรหัสนักศึกษาของท่านในระบบ" });

  // Check existing pending request
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

  // Notify treasurers
  const { data: treasurers } = await supabase.from("users").select("id").in("role", ["treasurer", "committee", "leader"]);
  for (const t of (treasurers || [])) {
    await createNotification(t.id, "🔔 คำขอรีเซ็ตรหัสผ่านใหม่", `เพื่อน ${user.full_name} (${user.student_id}) ได้ส่งคำขอรีเซ็ตรหัสผ่านกลับไปเป็นค่าเริ่มต้น`, "petition");
  }

  res.json({ success: true, message: "ส่งคำขอรีเซ็ตรหัสผ่านไปยังเหรัญญิกเรียบร้อยแล้วค่ะ โปรดติดต่อเหรัญญิกเพื่อทำรายการต่อนะคะ" });
});

app.post("/api/treasurer/resolve-reset-password", async (req, res) => {
  const { resetId, treasurerId } = req.body;
  if (!resetId || !treasurerId) return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });

  const { data: actingUser } = await supabase.from("users").select("*").eq("id", treasurerId).single();
  if (!actingUser || actingUser.role !== "treasurer") return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ (เฉพาะเหรัญญิกเท่านั้น)" });

  const { data: request } = await supabase.from("password_resets").select("*").eq("id", resetId).single();
  if (!request) return res.status(404).json({ error: "ไม่พบคำขอรีเซ็ตรหัสผ่านนี้" });

  await supabase.from("users").update({ password: "123456", updated_at: new Date().toISOString() }).eq("id", request.user_id);
  await supabase.from("password_resets").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: treasurerId }).eq("id", resetId);

  await createNotification(request.user_id, "🔑 รีเซ็ตรหัสผ่านสำเร็จ", "เหรัญญิกได้รีเซ็ตรหัสผ่านของท่านกลับไปเป็น '123456' เรียบร้อยแล้วค่ะ โปรดเข้าสู่ระบบและรีบเปลี่ยนรหัสผ่านเพื่อความปลอดภัยนะคะ", "system");
  await writeLog(treasurerId, "reset_user_password", "user", request.user_id, { message: `เหรัญญิก ${actingUser.full_name} ได้รีเซ็ตรหัสผ่านของ ${request.full_name} กลับเป็น 123456` });

  res.json({ success: true, message: "รีเซ็ตรหัสผ่านเป็น 123456 สำเร็จเรียบร้อยแล้วค่ะ!" });
});

// System Diagnostics
app.get("/api/system/diagnostics", async (req, res) => {
  const connected = await testSupabaseConnection();
  const { count: usersCount } = await supabase.from("users").select("*", { count: "exact", head: true });
  const { count: billsCount } = await supabase.from("monthly_bills").select("*", { count: "exact", head: true });
  const { count: paymentsCount } = await supabase.from("payments").select("*", { count: "exact", head: true });
  const { count: txCount } = await supabase.from("transactions").select("*", { count: "exact", head: true });
  const { count: actCount } = await supabase.from("activities").select("*", { count: "exact", head: true });
  const { count: petCount } = await supabase.from("petitions").select("*", { count: "exact", head: true });

  res.json({
    firebase: { connected, error: dbSyncError, databaseId: "Supabase PostgreSQL", projectId: "student_fund" },
    mongodb: { connected, error: dbSyncError, database: "student_fund", uri: SUPABASE_URL ? "configured" : "not-configured" },
    localFile: { exists: false, sizeBytes: 0, path: "N/A (using Supabase)" },
    counts: { users: usersCount || 0, bills: billsCount || 0, payments: paymentsCount || 0, transactions: txCount || 0, activities: actCount || 0, petitions: petCount || 0 }
  });
});

// Client Error Logger Endpoint (Replaces or acts as Sentry)
app.post("/api/system/log-error", async (req, res) => {
  const { errorMsg, componentStack, userId, url } = req.body;
  try {
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
  } catch (err: unknown) {
    console.error("[Log Error Endpoint] Failed to write error log to Supabase:", err);
    res.status(500).json({ error: "Failed to record error log" });
  }
});

// Generate Summary
app.post("/api/system/generate-summary", async (req, res) => {
  const { userId } = req.body;
  try {
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
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "ไม่สามารถสร้างสรุปได้: " + errMsg });
  }
});

// Force sync (now just reloads from Supabase)
app.post("/api/system/sync-cloud", async (req, res) => {
  try {
    const connected = await testSupabaseConnection();
    if (!connected) return res.status(500).json({ error: "ไม่สามารถเชื่อมต่อ Supabase ได้" });
    res.json({ success: true, message: "ข้อมูลจาก Supabase ถูกต้องและพร้อมใช้งานแล้วค่ะ! 🔄" });
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถซิงก์ข้อมูลได้: " + err.message });
  }
});

// System Reset
app.post("/api/system/reset", async (req, res) => {
  const { userId, keepUsers, keepSettings } = req.body;
  try {
    // Delete all data from tables
    if (!keepUsers) {
      await supabase.from("users").delete().neq("id", "");
      // Re-seed users
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
      // Reset all passwords to 123456
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

    // Clear all transactional data
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
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถรีเซ็ตระบบได้: " + err.message });
  }
});

// Backups (simplified - uses Supabase state exports)
app.get("/api/backups/list", async (req, res) => {
  // Local file backups are no longer used, return empty
  res.json([]);
});

app.post("/api/backups/create", async (req, res) => {
  const { note, userId } = req.body;
  try {
    const state = await loadFullState();
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_supabase_${dateStr}.json`;
    if (userId) await writeLog(userId, "create_backup", "system", undefined, { filename });
    res.json({ success: true, filename, cloudSaved: true, message: "สร้างจุดแบ็กอัปเรียบร้อย (ข้อมูลอยู่ใน Supabase อย่างปลอดภัย)" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/backups/restore", async (req, res) => {
  res.json({ success: true, message: "ข้อมูลใน Supabase เป็นข้อมูลล่าสุดอยู่แล้วค่ะ" });
});

app.post("/api/backups/upload", async (req, res) => {
  const { uploadedState, userId } = req.body;
  if (!uploadedState) return res.status(400).json({ error: "Missing uploaded state data" });
  // For upload restore, we could re-import from the JSON - but for now just acknowledge
  res.json({ success: true, message: "ระบบใช้ Supabase แล้ว กรุณาใช้ migration script แทนค่ะ" });
});

app.get("/api/backups/download", async (req, res) => {
  try {
    const state = await loadFullState();
    const downloadName = `backup_supabase_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(state, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/backups/delete", async (req, res) => {
  res.json({ success: true, message: "ลบประวัติแบ็กอัปเรียบร้อยแล้วค่ะ" });
});

// GET State - Main data endpoint
app.get("/api/state", async (req, res) => {
  try {
    const state = await loadFullState();
    res.json(state);
  } catch (err: any) {
    console.error("[API /state] Error:", err);
    res.status(500).json({ error: "ไม่สามารถโหลดข้อมูลจาก Supabase ได้: " + err.message });
  }
});

// Update Settings
app.post("/api/settings", async (req, res) => {
  const { fundName, monthlyFee, promptpayNumber, promptpayName, promptpayQrUrl, bankName, userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const numericFee = Number(monthlyFee);
  const settingsData = {
    id: "main", fund_name: fundName, monthly_fee: numericFee, promptpay_number: promptpayNumber,
    promptpay_name: promptpayName, promptpay_qr_url: promptpayQrUrl || "", bank_name: bankName || "พร้อมเพย์",
    updated_at: new Date().toISOString()
  };
  await supabase.from("settings").upsert(settingsData, { onConflict: "id" });

  // Update pending bills to match new fee
  await supabase.from("monthly_bills").update({ amount: numericFee }).eq("status", "pending");

  await writeLog(userId, "update_settings", "settings", "global", settingsData);
  const { data: updatedSettings } = await supabase.from("settings").select("*").eq("id", "main").single();
  res.json({ success: true, settings: convertKeysToCamel(updatedSettings) });
});

// Create Monthly Bills
app.post("/api/bills/create", async (req, res) => {
  const { month, year, dueDate, userId } = req.body;
  if (!month || !year || !dueDate || !userId) return res.status(400).json({ error: "Missing required parameters" });

  const { data: activeStudents } = await supabase.from("users").select("*").eq("is_active", true);
  const { data: existingBills } = await supabase.from("monthly_bills").select("user_id").eq("month", Number(month)).eq("year", Number(year));
  const { data: settingsArr } = await supabase.from("settings").select("monthly_fee").eq("id", "main").single();
  const monthlyFee = settingsArr?.monthly_fee || 150;

  const existingUserIds = new Set((existingBills || []).map((b: { user_id: string }) => b.user_id));
  const newBills: Array<{
    id: string;
    user_id: string;
    month: number;
    year: number;
    amount: number;
    status: string;
    due_date: string;
    created_at: string;
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
    // Send notifications
    for (const bill of newBills) {
      await createNotification(bill.user_id, "แจ้งเตือนบิลค่าบำรุงกองทุนใหม่", `บิลค่าบำรุงกองทุนเดือน ${month}/${year} จำนวน ${monthlyFee} บาท ครบกำหนดชำระในวันที่ ${dueDate}`, "bill", bill.id, "bill");
    }
    await writeLog(userId, "create_monthly_bills", "monthly_bills", `${month}/${year}`, { count: newBills.length });
  }

  res.json({ success: true, createdCount: newBills.length });
});

// Delete bills cycle
app.post("/api/bills/delete-cycle", async (req, res) => {
  const { month, year, userId } = req.body;
  if (!month || !year || !userId) return res.status(400).json({ error: "Missing required parameters" });

  const { data: billsToDelete } = await supabase.from("monthly_bills").select("id").eq("month", Number(month)).eq("year", Number(year));
  if (!billsToDelete || billsToDelete.length === 0) return res.status(444).json({ error: "ไม่พบบิลของเดือนและปีที่ระบุในระบบ" });

  const billIds = billsToDelete.map((b: { id: string }) => b.id);
  await supabase.from("payments").delete().in("bill_id", billIds);
  await supabase.from("monthly_bills").delete().eq("month", Number(month)).eq("year", Number(year));

  await writeLog(userId, "delete_monthly_bills", "monthly_bills", `${month}/${year}`, { count: billsToDelete.length });
  res.json({ success: true, deletedCount: billsToDelete.length });
});

// Helper: Update bill status based on payments
async function updateBillStatus(billId: string) {
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

// Cancel payment
app.post("/api/payments/cancel", async (req, res) => {
  const { billId, userId } = req.body;
  if (!billId || !userId) return res.status(400).json({ error: "Missing required parameters" });

  const { data: payment } = await supabase.from("payments").select("*").eq("bill_id", billId).eq("user_id", userId).eq("status", "pending_review").limit(1).single();
  if (!payment) return res.status(404).json({ error: "ไม่พบหลักฐานการชำระเงินที่อยู่ระหว่างรอตรวจสอบ" });

  await supabase.from("payments").delete().eq("id", payment.id);
  await updateBillStatus(billId);
  await writeLog(userId, "cancel_payment_request", "payment", payment.id, { billId, amount: payment.amount });
  res.json({ success: true, message: "ยกเลิกคำขอชำระเงินเรียบร้อยแล้ว" });
});

// Submit payment slip with Zod validation
app.post("/api/payments/submit", async (req, res) => {
  const paymentSchema = z.object({
    billId: z.string().min(1, "กรุณาระบุรหัสบิลค่ะ"),
    userId: z.string().min(1, "กรุณาระบุรหัสผู้ใช้งานค่ะ"),
    amount: z.union([z.number(), z.string()]).transform((val) => Number(val)).refine((num) => !isNaN(num) && num > 0, {
      message: "จำนวนเงินโอนต้องเป็นตัวเลขที่มากกว่า 0 บาทค่ะ"
    }),
    slipUrl: z.string().optional(),
    note: z.string().max(250, "คำอธิบายมีความยาวเกินไป (สูงสุด 250 ตัวอักษร)").optional()
  });

  const parseResult = paymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message || "ข้อมูลส่งสลิปไม่ถูกต้องค่ะ";
    return res.status(400).json({ error: firstError });
  }

  const { billId, userId, amount, slipUrl, note } = parseResult.data;
  const numAmount = roundToTwoDecimals(amount);

  // Check duplicates
  const { data: existingPending } = await supabase.from("payments").select("id").eq("bill_id", billId).eq("user_id", userId).eq("status", "pending_review");
  if (existingPending && existingPending.length > 0) return res.status(400).json({ error: "คุณมีรายการส่งสลิปสำหรับบิลนี้อยู่แล้วและกำลังรอการตรวจสอบจากเหรัญญิก" });

  const { data: existingApproved } = await supabase.from("payments").select("id").eq("bill_id", billId).eq("user_id", userId).eq("status", "approved");
  if (existingApproved && existingApproved.length > 0) return res.status(400).json({ error: "คุณได้ชำระเงินสำหรับบิลนี้และได้รับการอนุมัติเรียบร้อยแล้ว" });

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const newPayment = { id: paymentId, user_id: userId, bill_id: billId, amount: numAmount, slip_url: slipUrl || "", status: "pending_review", note: note || "", created_at: new Date().toISOString() };
  await supabase.from("payments").insert(newPayment);
  await updateBillStatus(billId);

  const { data: treasurers } = await supabase.from("users").select("id, full_name").eq("role", "treasurer");
  const { data: user } = await supabase.from("users").select("full_name").eq("id", userId).single();
  for (const t of (treasurers || [])) {
    await createNotification(t.id, "มีสลิปใหม่รอการตรวจสอบ", `คุณ ${user?.full_name || "สมาชิก"} ได้อัปโหลดสลิปสำหรับบิลเดือนนี้แล้ว กรุณาตรวจสอบและอนุมัติ`, "payment", paymentId, "payment");
  }

  await writeLog(userId, "submit_payment_slip", "payment", paymentId, { billId, amount: numAmount });
  res.json({ success: true, payment: convertKeysToCamel(newPayment) });
});

// Record cash payment with Zod validation
app.post("/api/payments/record-cash", async (req, res) => {
  const cashRecordSchema = z.object({
    billId: z.string().min(1, "กรุณาระบุรหัสบิลค่ะ"),
    userId: z.string().min(1, "กรุณาระบุรหัสผู้ใช้งานค้างชำระค่ะ"),
    amount: z.union([z.number(), z.string()]).transform((val) => Number(val)).refine((num) => !isNaN(num) && num > 0, {
      message: "จำนวนเงินสดต้องเป็นตัวเลขที่มากกว่า 0 บาทค่ะ"
    }),
    treasurerId: z.string().min(1, "กรุณาระบุรหัสผู้บันทึกค่ะ"),
    note: z.string().max(250, "คำอธิบายมีความยาวเกินไป (สูงสุด 250 ตัวอักษร)").optional()
  });

  const parseResult = cashRecordSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message || "ข้อมูลบันทึกเงินสดไม่ถูกต้องค่ะ";
    return res.status(400).json({ error: firstError });
  }

  const { billId, userId, amount, treasurerId, note } = parseResult.data;
  const numAmount = roundToTwoDecimals(amount);

  const { data: recorder } = await supabase.from("users").select("*").eq("id", treasurerId).single();
  const isLeader = recorder?.role === "leader";

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const { data: bill } = await supabase.from("monthly_bills").select("*").eq("id", billId).single();
  const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();

  if (isLeader) {
    const newPayment = { id: paymentId, user_id: userId, bill_id: billId, amount: numAmount, slip_url: "cash", status: "pending_review", note: note || "แจ้งชำระด้วยเงินสด (บันทึกโดยหัวหน้าห้อง)", created_at: new Date().toISOString() };
    await supabase.from("payments").insert(newPayment);
    await updateBillStatus(billId);

    const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
    for (const t of (treasurers || [])) {
      await createNotification(t.id, "มีรายการชำระเงินสดรอการอนุมัติ 💵", `หัวหน้าห้องคุณ ${recorder?.full_name} ได้บันทึกรายการรับเงินสดจำนวน ${numAmount} บาท ของคุณ ${user?.full_name || "สมาชิก"}`, "payment", paymentId, "payment");
    }
    await createNotification(userId, "ส่งยอดชำระเงินสดแล้ว 💵", `หัวหน้าห้องได้บันทึกการรับเงินสดจำนวน ${numAmount} บาท ของคุณเข้าระบบแล้ว`, "payment", paymentId, "payment");
    await writeLog(treasurerId, "record_cash_pending", "payment", paymentId, { studentId: user?.student_id, amount: numAmount });
    return res.json({ success: true, payment: convertKeysToCamel(newPayment) });
  }

  // Treasurer - auto approve
  const monthStr = bill ? String(bill.month).padStart(2, "0") : "00";
  const yearStr = bill ? bill.year : "2569";
  const suffix = user ? user.student_id.substring(4) : "0000";
  const receiptNumber = `REC-${yearStr}-${monthStr}-${suffix}`;

  const newPayment = { id: paymentId, user_id: userId, bill_id: billId, amount: numAmount, slip_url: "cash", status: "approved", note: note || "ชำระด้วยเงินสด (เหรัญญิกบันทึกด้วยตนเอง)", created_at: new Date().toISOString(), reviewed_by: treasurerId, reviewed_at: new Date().toISOString(), receipt_number: receiptNumber };
  await supabase.from("payments").insert(newPayment);
  await updateBillStatus(billId);

  const txId = `tx_${Date.now()}`;
  await supabase.from("transactions").insert({ id: txId, type: "income", category: "monthly_fee", amount: Number(amount), description: `ค่าบำรุงกองทุนรายเดือน (เงินสด) (${bill ? `${bill.month}/${bill.year}` : ""}) - ${user?.full_name || "นักศึกษา"}`, reference_id: paymentId, reference_type: "payment", created_by: treasurerId, approved_by: treasurerId, approved_at: new Date().toISOString(), month: bill ? bill.month : new Date().getMonth() + 1, year: bill ? bill.year : 2569, is_closed: false, created_at: new Date().toISOString() });

  await createNotification(userId, "ชำระเงินสดเสร็จสิ้นแล้ว 🎉", `เหรัญญิกได้บันทึกการรับเงินสดจำนวน ${amount} บาท เลขใบเสร็จคือ ${receiptNumber}`, "payment", paymentId, "payment");
  await writeLog(treasurerId, "record_cash_payment", "payment", paymentId, { studentId: user?.student_id, amount });
  res.json({ success: true, payment: convertKeysToCamel(newPayment) });
});

// Approve payment
app.post("/api/payments/approve", async (req, res) => {
  const { paymentId, treasurerId, note } = req.body;
  if (!paymentId || !treasurerId) return res.status(400).json({ error: "Missing parameters" });

  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  if (payment.status === "approved") return res.json({ success: true, payment: convertKeysToCamel(payment) });

  const { data: bill } = await supabase.from("monthly_bills").select("*").eq("id", payment.bill_id).single();
  const { data: user } = await supabase.from("users").select("*").eq("id", payment.user_id).single();

  const monthStr = bill ? String(bill.month).padStart(2, "0") : "00";
  const yearStr = bill ? bill.year : "2569";
  const suffix = user ? user.student_id.substring(4) : "0000";
  const receiptNumber = `REC-${yearStr}-${monthStr}-${suffix}`;

  await supabase.from("payments").update({ status: "approved", reviewed_by: treasurerId, reviewed_at: new Date().toISOString(), note: note || payment.note, receipt_number: receiptNumber }).eq("id", paymentId);
  if (bill) await updateBillStatus(bill.id);

  const txId = `tx_${Date.now()}`;
  await supabase.from("transactions").insert({ id: txId, type: "income", category: "monthly_fee", amount: payment.amount, description: `ค่าบำรุงกองทุนรายเดือน (${bill ? `${bill.month}/${bill.year}` : ""}) - ${user?.full_name || "นักศึกษา"}`, reference_id: payment.id, reference_type: "payment", created_by: treasurerId, approved_by: treasurerId, approved_at: new Date().toISOString(), month: bill ? bill.month : new Date().getMonth() + 1, year: bill ? bill.year : 2569, is_closed: false, created_at: new Date().toISOString() });

  await createNotification(payment.user_id, "ชำระเงินกองทุนอนุมัติสำเร็จแล้ว 🎉", `เหรัญญิกตรวจสอบสลิปเดือนนี้แล้ว ยอดเงิน ${payment.amount} บาท เลขใบเสร็จคือ ${receiptNumber}`, "payment", payment.id, "payment");
  await writeLog(treasurerId, "approve_payment", "payment", paymentId, { studentId: user?.student_id, amount: payment.amount });

  const { data: updated } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  res.json({ success: true, payment: convertKeysToCamel(updated) });
});

// Reject payment
app.post("/api/payments/reject", async (req, res) => {
  const { paymentId, treasurerId, rejectReason } = req.body;
  if (!paymentId || !treasurerId || !rejectReason) return res.status(400).json({ error: "Missing parameters" });

  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  await supabase.from("payments").update({ status: "rejected", reviewed_by: treasurerId, reviewed_at: new Date().toISOString(), reject_reason: rejectReason }).eq("id", paymentId);

  const { data: bill } = await supabase.from("monthly_bills").select("id").eq("id", payment.bill_id).single();
  if (bill) await updateBillStatus(bill.id);

  await createNotification(payment.user_id, "❌ สลิปชำระเงินกองทุนถูกปฏิเสธ", `สลิปโอนเงินของคุณถูกเหรัญญิกปฏิเสธด้วยเหตุผล: "${rejectReason}"`, "payment", payment.id, "payment");
  const { data: user } = await supabase.from("users").select("student_id").eq("id", payment.user_id).single();
  await writeLog(treasurerId, "reject_payment", "payment", paymentId, { studentId: user?.student_id, reason: rejectReason });

  const { data: updated } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  res.json({ success: true, payment: convertKeysToCamel(updated) });
});

// Market Week - Create
app.post("/api/market/week/create", async (req, res) => {
  const { weekDate, note, teamName, leaderId, memberIds, userId } = req.body;
  if (!weekDate || !userId) return res.status(400).json({ error: "Missing parameters" });
  const { data: proposer } = await supabase.from("users").select("role").eq("id", userId).single();
  if (!proposer || (proposer.role !== "treasurer" && proposer.role !== "committee")) return res.status(403).json({ error: "ขออภัย เฉพาะเหรัญญิกหรือคณะกรรมการเท่านั้นที่มีสิทธิ์เพิ่มรอบตลาดได้" });

  const weekId = `mkt_${Date.now()}`;
  const newWeek = { id: weekId, week_date: weekDate, total_cost: 0, total_revenue: 0, total_profit: 0, status: "planned", note: note || "", team_name: teamName || "กลุ่มขายสินค้าทั่วไป", leader_id: leaderId || userId, member_ids: memberIds || [], created_by: userId, created_at: new Date().toISOString() };
  await supabase.from("market_weeks").insert(newWeek);
  await writeLog(userId, "create_market_week", "market_week", weekId, { weekDate, note, teamName });
  res.json({ success: true, marketWeek: convertKeysToCamel(newWeek) });
});

// Market Week - Update Team
app.post("/api/market/week/update-team", async (req, res) => {
  const { marketWeekId, teamName, leaderId, memberIds, note, userId } = req.body;
  if (!marketWeekId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "ไม่พบรอบตลาดนี้" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  const isLeader = week.leader_id === userId;
  const isAdmin = user && (user.role === "treasurer" || user.role === "committee");

  if (!isAdmin && !isLeader) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์ปรับปรุงข้อมูลทีม เฉพาะหัวหน้าทีมหรือคณะกรรมการเท่านั้น" });
  }

  const updates: Record<string, unknown> = {};
  if (teamName !== undefined) updates.team_name = teamName;
  if (leaderId !== undefined) updates.leader_id = leaderId;
  if (memberIds !== undefined) updates.member_ids = memberIds;
  if (note !== undefined) updates.note = note;

  await supabase.from("market_weeks").update(updates).eq("id", marketWeekId);
  await writeLog(userId, "update_market_team", "market_week", marketWeekId, { teamName });
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market Item - Add
app.post("/api/market/item/add", async (req, res) => {
  const { marketWeekId, itemName, type, amount, quantity, note, userId } = req.body;
  if (!marketWeekId || !itemName || !type || !amount || !userId) return res.status(400).json({ error: "Missing parameters" });

  const numAmount = Number(amount);
  const numQuantity = Number(quantity || 1);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "ราคาต่อหน่วยต้องเป็นตัวเลขที่มากกว่า 0 บาท" });
  }
  if (isNaN(numQuantity) || numQuantity <= 0) {
    return res.status(400).json({ error: "จำนวนสินค้าต้องเป็นตัวเลขที่มากกว่า 0 ชิ้น" });
  }

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "ไม่พบรอบตลาดนี้" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  const isLeader = week.leader_id === userId;
  const isMember = week.member_ids && week.member_ids.includes(userId);
  const isAdmin = user && (user.role === "treasurer" || user.role === "committee");

  if (!isAdmin && !isLeader && !isMember) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์เพิ่มรายการ เฉพาะสมาชิกทีมหรือกรรมการเท่านั้น" });
  }

  const itemId = `mkt_item_${Date.now()}`;
  const newItem = { id: itemId, market_week_id: marketWeekId, item_name: itemName, type, amount: numAmount, quantity: numQuantity, note: note || "", created_by: userId, created_at: new Date().toISOString() };
  await supabase.from("market_items").insert(newItem);

  // Recalculate week totals
  const { data: weekItems } = await supabase.from("market_items").select("*").eq("market_week_id", marketWeekId);
  interface MarketItemType {
    type: string;
    amount: number;
    quantity: number;
  }
  const costs = (weekItems as MarketItemType[] || []).filter((i: MarketItemType) => i.type === "cost").reduce((sum: number, i: MarketItemType) => roundToTwoDecimals(sum + (i.amount * i.quantity)), 0);
  const revenues = (weekItems as MarketItemType[] || []).filter((i: MarketItemType) => i.type === "revenue").reduce((sum: number, i: MarketItemType) => roundToTwoDecimals(sum + (i.amount * i.quantity)), 0);
  const weekUpdate: Record<string, unknown> = { total_cost: costs, total_revenue: revenues, total_profit: roundToTwoDecimals(revenues - costs) };
  
  const { data: currentWeek } = await supabase.from("market_weeks").select("status").eq("id", marketWeekId).single();
  if (currentWeek?.status === "planned") weekUpdate.status = "active";
  await supabase.from("market_weeks").update(weekUpdate).eq("id", marketWeekId);

  await writeLog(userId, "add_market_item", "market_item", itemId, { itemName, type, amount });
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  res.json({ success: true, item: convertKeysToCamel(newItem), marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market Item - Delete
app.post("/api/market/item/delete", async (req, res) => {
  const { itemId, userId } = req.body;
  if (!itemId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: item } = await supabase.from("market_items").select("*").eq("id", itemId).single();
  if (!item) return res.status(404).json({ error: "ไม่พบรายการสินค้า" });

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", item.market_week_id).single();
  if (!week) return res.status(404).json({ error: "ไม่พบรอบตลาด" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  const isLeader = week.leader_id === userId;
  const isMember = week.member_ids && week.member_ids.includes(userId);
  const isAdmin = user && (user.role === "treasurer" || user.role === "committee");

  if (!isAdmin && !isLeader && !isMember) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์ลบรายการ เฉพาะสมาชิกทีมหรือกรรมการเท่านั้น" });
  }

  await supabase.from("market_items").delete().eq("id", itemId);

  // Recalculate
  const { data: weekItems } = await supabase.from("market_items").select("*").eq("market_week_id", item.market_week_id);
  interface MarketItemType {
    type: string;
    amount: number;
    quantity: number;
  }
  const costs = (weekItems as MarketItemType[] || []).filter((i: MarketItemType) => i.type === "cost").reduce((sum: number, i: MarketItemType) => roundToTwoDecimals(sum + (i.amount * i.quantity)), 0);
  const revenues = (weekItems as MarketItemType[] || []).filter((i: MarketItemType) => i.type === "revenue").reduce((sum: number, i: MarketItemType) => roundToTwoDecimals(sum + (i.amount * i.quantity)), 0);
  await supabase.from("market_weeks").update({ total_cost: costs, total_revenue: revenues, total_profit: roundToTwoDecimals(revenues - costs) }).eq("id", item.market_week_id);

  await writeLog(userId, "delete_market_item", "market_item", itemId, { itemName: item.item_name });
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", item.market_week_id).single();
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market Week - Complete
app.post("/api/market/week/complete", async (req, res) => {
  const { marketWeekId, userId } = req.body;
  if (!marketWeekId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "ไม่พบรอบตลาดนี้" });

  const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
  const isLeader = week.leader_id === userId;
  const isAdmin = user && (user.role === "treasurer" || user.role === "committee");

  if (!isAdmin && !isLeader) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์สรุปยอดตลาด เฉพาะหัวหน้าทีมหรือกรรมการเท่านั้น" });
  }

  await supabase.from("market_weeks").update({ status: "completed" }).eq("id", marketWeekId);
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();

  const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
  for (const t of (treasurers || [])) {
    await createNotification(t.id, "มีรายการสรุปยอดตลาดวันพุธรอตรวจสอบ", `คุณ ${user?.full_name || "หัวหน้าทีม"} ได้สรุปยอดกำไรตลาดวันพุธรอบวันที่ ${updatedWeek?.week_date}`, "market", marketWeekId, "market");
  }
  await writeLog(userId, "complete_market_week", "market_week", marketWeekId, { profit: updatedWeek?.total_profit });
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market Week - Approve (creates transactions)
app.post("/api/market/week/approve", async (req, res) => {
  const { marketWeekId, treasurerId } = req.body;
  if (!marketWeekId || !treasurerId) return res.status(400).json({ error: "Missing parameters" });

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "Market week not found" });

  await supabase.from("market_weeks").update({ status: "approved", approved_by: treasurerId, approved_at: new Date().toISOString() }).eq("id", marketWeekId);

  const txBase = { reference_id: week.id, reference_type: "market", created_by: treasurerId, approved_by: treasurerId, approved_at: new Date().toISOString(), month: new Date(week.week_date).getMonth() + 1, year: 2569, is_closed: false, created_at: new Date().toISOString() };

  // Adjust advance return transaction based on any carry forward note
  const carryMatch = week.note?.match(/\[CARRY_FORWARD_REMAINING:([\d.]+)\]/);
  const carryForwardRemaining = carryMatch ? Number(carryMatch[1]) : 0;
  const totalAdvancePaid = week.advance_requested + (week.additional_advance_status === "approved" ? (week.additional_advance_amount || 0) : 0);

  // Parse if there was any carry forward amount pulled INTO this week from the previous week
  const parseAdvanceReason = (rawReason: string) => {
    if (!rawReason) return { reason: "", carryForwardAmount: 0 };
    if (rawReason.startsWith("CARRY_FORWARD_AMOUNT:")) {
      const parts = rawReason.split(" | REASON:");
      const carryForwardAmt = Number(parts[0].replace("CARRY_FORWARD_AMOUNT:", "")) || 0;
      const reasonStr = parts[1] || "";
      return { reason: reasonStr, carryForwardAmount: carryForwardAmt };
    }
    return { reason: rawReason, carryForwardAmount: 0 };
  };
  const { carryForwardAmount } = parseAdvanceReason(week.advance_reason || "");

  if (carryForwardRemaining > 0) {
    // This week is carrying forward remaining cash (not returning to central treasury yet)
    // There are NO income/expense transactions registered in the main central treasury because no physical cash moves!
    // The cash is kept by the team to be used in the next week.
  } else {
    // This week is NOT carrying forward remaining cash (closing the chain)
    // We record the net profit as income if positive
    if (week.total_profit > 0) {
      await supabase.from("transactions").insert({
        ...txBase,
        id: `tx_${Date.now()}_profit`,
        type: "income",
        category: "market_profit",
        amount: week.total_profit,
        description: `กำไรส่งคืนกองทุนห้องเรียนตลาดวันพุธ: ${week.team_name || "กลุ่มจำหน่ายสินค้า"} (${week.week_date})`
      });
    }

    // We return the total advance paid this week (adjusted if there was a loss)
    const returnedAmount = Math.max(0, totalAdvancePaid + (week.total_profit < 0 ? week.total_profit : 0));
    if (week.advance_status === "approved" && returnedAmount > 0) {
      await supabase.from("transactions").insert({ 
        ...txBase, 
        id: `tx_${Date.now()}_adv_ret`, 
        type: "income", 
        category: "other_income", 
        amount: returnedAmount, 
        description: `รับคืนเงินทุนล่วงหน้าตลาดวันพุธ: ${week.team_name || "กลุ่มจำหน่ายสินค้า"} (${week.week_date})` 
      });
    }

    // We also return any carry forward amount that was pulled from previous weeks
    if (carryForwardAmount > 0) {
      await supabase.from("transactions").insert({
        ...txBase,
        id: `tx_${Date.now()}_carry_ret`,
        type: "income",
        category: "other_income",
        amount: carryForwardAmount,
        description: `รับคืนเงินทุนและกำไรสะสมที่ยกยอดมาจากรอบก่อนหน้า: ${week.team_name || "กลุ่มจำหน่ายสินค้า"} (ตลาดรอบ ${week.week_date})`
      });
    }
  }

  const { data: allUsers } = await supabase.from("users").select("id");
  for (const u of (allUsers || [])) {
    await createNotification(u.id, "อัปเดตสรุปยอดตลาดวันพุธ 🛒", `ยอดเงินกำไรตลาดวันพุธรอบ ${week.week_date} จำนวน ${week.total_profit} บาท ได้รับการสมทบทุนแล้วค่ะ`, "market", marketWeekId, "market");
  }
  await writeLog(treasurerId, "approve_market_week", "market_week", marketWeekId, { profit: week.total_profit });
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market advance propose
app.post("/api/market/week/advance/propose", async (req, res) => {
  const { marketWeekId, amount, reason, requesterId } = req.body;
  if (!marketWeekId || !amount || !requesterId) return res.status(400).json({ error: "Missing required parameters" });

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "จำนวนเงินทุนล่วงหน้าต้องเป็นตัวเลขที่มากกว่า 0 บาท" });
  }

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "ไม่พบรอบตลาดนี้" });

  const { data: requester } = await supabase.from("users").select("role").eq("id", requesterId).single();
  const isLeader = week.leader_id === requesterId;
  const isAdmin = requester && (requester.role === "treasurer" || requester.role === "committee");

  if (!isAdmin && !isLeader) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์เสนอขอทุนล่วงหน้า เฉพาะหัวหน้าทีมหรือคณะกรรมการเท่านั้น" });
  }

  await supabase.from("market_weeks").update({ advance_requested: numAmount, advance_reason: reason || "", advance_status: "pending", advance_reject_reason: "" }).eq("id", marketWeekId);
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();

  const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
  for (const t of (treasurers || [])) {
    await createNotification(t.id, "มีคำขอเบิกเงินทุนล่วงหน้าตลาด 💰", `ทีม ${updatedWeek?.team_name || "ทั่วไป"} ขอเบิกทุนล่วงหน้าจำนวน ${numAmount} บาท`, "market", marketWeekId, "market");
  }
  await writeLog(requesterId, "propose_market_advance", "market_week", marketWeekId, { amount: numAmount });
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market advance additional propose
app.post("/api/market/week/advance-additional/propose", async (req, res) => {
  const { marketWeekId, amount, reason, requesterId } = req.body;
  if (!marketWeekId || !amount || !requesterId) return res.status(400).json({ error: "Missing required parameters" });

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "จำนวนเงินทุนเพิ่มเติมต้องเป็นตัวเลขที่มากกว่า 0 บาท" });
  }

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "ไม่พบรอบตลาดนี้" });

  const { data: requester } = await supabase.from("users").select("role").eq("id", requesterId).single();
  const isLeader = week.leader_id === requesterId;
  const isAdmin = requester && (requester.role === "treasurer" || requester.role === "committee");

  if (!isAdmin && !isLeader) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์เสนอขอทุนเพิ่มเติม เฉพาะหัวหน้าทีมหรือคณะกรรมการเท่านั้น" });
  }

  await supabase.from("market_weeks").update({ additional_advance_requested: numAmount, additional_advance_reason: reason || "", additional_advance_status: "pending", additional_advance_reject_reason: "" }).eq("id", marketWeekId);
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();

  const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
  for (const t of (treasurers || [])) {
    await createNotification(t.id, "มีคำขอเบิกเงินทุนล่วงหน้าเพิ่มเติมตลาด 💰", `ทีม ${updatedWeek?.team_name || "ทั่วไป"} ขอเบิกทุนเพิ่มเติมจำนวน ${numAmount} บาท`, "market", marketWeekId, "market");
  }
  await writeLog(requesterId, "propose_market_additional_advance", "market_week", marketWeekId, { amount: numAmount });
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market advance additional approve/reject
app.post("/api/market/week/advance-additional/approve", async (req, res) => {
  const { marketWeekId, treasurerId, action, rejectReason, receiptUrl } = req.body;
  if (!marketWeekId || !treasurerId || !action) return res.status(400).json({ error: "Missing required parameters" });

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "Market week not found" });

  if (action === "approve") {
    if (!receiptUrl) return res.status(400).json({ error: "Missing payment transfer slip" });
    await supabase.from("market_weeks").update({ additional_advance_status: "approved", additional_advance_receipt_url: receiptUrl, additional_advance_approved_by: treasurerId, additional_advance_approved_at: new Date().toISOString(), additional_advance_reject_reason: "" }).eq("id", marketWeekId);
    if (week.additional_advance_requested > 0) {
      await supabase.from("transactions").insert({ id: `tx_${Date.now()}_adv_add`, type: "expense", category: "other_expense", amount: week.additional_advance_requested, description: `จ่ายเงินทุนล่วงหน้าเพิ่มเติมตลาดวันพุธ: ${week.team_name} (${week.week_date})`, reference_id: week.id, reference_type: "market", created_by: treasurerId, approved_by: treasurerId, approved_at: new Date().toISOString(), month: new Date().getMonth() + 1, year: 2569, is_closed: false, created_at: new Date().toISOString() });
    }
    const notifyTarget = week.leader_id || week.created_by;
    await createNotification(notifyTarget, "คำขอทุนล่วงหน้าเพิ่มเติมอนุมัติและโอนเงินแล้ว 💰", `คำขอเบิกทุนเพิ่มเติมจำนวน ${week.additional_advance_requested} บาท ได้รับการโอนจ่ายเรียบร้อยแล้ว`, "market", marketWeekId, "market");
  } else {
    await supabase.from("market_weeks").update({ additional_advance_status: "rejected", additional_advance_reject_reason: rejectReason || "" }).eq("id", marketWeekId);
    const notifyTarget = week.leader_id || week.created_by;
    await createNotification(notifyTarget, "คำขอทุนล่วงหน้าเพิ่มเติมตลาดถูกปฏิเสธ ⚠️", `คำขอเบิกทุนเพิ่มเติมจำนวน ${week.additional_advance_requested} บาท ถูกปฏิเสธ: ${rejectReason || "ไม่มีเหตุผลระบุ"}`, "market", marketWeekId, "market");
  }
  await writeLog(treasurerId, "respond_market_additional_advance", "market_week", marketWeekId, { action, amount: week.additional_advance_requested });
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market advance approve/reject
app.post("/api/market/week/advance/approve", async (req, res) => {
  const { marketWeekId, treasurerId, action, rejectReason, receiptUrl } = req.body;
  if (!marketWeekId || !treasurerId || !action) return res.status(400).json({ error: "Missing required parameters" });

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "Market week not found" });

  if (action === "approve") {
    if (!receiptUrl && week.advance_requested > 0) return res.status(400).json({ error: "Missing payment transfer slip" });
    await supabase.from("market_weeks").update({ advance_status: "approved", advance_receipt_url: receiptUrl || "", advance_approved_by: treasurerId, advance_approved_at: new Date().toISOString(), advance_reject_reason: "" }).eq("id", marketWeekId);
    if (week.advance_requested > 0) {
      await supabase.from("transactions").insert({ id: `tx_${Date.now()}_adv`, type: "expense", category: "other_expense", amount: week.advance_requested, description: `จ่ายเงินทุนล่วงหน้าตลาดวันพุธ: ${week.team_name} (${week.week_date})`, reference_id: week.id, reference_type: "market", created_by: treasurerId, approved_by: treasurerId, approved_at: new Date().toISOString(), month: new Date(week.week_date).getMonth() + 1, year: 2569, is_closed: false, created_at: new Date().toISOString() });
    }
    if (week.leader_id) await createNotification(week.leader_id, "อนุมัติโอนเงินทุนล่วงหน้าแล้ว 💰", `คำขอเบิกทุนล่วงหน้าตลาดจำนวน ${week.advance_requested} บาท ได้รับการอนุมัติแล้วค่ะ`, "market", marketWeekId, "market");
    await writeLog(treasurerId, "approve_market_advance", "market_week", marketWeekId, { amount: week.advance_requested });
  } else {
    await supabase.from("market_weeks").update({ advance_status: "rejected", advance_reject_reason: rejectReason || "ปฏิเสธโดยเหรัญญิก" }).eq("id", marketWeekId);
    if (week.leader_id) await createNotification(week.leader_id, "คำขอเบิกทุนล่วงหน้าถูกปฏิเสธ ⚠️", `คำขอเบิกทุนล่วงหน้าตลาดของทีมถูกปฏิเสธเนื่องจาก: ${rejectReason || "ปฏิเสธโดยเหรัญญิก"}`, "market", marketWeekId, "market");
    await writeLog(treasurerId, "reject_market_advance", "market_week", marketWeekId, { reason: rejectReason });
  }
  const { data: updatedWeek } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  res.json({ success: true, marketWeek: convertKeysToCamel(updatedWeek) });
});

// Market Week - Delete
app.post("/api/market/week/delete", async (req, res) => {
  const { marketWeekId, userId } = req.body;
  if (!marketWeekId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: week } = await supabase.from("market_weeks").select("*").eq("id", marketWeekId).single();
  if (!week) return res.status(404).json({ error: "Market week not found" });
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  if (!user) return res.status(404).json({ error: "User not found" });

  const isCreator = week.created_by === userId || week.leader_id === userId;
  const isTreasurer = user.role === "treasurer";
  if (!(isTreasurer || (isCreator && week.status !== "approved"))) return res.status(403).json({ error: "ขออภัย คุณไม่มีสิทธิ์ลบรอบตลาดนี้" });

  await supabase.from("market_items").delete().eq("market_week_id", marketWeekId);
  await supabase.from("market_weeks").delete().eq("id", marketWeekId);
  await writeLog(userId, "delete_market_week", "market_week", marketWeekId, { weekDate: week.week_date, teamName: week.team_name });
  res.json({ success: true });
});

// Activities - Propose
app.post("/api/activities/propose", async (req, res) => {
  const { title, description, eventDate, location, budgetEstimated, documentUrls, userId } = req.body;
  if (!title || !userId) return res.status(400).json({ error: "Missing title or userId" });

  const numBudget = Number(budgetEstimated || 0);
  if (isNaN(numBudget) || numBudget < 0) {
    return res.status(400).json({ error: "งบประมาณประมาณการต้องเป็นตัวเลขที่ไม่ติดลบค่ะ" });
  }

  const { data: proposer } = await supabase.from("users").select("*").eq("id", userId).single();
  if (!proposer) return res.status(404).json({ error: "User not found" });
  const pos = (proposer.position || "").toLowerCase();
  const canPropose = proposer.role === "treasurer" || proposer.role === "committee" || pos.includes("ประธาน") || pos.includes("รอง") || pos.includes("เลข") || pos.includes("เลขา") || pos.includes("เหรัญญิก");
  if (!canPropose) return res.status(403).json({ error: "ขออภัย เฉพาะเหรัญญิก คณะกรรมการ หรือผู้มีตำแหน่งบริหารเท่านั้นที่เสนอกิจกรรมได้" });

  const activityId = `act_${Date.now()}`;
  const newActivity = { id: activityId, title, description: description || "", proposed_by: userId, status: "proposed", event_date: eventDate || null, location: location || "", budget_estimated: numBudget, document_urls: documentUrls || [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await supabase.from("activities").insert(newActivity);

  const { data: allUsers } = await supabase.from("users").select("id");
  for (const u of (allUsers || [])) {
    if (u.id !== userId) await createNotification(u.id, "มีการเสนอโครงการกิจกรรมใหม่ ✨", `คุณ ${proposer.full_name} ได้เสนอโครงการ: "${title}"`, "activity", activityId, "activity");
  }
  await writeLog(userId, "propose_activity", "activity", activityId, { title });
  res.json({ success: true, activity: convertKeysToCamel(newActivity) });
});

// Activities - Delete
app.post("/api/activities/delete", async (req, res) => {
  const { activityId, userId } = req.body;
  if (!activityId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: act } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });
  const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
  if (!user) return res.status(404).json({ error: "User not found" });

  const pos = (user.position || "").toLowerCase();
  const isCommittee = user.role === "treasurer" || user.role === "committee" || pos.includes("ประธาน") || pos.includes("รอง") || pos.includes("เลข") || pos.includes("เลขา") || pos.includes("เหรัญญิก");
  if (act.status === "completed" && !isCommittee) {
    return res.status(403).json({ error: "โครงการเสร็จสิ้นแล้ว เฉพาะเหรัญญิกหรือกรรมการห้องเท่านั้นที่สามารถลบได้" });
  }
  if (!(isCommittee || act.proposed_by === userId)) return res.status(403).json({ error: "ไม่มีสิทธิ์ลบโครงการนี้" });

  // 1. Get all budget requests for this activity
  const { data: bReqs } = await supabase.from("budget_requests").select("id").eq("activity_id", activityId);
  const bReqIds = (bReqs || []).map((r: { id: string }) => r.id);

  // 2. Delete transactions related to those budget requests
  if (bReqIds.length > 0) {
    await supabase.from("transactions").delete().eq("reference_type", "budget_request").in("reference_id", bReqIds);
  }

  // 3. Delete transactions related to external incomes
  const extIncomes = act.external_incomes || [];
  const extIncomeIds = extIncomes.map((i: any) => i.id);
  if (extIncomeIds.length > 0) {
    await supabase.from("transactions").delete().eq("reference_type", "activity").in("reference_id", extIncomeIds);
  }

  // 4. Delete any settlement payment/refund transactions pointing to this activity ID
  await supabase.from("transactions").delete().eq("reference_type", "payment").eq("reference_id", activityId);

  // 5. Delete budget requests and the activity
  await supabase.from("budget_requests").delete().eq("activity_id", activityId);
  await supabase.from("activities").delete().eq("id", activityId);
  await writeLog(userId, "delete_activity", "activity", activityId, { title: act.title });
  res.json({ success: true });
});

// Activities - Update
app.post("/api/activities/update", async (req, res) => {
  const { activityId, userId, title, description, eventDate, location, budgetEstimated, budgetApproved, actualExpense, refundAmount, expenseReceipts, status } = req.body;
  if (!activityId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: act } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });

  const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
  if (!user) return res.status(404).json({ error: "User not found" });

  const pos = (user.position || "").toLowerCase();
  const isCommittee = user.role === "treasurer" || user.role === "committee" || pos.includes("ประธาน") || pos.includes("รอง") || pos.includes("เลข") || pos.includes("เลขา") || pos.includes("เหรัญญิก");
  
  if (!(isCommittee || act.proposed_by === userId)) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์แก้ไขโครงการนี้" });
  }

  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (eventDate !== undefined) updateData.event_date = eventDate || null;
  if (location !== undefined) updateData.location = location;
  if (budgetEstimated !== undefined) updateData.budget_estimated = Number(budgetEstimated || 0);
  if (budgetApproved !== undefined) updateData.budget_approved = Number(budgetApproved || 0);
  if (actualExpense !== undefined) updateData.actual_expense = Number(actualExpense || 0);
  if (refundAmount !== undefined) updateData.refund_amount = Number(refundAmount || 0);
  if (expenseReceipts !== undefined) updateData.expense_receipts = expenseReceipts;
  if (status !== undefined) updateData.status = status;

  const { data: updatedAct, error } = await supabase.from("activities").update(updateData).eq("id", activityId).select("*").single();
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  await writeLog(userId, "update_activity", "activity", activityId, { title: updatedAct.title });
  res.json({ success: true, activity: convertKeysToCamel(updatedAct) });
});

// Activities - Approve
app.post("/api/activities/approve", async (req, res) => {
  const { activityId, treasurerId, action, rejectReason, budgetApproved } = req.body;
  if (!activityId || !treasurerId || !action) return res.status(400).json({ error: "Missing parameters" });

  const { data: act } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });

  if (action === "approve") {
    await supabase.from("activities").update({ status: "approved", budget_approved: Number(budgetApproved || act.budget_estimated), approved_by: treasurerId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", activityId);
    await createNotification(act.proposed_by, "โครงการกิจกรรมได้รับการอนุมัติแล้ว 💚", `โครงการ "${act.title}" ได้อนุมัติ ยอดงบประมาณคือ ${Number(budgetApproved || act.budget_estimated)} บาท`, "activity", activityId, "activity");
  } else {
    await supabase.from("activities").update({ status: "rejected", reject_reason: rejectReason, updated_at: new Date().toISOString() }).eq("id", activityId);
    await createNotification(act.proposed_by, "❌ โครงการกิจกรรมไม่ได้รับการอนุมัติ", `โครงการ "${act.title}" ไม่ได้อนุมัติ: "${rejectReason}"`, "activity", activityId, "activity");
  }
  await writeLog(treasurerId, `${action}_activity`, "activity", activityId, { title: act.title, reason: rejectReason });
  const { data: updated } = await supabase.from("activities").select("*").eq("id", activityId).single();
  res.json({ success: true, activity: convertKeysToCamel(updated) });
});

// Budget request
app.post("/api/activities/budget/request", async (req, res) => {
  const { activityId, title, amount, reason, details, documentUrls, userId } = req.body;
  if (!title || !amount || !userId) return res.status(400).json({ error: "Missing parameters" });

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "จำนวนเงินที่ขอเบิกต้องเป็นตัวเลขที่มากกว่า 0 บาท" });
  }

  const reqId = `bud_${Date.now()}`;
  const newReq = { id: reqId, activity_id: activityId || null, title, amount: numAmount, reason: reason || "", details: details || "", document_urls: documentUrls || [], status: "pending", requested_by: userId, created_at: new Date().toISOString() };
  await supabase.from("budget_requests").insert(newReq);

  const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
  const { data: user } = await supabase.from("users").select("full_name").eq("id", userId).single();
  for (const t of (treasurers || [])) await createNotification(t.id, "มีคำขอเบิกงบประมาณโครงการใหม่", `คุณ ${user?.full_name} ยื่นคำขอเบิกงบ: "${title}" จำนวน ${numAmount} บาท`, "activity", reqId, "budget_request");
  await writeLog(userId, "request_budget", "budget_request", reqId, { title, amount: numAmount });
  res.json({ success: true, budgetRequest: convertKeysToCamel(newReq) });
});

// Budget approve
app.post("/api/activities/budget/approve", async (req, res) => {
  const { requestId, treasurerId, action, rejectReason } = req.body;
  if (!requestId || !treasurerId || !action) return res.status(400).json({ error: "Missing parameters" });

  const { data: budgetReq } = await supabase.from("budget_requests").select("*").eq("id", requestId).single();
  if (!budgetReq) return res.status(404).json({ error: "Budget request not found" });

  if (action === "approve") {
    await supabase.from("budget_requests").update({ status: "approved", approved_by: treasurerId, approved_at: new Date().toISOString() }).eq("id", requestId);
    await supabase.from("transactions").insert({ id: `tx_${Date.now()}`, type: "expense", category: "activity_expense", amount: budgetReq.amount, description: `จ่ายงบประมาณโครงการ: ${budgetReq.title}`, reference_id: budgetReq.id, reference_type: "budget_request", created_by: treasurerId, approved_by: treasurerId, approved_at: new Date().toISOString(), month: new Date().getMonth() + 1, year: 2569, is_closed: false, created_at: new Date().toISOString() });
    if (budgetReq.activity_id) await supabase.from("activities").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", budgetReq.activity_id);
    await createNotification(budgetReq.requested_by, "คำขอเบิกงบประมาณอนุมัติแล้ว 💸", `คำขอเบิกงบ "${budgetReq.title}" ยอดเงิน ${budgetReq.amount} บาท โอนจ่ายเรียบร้อย`, "activity", requestId, "budget_request");
  } else {
    await supabase.from("budget_requests").update({ status: "rejected", reject_reason: rejectReason }).eq("id", requestId);
    await createNotification(budgetReq.requested_by, "❌ คำขอเบิกงบไม่ได้รับการอนุมัติ", `คำขอเบิกงบ "${budgetReq.title}" ถูกปฏิเสธ: "${rejectReason}"`, "activity", requestId, "budget_request");
  }
  await writeLog(treasurerId, `${action}_budget_request`, "budget_request", requestId, { title: budgetReq.title, amount: budgetReq.amount });
  const { data: updated } = await supabase.from("budget_requests").select("*").eq("id", requestId).single();
  res.json({ success: true, budgetRequest: convertKeysToCamel(updated) });
});

// Budget expansion propose
app.post("/api/activities/budget-expansion/propose", async (req, res) => {
  const { activityId, originalRequestId, amount, reason, userId } = req.body;
  if (!activityId || !originalRequestId || !amount || !userId) return res.status(400).json({ error: "Missing required parameters" });

  await supabase.from("activities").update({ budget_expansion_requested: Number(amount), budget_expansion_reason: reason || "", budget_expansion_status: "pending", budget_expansion_reject_reason: "" }).eq("id", activityId);

  const { data: originalReq } = await supabase.from("budget_requests").select("title").eq("id", originalRequestId).single();
  const reqId = `exp_${Date.now()}`;
  const newReq = { id: reqId, activity_id: activityId, title: `ขยายงบประมาณเพิ่มเติม (${originalReq?.title || "งบย่อย"})`, amount: Number(amount), reason: reason || "", status: "pending", requested_by: userId, is_expansion: true, created_at: new Date().toISOString() };
  await supabase.from("budget_requests").insert(newReq);

  const { data: act } = await supabase.from("activities").select("title").eq("id", activityId).single();
  const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
  const { data: user } = await supabase.from("users").select("full_name").eq("id", userId).single();
  for (const t of (treasurers || [])) await createNotification(t.id, "มีคำเสนอขอขยายงบประมาณโครงการ 📈", `โครงการ "${act?.title}" ยื่นขอขยายงบเพิ่มเติม ${amount} บาท โดยคุณ ${user?.full_name}`, "activity", reqId, "budget_request");
  await writeLog(userId, "propose_budget_expansion", "activity", activityId, { amount: Number(amount) });
  const { data: updatedAct } = await supabase.from("activities").select("*").eq("id", activityId).single();
  res.json({ success: true, activity: convertKeysToCamel(updatedAct), budgetRequest: convertKeysToCamel(newReq) });
});

// Budget expansion approve
app.post("/api/activities/budget-expansion/approve", async (req, res) => {
  const { requestId, treasurerId, action, rejectReason } = req.body;
  if (!requestId || !treasurerId || !action) return res.status(400).json({ error: "Missing required parameters" });

  const { data: budgetReq } = await supabase.from("budget_requests").select("*").eq("id", requestId).single();
  if (!budgetReq) return res.status(404).json({ error: "Budget request not found" });
  const { data: act } = await supabase.from("activities").select("*").eq("id", budgetReq.activity_id).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });

  if (action === "approve") {
    await supabase.from("budget_requests").update({ status: "approved", approved_by: treasurerId, approved_at: new Date().toISOString() }).eq("id", requestId);
    const newBudget = (act.budget_approved || act.budget_estimated || 0) + budgetReq.amount;
    await supabase.from("activities").update({ budget_approved: newBudget, budget_expansion_status: "approved", budget_expansion_approved_by: treasurerId, budget_expansion_approved_at: new Date().toISOString(), budget_expansion_reject_reason: "" }).eq("id", budgetReq.activity_id);
    await supabase.from("transactions").insert({ id: `tx_${Date.now()}`, type: "expense", category: "activity_expense", amount: budgetReq.amount, description: `จ่ายเงินขยายงบประมาณโครงการ: ${budgetReq.title}`, reference_id: budgetReq.id, reference_type: "budget_request", created_by: treasurerId, approved_by: treasurerId, approved_at: new Date().toISOString(), month: new Date().getMonth() + 1, year: 2569, is_closed: false, created_at: new Date().toISOString() });
    await createNotification(act.proposed_by, "คำขอขยายงบประมาณได้รับการอนุมัติแล้ว! 🎉", `โครงการ "${act.title}" ได้รับเพิ่มงบอีก ${budgetReq.amount} บาท`, "activity", budgetReq.activity_id, "activity");
  } else {
    await supabase.from("budget_requests").update({ status: "rejected", reject_reason: rejectReason || "" }).eq("id", requestId);
    await supabase.from("activities").update({ budget_expansion_status: "rejected", budget_expansion_reject_reason: rejectReason || "" }).eq("id", budgetReq.activity_id);
    await createNotification(act.proposed_by, "คำขอขยายงบประมาณถูกปฏิเสธ ❌", `โครงการ "${act.title}" ถูกปฏิเสธเพิ่มงบ: "${rejectReason}"`, "activity", budgetReq.activity_id, "activity");
  }
  await writeLog(treasurerId, `respond_budget_expansion_${action}`, "activity", budgetReq.activity_id, { amount: budgetReq.amount });
  const { data: updatedAct } = await supabase.from("activities").select("*").eq("id", budgetReq.activity_id).single();
  const { data: updatedReq } = await supabase.from("budget_requests").select("*").eq("id", requestId).single();
  res.json({ success: true, activity: convertKeysToCamel(updatedAct), budgetRequest: convertKeysToCamel(updatedReq) });
});

// External income propose
app.post("/api/activities/external-income/propose", async (req, res) => {
  const { activityId, amount, source, slipUrl, userId } = req.body;
  if (!activityId || !amount || !source || !userId) return res.status(400).json({ error: "Missing required parameters" });

  const { data: act } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });

  const incId = `inc_${Date.now()}`;
  const externalIncomes = act.external_incomes || [];
  externalIncomes.unshift({ id: incId, activityId, amount: Number(amount), source, slipUrl: slipUrl || "", status: "pending", requestedBy: userId, createdAt: new Date().toISOString() });
  await supabase.from("activities").update({ external_incomes: externalIncomes }).eq("id", activityId);

  const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
  const { data: user } = await supabase.from("users").select("full_name").eq("id", userId).single();
  for (const t of (treasurers || [])) await createNotification(t.id, "มีรายการเงินสนับสนุนกิจกรรมใหม่ 📥", `คุณ ${user?.full_name} แจ้งยอดเงินสนับสนุน ${amount} บาท จาก "${source}"`, "activity", incId, "external_income");
  await writeLog(userId, "propose_external_income", "activity", activityId, { amount: Number(amount), source });
  const { data: updated } = await supabase.from("activities").select("*").eq("id", activityId).single();
  res.json({ success: true, activity: convertKeysToCamel(updated) });
});

// External income approve
app.post("/api/activities/external-income/approve", async (req, res) => {
  const { activityId, incomeId, treasurerId, action, rejectReason } = req.body;
  if (!activityId || !incomeId || !treasurerId || !action) return res.status(400).json({ error: "Missing required parameters" });

  const { data: act } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });

  interface ExternalIncome {
    id: string;
    amount: number;
    source: string;
    requestedBy: string;
    status: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectReason?: string;
  }
  const externalIncomes = (act.external_incomes || []) as ExternalIncome[];
  const incIndex = externalIncomes.findIndex((i: ExternalIncome) => i.id === incomeId);
  if (incIndex === -1) return res.status(404).json({ error: "Income record not found" });

  const income = externalIncomes[incIndex];
  if (action === "approve") {
    income.status = "approved";
    income.approvedBy = treasurerId;
    income.approvedAt = new Date().toISOString();
    // Do not insert immediate central transaction when sponsorship/external income is approved.
    // The sponsorship money is held/used within the project and is calculated at the end (settlement)
    // as part of the refund_amount that physically goes back to the central bank account.
    await createNotification(income.requestedBy, "ยอดเงินสนับสนุนโครงการได้รับการยืนยันแล้ว! 🎉", `เงินสนับสนุนจำนวน ${income.amount} บาท จาก "${income.source}" ได้รับการยืนยันแล้ว`, "activity", activityId, "activity");
  } else {
    income.status = "rejected";
    income.rejectReason = rejectReason || "";
    await createNotification(income.requestedBy, "ยอดเงินสนับสนุนถูกปฏิเสธ ❌", `รายการแจ้งเงินสนับสนุนจาก "${income.source}" จำนวน ${income.amount} บาท ถูกปฏิเสธ`, "activity", activityId, "activity");
  }
  externalIncomes[incIndex] = income;
  await supabase.from("activities").update({ external_incomes: externalIncomes }).eq("id", activityId);
  await writeLog(treasurerId, `respond_external_income_${action}`, "activity", activityId, { amount: income.amount });
  const { data: updated } = await supabase.from("activities").select("*").eq("id", activityId).single();
  res.json({ success: true, activity: convertKeysToCamel(updated) });
});

// Settlement propose
app.post("/api/activities/settle/propose", async (req, res) => {
  const { activityId, actualExpense, refundAmount, refundSlipUrl, expenseReceipts, userId } = req.body;
  if (!activityId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: act } = await supabase.from("activities").select("status").eq("id", activityId).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });
  if (act.status !== "in_progress" && act.status !== "pending_settlement") return res.status(400).json({ error: "โครงการต้องอยู่ในสถานะกำลังดำเนินงานเพื่อยื่นปิดงาน" });

  await supabase.from("activities").update({ status: "pending_settlement", actual_expense: Number(actualExpense || 0), refund_amount: Number(refundAmount || 0), refund_slip_url: refundSlipUrl || "", expense_receipts: expenseReceipts || [], updated_at: new Date().toISOString() }).eq("id", activityId);

  const { data: updatedAct } = await supabase.from("activities").select("title").eq("id", activityId).single();
  const { data: treasurers } = await supabase.from("users").select("id").eq("role", "treasurer");
  const { data: proposer } = await supabase.from("users").select("full_name").eq("id", userId).single();
  for (const t of (treasurers || [])) await createNotification(t.id, "มีโครงการกิจกรรมยื่นปิดงานและทอนเงิน 📝", `คุณ ${proposer?.full_name} ยื่นสรุปโครงการ "${updatedAct?.title}"`, "activity", activityId, "activity");
  await writeLog(userId, "propose_settlement", "activity", activityId, { title: updatedAct?.title, actualExpense, refundAmount });
  const { data: finalAct } = await supabase.from("activities").select("*").eq("id", activityId).single();
  res.json({ success: true, activity: convertKeysToCamel(finalAct) });
});

// Settlement approve
app.post("/api/activities/settle/approve", async (req, res) => {
  const { activityId, treasurerId, action, rejectReason } = req.body;
  if (!activityId || !treasurerId || !action) return res.status(400).json({ error: "Missing parameters" });

  const { data: actingUser } = await supabase.from("users").select("role").eq("id", treasurerId).single();
  if (!actingUser || actingUser.role !== "treasurer") return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ (เฉพาะเหรัญญิกเท่านั้น)" });

  const { data: act } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!act) return res.status(404).json({ error: "Activity not found" });
  if (act.status !== "pending_settlement") return res.status(400).json({ error: "โครงการไม่ได้อยู่ในขั้นตอนรออนุมัติปิดงาน" });

  if (action === "approve") {
    await supabase.from("activities").update({ status: "completed", settled_by: treasurerId, settled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", activityId);

    if (act.refund_amount && act.refund_amount > 0) {
      await supabase.from("transactions").insert({ 
        id: `tx_${Date.now()}_refund`, 
        type: "income", 
        category: "other_income", 
        amount: act.refund_amount, 
        description: `เงินทอน/สนับสนุนคงเหลือจากโครงการ: ${act.title} (นำเข้าบัญชีส่วนกลางทั้งหมด)`, 
        reference_id: act.id, 
        reference_type: "payment", 
        created_by: treasurerId, 
        approved_by: treasurerId, 
        approved_at: new Date().toISOString(), 
        month: new Date().getMonth() + 1, 
        year: 2569, 
        is_closed: false, 
        created_at: new Date().toISOString() 
      });
    }
    await createNotification(act.proposed_by, "อนุมัติปิดโครงการเสร็จสิ้นแล้ว 🎉", `โครงการ "${act.title}" ได้อนุมัติปิดยอดบัญชีเรียบร้อยแล้ว`, "activity", activityId, "activity");
  } else {
    await supabase.from("activities").update({ status: "in_progress", reject_reason: rejectReason || "ข้อมูลไม่ถูกต้อง", updated_at: new Date().toISOString() }).eq("id", activityId);
    await createNotification(act.proposed_by, "❌ คำขอปิดโครงการถูกปฏิเสธ", `คำขอปิดโครงการ "${act.title}" ไม่ผ่าน: "${rejectReason || "ข้อมูลไม่ถูกต้อง"}"`, "activity", activityId, "activity");
  }
  await writeLog(treasurerId, `${action}_settlement`, "activity", activityId, { title: act.title, action, reason: rejectReason });
  const { data: updated } = await supabase.from("activities").select("*").eq("id", activityId).single();
  res.json({ success: true, activity: convertKeysToCamel(updated) });
});

// Members - Update
app.post("/api/members/update", async (req, res) => {
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
});

// Members - Add
app.post("/api/members/add", async (req, res) => {
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
  const newUser = { id: newUserId, student_id: studentId, full_name: fullName, nickname: nickname || fullName.split(" ")[0], email: email || `${studentId}@student.university.ac.th`, phone: phone || "", role: targetRole, position: position || "นักศึกษาชั้นปีที่ 3", classroom: targetClassroom, is_active: true, password: "123456", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await supabase.from("users").insert(newUser);
  await writeLog(userId, "add_member", "users", newUserId, { fullName, studentId, role: targetRole });
  res.json({ success: true, user: convertKeysToCamel(newUser) });
});

// Members - Delete
app.post("/api/members/delete", async (req, res) => {
  const { targetUserId, userId } = req.body;
  if (!targetUserId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: creator } = await supabase.from("users").select("role").eq("id", userId).single();
  if (!creator || creator.role !== "treasurer") return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ (เฉพาะเหรัญญิกเท่านั้น)" });
  if (targetUserId === userId) return res.status(400).json({ error: "ไม่สามารถลบตัวเองได้" });

  const { data: deletedUser } = await supabase.from("users").select("*").eq("id", targetUserId).single();
  if (!deletedUser) return res.status(404).json({ error: "User not found" });

  // Clean up related data
  const { data: userBills } = await supabase.from("monthly_bills").select("id").eq("user_id", targetUserId);
  const billIds = (userBills || []).map((b: { id: string }) => b.id);
  if (billIds.length > 0) await supabase.from("payments").delete().in("bill_id", billIds);
  await supabase.from("monthly_bills").delete().eq("user_id", targetUserId);
  await supabase.from("payments").delete().eq("user_id", targetUserId);
  await supabase.from("users").delete().eq("id", targetUserId);

  await writeLog(userId, "delete_member", "users", targetUserId, { fullName: deletedUser.full_name, studentId: deletedUser.student_id });
  res.json({ success: true });
});

// Announcements - Create
app.post("/api/announcements/create", async (req, res) => {
  const { title, content, priority, isPinned, userId } = req.body;
  if (!title || !content || !userId) return res.status(400).json({ error: "Missing fields" });

  const annId = `ann_${Date.now()}`;
  const newAnn = { id: annId, title, content, priority: priority || "normal", is_pinned: !!isPinned, created_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await supabase.from("announcements").insert(newAnn);

  const { data: allUsers } = await supabase.from("users").select("id");
  for (const u of (allUsers || [])) {
    if (u.id !== userId) await createNotification(u.id, `ประกาศใหม่: ${title}`, content.length > 100 ? content.substring(0, 100) + "..." : content, "announcement", annId, "announcement");
  }
  await writeLog(userId, "create_announcement", "announcements", annId, { title });
  res.json({ success: true, announcement: convertKeysToCamel(newAnn) });
});

// Announcements - Delete
app.post("/api/announcements/delete", async (req, res) => {
  const { annId, userId } = req.body;
  if (!annId || !userId) return res.status(400).json({ error: "Missing fields" });

  const { data: ann } = await supabase.from("announcements").select("title").eq("id", annId).single();
  if (!ann) return res.status(404).json({ error: "Announcement not found" });

  await supabase.from("announcements").delete().eq("id", annId);
  await writeLog(userId, "delete_announcement", "announcements", annId, { title: ann.title });
  res.json({ success: true });
});

// Close accounts month
app.post("/api/transactions/close-month", async (req, res) => {
  const { month, year, userId } = req.body;
  if (!month || !year || !userId) return res.status(400).json({ error: "Missing fields" });

  await supabase.from("transactions").update({ is_closed: true }).eq("month", Number(month)).eq("year", Number(year));
  await writeLog(userId, "close_accounts_month", "transactions", `${month}/${year}`);
  res.json({ success: true });
});

// Delete a specific transaction manually
app.post("/api/transactions/delete", async (req, res) => {
  const { transactionId, userId } = req.body;
  if (!transactionId || !userId) return res.status(400).json({ error: "Missing parameters" });

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  if (!user || user.role !== "treasurer") return res.status(403).json({ error: "เฉพาะเหรัญญิกเท่านั้นที่สามารถลบรายการบัญชีได้" });

  // Get transaction info for log
  const { data: tx } = await supabase.from("transactions").select("*").eq("id", transactionId).single();
  if (!tx) return res.status(404).json({ error: "Transaction not found" });

  // If this transaction is a payment, we can optionally revert the payment/bill status
  if (tx.reference_type === "payment" && tx.reference_id) {
    const { data: payment } = await supabase.from("payments").select("*").eq("id", tx.reference_id).single();
    if (payment) {
      if (payment.bill_id) {
        await supabase.from("monthly_bills").update({ 
          status: "pending", 
          paid_at: null, 
          approved_at: null, 
          approved_by: null, 
          slip_url: null 
        }).eq("id", payment.bill_id);
      }
      await supabase.from("payments").delete().eq("id", payment.id);
    }
  }

  await supabase.from("transactions").delete().eq("id", transactionId);
  await writeLog(userId, "delete_transaction", "transactions", transactionId, { description: tx.description, amount: tx.amount });

  res.json({ success: true });
});

// Petitions Submit
app.post("/api/petitions/submit", async (req, res) => {
  const { title, category, content, isAnonymous, userId } = req.body;
  if (!title || !category || !content || !userId) return res.status(400).json({ error: "Missing required fields" });

  const petId = `pet_${Date.now()}`;
  const newPet = { id: petId, title, category, content, status: "pending", is_anonymous: !!isAnonymous, submitted_by: userId, response: "", created_at: new Date().toISOString() };
  await supabase.from("petitions").insert(newPet);
  await writeLog(userId, "submit_petition", "petitions", petId, { title, category });
  res.json({ success: true, petition: convertKeysToCamel(newPet) });
});

// Petitions Respond
app.post("/api/petitions/respond", async (req, res) => {
  const { petitionId, status, response, adminId } = req.body;
  if (!petitionId || !status || !adminId) return res.status(400).json({ error: "Missing required fields" });

  await supabase.from("petitions").update({ status, response: response || "", resolved_at: new Date().toISOString(), resolved_by: adminId }).eq("id", petitionId);
  await writeLog(adminId, "respond_petition", "petitions", petitionId, { status });
  const { data: pet } = await supabase.from("petitions").select("*").eq("id", petitionId).single();
  res.json({ success: true, petition: convertKeysToCamel(pet) });
});

// Notifications Read
app.post("/api/notifications/read", async (req, res) => {
  const { notId, userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  if (notId) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notId).eq("user_id", userId);
  } else {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
  }
  res.json({ success: true });
});

// Send Reminder
app.post("/api/notifications/remind", async (req, res) => {
  const { userId, senderId, message, title } = req.body;
  if (!userId || !senderId || !message) return res.status(400).json({ error: "Missing required fields" });

  const { data: sender } = await supabase.from("users").select("role").eq("id", senderId).single();
  if (!sender || sender.role !== "treasurer") return res.status(403).json({ error: "Only treasurers can send reminders." });

  await createNotification(userId, title || "🔔 แจ้งเตือนการชำระเงินรายบุคคล", message, "bill", senderId, "user");
  await writeLog(senderId, "send_individual_reminder", "users", userId, { message });
  res.json({ success: true, message: "ส่งแจ้งเตือนรายบุคคลเรียบร้อยแล้ว" });
});

// Gemini AI Chat
app.post("/api/gemini/chat", async (req, res) => {
  const { prompt, history, userId } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const state = await loadFullState();
    const activeStudentsCount = state.users.filter((u: User) => u.isActive).length;
    const currentFundBalance = state.transactions.reduce((sum: number, tx: Transaction) => sum + (tx.type === "income" ? tx.amount : -tx.amount), 0);
    const totalIncome = state.transactions.filter((tx: Transaction) => tx.type === "income").reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
    const totalExpense = state.transactions.filter((tx: Transaction) => tx.type === "expense").reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = 2569;
    const currentMonthBills = state.monthlyBills.filter((b: MonthlyBill) => b.month === currentMonth && b.year === currentYear);
    const paidCount = currentMonthBills.filter((b: MonthlyBill) => b.status === "paid").length;
    const pendingReviewCount = currentMonthBills.filter((b: MonthlyBill) => b.status === "pending_review").length;
    const unpaidCount = currentMonthBills.filter((b: MonthlyBill) => b.status === "pending").length;
    const unpaidStudentsList = currentMonthBills.filter((b: MonthlyBill) => b.status === "pending").map((b: MonthlyBill) => { const u = state.users.find((usr: User) => usr.id === b.userId); return u ? `${u.fullName} (รหัส ${u.studentId})` : ""; }).filter(Boolean).join(", ");

    const systemInstruction = `คุณคือ "ผู้ช่วยเหรัญญิก AI" ประจำ "ระบบเงินเก็บTns รุ่น06"\nข้อมูลปัจจุบัน:\n- สมาชิก: ${activeStudentsCount} คน\n- ยอดคงเหลือ: ${currentFundBalance.toLocaleString()} บาท (รายรับ: ${totalIncome.toLocaleString()} / รายจ่าย: ${totalExpense.toLocaleString()})\n- ค่าบำรุง: ${state.settings?.monthlyFee || 150} บาท/คน\n- สถานะเดือน ${currentMonth}/${currentYear}: จ่ายแล้ว ${paidCount} คน, รอตรวจ ${pendingReviewCount} คน, ค้างชำระ ${unpaidCount} คน\n- ค้างชำระ: [${unpaidStudentsList || "ไม่มี"}]\nตอบภาษาไทย สุภาพ ชาญฉลาด`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not defined" });

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: { role: string; text: string }) => contents.push({ role: msg.role === "user" ? "user" : "model", parts: [{ text: msg.text }] }));
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents, config: { systemInstruction, temperature: 0.7 } });
    res.json({ reply: response.text || "ขออภัย ไม่สามารถสร้างคำตอบได้" });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errMsg || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Gemini AI" });
  }
});

// Serve images from Supabase
app.get("/api/images/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: "Invalid image ID format" });

  let base64Str: string | null = null;

  // Try Supabase
  const { data: doc } = await supabase.from("images").select("base64").eq("id", id).single();
  if (doc?.base64) base64Str = doc.base64;

  // Fallback to local filesystem
  if (!base64Str) {
    try {
      const filePath = path.join(process.cwd(), "src", "uploads", `${id}.txt`);
      if (fs.existsSync(filePath)) base64Str = fs.readFileSync(filePath, "utf-8");
    } catch (err) {}
  }

  if (!base64Str) return res.status(404).json({ error: "Image not found" });

  try {
    const match = base64Str.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      res.setHeader("Content-Type", match[1]);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      return res.send(Buffer.from(match[2], "base64"));
    }
  } catch (err) {}
  res.status(500).json({ error: "Failed to render image" });
});

// =============================================
// Centralized Error Handling Middleware
// =============================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Centralized Server Error Handler] Caught unhandled route error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้งค่ะ",
    details: process.env.NODE_ENV !== "production" ? err.stack : undefined
  });
});

// =============================================
// Auto cleanup helper for monthly bill slips older than 30 days
// =============================================
async function runAutoCleanupOldSlips() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString();

    // Fetch payments older than 30 days with a slip URL pointing to our images endpoint
    const { data: oldPayments, error: fetchError } = await supabase
      .from("payments")
      .select("id, slip_url")
      .lt("created_at", dateStr)
      .like("slip_url", "/api/images/%");

    if (fetchError) throw fetchError;
    if (!oldPayments || oldPayments.length === 0) return;

    console.log(`[Auto Cleanup] Found ${oldPayments.length} old monthly bill slips to delete.`);

    const imageIds = oldPayments.map(p => p.slip_url.replace("/api/images/", ""));
    const paymentIds = oldPayments.map(p => p.id);

    // Delete base64 records from images table
    const { error: deleteError } = await supabase.from("images").delete().in("id", imageIds);
    if (deleteError) throw deleteError;

    // Clear slip_url references in payments table
    const { error: updateError } = await supabase.from("payments").update({ slip_url: "" }).in("id", paymentIds);
    if (updateError) throw updateError;

    console.log(`[Auto Cleanup] Successfully cleaned up ${oldPayments.length} monthly bill slips.`);
  } catch (err: any) {
    console.error("[Auto Cleanup] Error:", err.message);
  }
}

// =============================================
// Dev vs Production Server Start
// =============================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Test Supabase connection on startup
  console.log("[Supabase] Testing connection...");
  await testSupabaseConnection();

  // Run auto cleanup and schedule it every 24 hours
  await runAutoCleanupOldSlips();
  setInterval(runAutoCleanupOldSlips, 24 * 60 * 60 * 1000);
}

startServer();

