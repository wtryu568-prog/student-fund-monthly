/**
 * Migration Script: db.json → Supabase
 * อ่านข้อมูลจาก src/db.json แล้ว insert เข้า Supabase tables
 * 
 * Usage: npx tsx scripts/migrate-to-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DB_PATH = path.join(process.cwd(), "src", "db.json");

// Helper: convert camelCase to snake_case
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Helper: convert object keys from camelCase to snake_case
function convertKeysToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnake);
  if (typeof obj !== "object") return obj;
  
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = toSnakeCase(key);
    const value = obj[key];
    // Don't convert nested objects that are stored as JSONB (arrays/objects that should stay as-is)
    if (["memberIds", "documentUrls", "expenseReceipts", "externalIncomes", "details", "document_urls", "expense_receipts", "external_incomes", "member_ids"].includes(key)) {
      result[snakeKey] = value;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[snakeKey] = convertKeysToSnake(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

async function migrate() {
  console.log("🚀 Starting migration from db.json to Supabase...\n");
  
  // 1. Read db.json
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ db.json not found at ${DB_PATH}`);
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(DB_PATH, "utf-8");
  const state = JSON.parse(rawData);
  console.log(`✅ Loaded db.json (${(rawData.length / 1024).toFixed(1)} KB)\n`);
  
  // 2. Test Supabase connection
  console.log("🔌 Testing Supabase connection...");
  const { data: testData, error: testError } = await supabase.from("users").select("count").limit(1);
  if (testError) {
    console.error(`❌ Cannot connect to Supabase: ${testError.message}`);
    console.error("⚠️  Make sure you ran the SQL schema first (scripts/create-tables.sql)");
    process.exit(1);
  }
  console.log("✅ Connected to Supabase!\n");
  
  // 3. Import Users
  if (state.users && state.users.length > 0) {
    console.log(`📦 Importing ${state.users.length} users...`);
    const users = state.users.map((u: any) => ({
      id: u.id,
      student_id: u.studentId,
      full_name: u.fullName,
      nickname: u.nickname || "",
      email: u.email || "",
      avatar_url: u.avatarUrl || "",
      role: u.role || "member",
      position: u.position || "นักศึกษา",
      phone: u.phone || "",
      password: u.password || "123456",
      is_active: u.isActive !== false,
      classroom: u.classroom || "ห้อง 1",
      created_at: u.createdAt || new Date().toISOString(),
      updated_at: u.updatedAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("users").upsert(users, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Users error: ${error.message}`);
    } else {
      console.log(`  ✅ ${users.length} users imported`);
    }
  }
  
  // 4. Import Settings
  if (state.settings) {
    console.log("📦 Importing settings...");
    const settings = {
      id: "main",
      fund_name: state.settings.fundName || "เงินเก็บTns รุ่น06",
      monthly_fee: state.settings.monthlyFee || 150,
      promptpay_number: state.settings.promptpayNumber || "",
      promptpay_name: state.settings.promptpayName || "",
      promptpay_qr_url: state.settings.promptpayQrUrl || "",
      bank_name: state.settings.bankName || "พร้อมเพย์",
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from("settings").upsert(settings, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Settings error: ${error.message}`);
    } else {
      console.log("  ✅ Settings imported");
    }
  }
  
  // 5. Import Monthly Bills
  if (state.monthlyBills && state.monthlyBills.length > 0) {
    console.log(`📦 Importing ${state.monthlyBills.length} monthly bills...`);
    const bills = state.monthlyBills.map((b: any) => ({
      id: b.id,
      user_id: b.userId,
      month: b.month,
      year: b.year,
      amount: b.amount,
      status: b.status || "pending",
      due_date: b.dueDate,
      paid_at: b.paidAt || null,
      created_at: b.createdAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("monthly_bills").upsert(bills, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Bills error: ${error.message}`);
    } else {
      console.log(`  ✅ ${bills.length} bills imported`);
    }
  }
  
  // 6. Import Payments
  if (state.payments && state.payments.length > 0) {
    console.log(`📦 Importing ${state.payments.length} payments...`);
    const payments = state.payments.map((p: any) => ({
      id: p.id,
      user_id: p.userId,
      bill_id: p.billId,
      amount: p.amount,
      slip_url: p.slipUrl || "",
      status: p.status || "pending_review",
      reviewed_by: p.reviewedBy || null,
      reviewed_at: p.reviewedAt || null,
      reject_reason: p.rejectReason || "",
      receipt_number: p.receiptNumber || "",
      note: p.note || "",
      created_at: p.createdAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("payments").upsert(payments, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Payments error: ${error.message}`);
    } else {
      console.log(`  ✅ ${payments.length} payments imported`);
    }
  }
  
  // 7. Import Transactions
  if (state.transactions && state.transactions.length > 0) {
    console.log(`📦 Importing ${state.transactions.length} transactions...`);
    const txs = state.transactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description || "",
      reference_id: t.referenceId || null,
      reference_type: t.referenceType || null,
      receipt_url: t.receiptUrl || "",
      created_by: t.createdBy,
      approved_by: t.approvedBy || null,
      approved_at: t.approvedAt || null,
      month: t.month,
      year: t.year,
      is_closed: t.isClosed || false,
      created_at: t.createdAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("transactions").upsert(txs, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Transactions error: ${error.message}`);
    } else {
      console.log(`  ✅ ${txs.length} transactions imported`);
    }
  }
  
  // 8. Import Market Weeks
  if (state.marketWeeks && state.marketWeeks.length > 0) {
    console.log(`📦 Importing ${state.marketWeeks.length} market weeks...`);
    const weeks = state.marketWeeks.map((w: any) => ({
      id: w.id,
      week_date: w.weekDate,
      total_cost: w.totalCost || 0,
      total_revenue: w.totalRevenue || 0,
      total_profit: w.totalProfit || 0,
      status: w.status || "planned",
      approved_by: w.approvedBy || null,
      approved_at: w.approvedAt || null,
      note: w.note || "",
      created_by: w.createdBy,
      created_at: w.createdAt || new Date().toISOString(),
      team_name: w.teamName || "",
      leader_id: w.leaderId || null,
      member_ids: w.memberIds || [],
      advance_requested: w.advanceRequested || 0,
      advance_reason: w.advanceReason || "",
      advance_status: w.advanceStatus || "none",
      advance_approved_by: w.advanceApprovedBy || null,
      advance_approved_at: w.advanceApprovedAt || null,
      advance_reject_reason: w.advanceRejectReason || "",
      advance_receipt_url: w.advanceReceiptUrl || "",
      additional_advance_requested: w.additionalAdvanceRequested || 0,
      additional_advance_reason: w.additionalAdvanceReason || "",
      additional_advance_status: w.additionalAdvanceStatus || "none",
      additional_advance_approved_by: w.additionalAdvanceApprovedBy || null,
      additional_advance_approved_at: w.additionalAdvanceApprovedAt || null,
      additional_advance_reject_reason: w.additionalAdvanceRejectReason || "",
      additional_advance_receipt_url: w.additionalAdvanceReceiptUrl || "",
    }));
    
    const { error } = await supabase.from("market_weeks").upsert(weeks, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Market weeks error: ${error.message}`);
    } else {
      console.log(`  ✅ ${weeks.length} market weeks imported`);
    }
  }
  
  // 9. Import Market Items
  if (state.marketItems && state.marketItems.length > 0) {
    console.log(`📦 Importing ${state.marketItems.length} market items...`);
    const items = state.marketItems.map((i: any) => ({
      id: i.id,
      market_week_id: i.marketWeekId,
      item_name: i.itemName,
      type: i.type,
      amount: i.amount || 0,
      quantity: i.quantity || 1,
      receipt_url: i.receiptUrl || "",
      note: i.note || "",
      created_by: i.createdBy,
      created_at: i.createdAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("market_items").upsert(items, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Market items error: ${error.message}`);
    } else {
      console.log(`  ✅ ${items.length} market items imported`);
    }
  }
  
  // 10. Import Market Teams
  if (state.marketTeams && state.marketTeams.length > 0) {
    console.log(`📦 Importing ${state.marketTeams.length} market teams...`);
    const teams = state.marketTeams.map((t: any) => ({
      id: t.id,
      market_week_id: t.marketWeekId,
      user_id: t.userId,
      role: t.role,
      created_at: t.createdAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("market_teams").upsert(teams, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Market teams error: ${error.message}`);
    } else {
      console.log(`  ✅ ${teams.length} market teams imported`);
    }
  }
  
  // 11. Import Activities
  if (state.activities && state.activities.length > 0) {
    console.log(`📦 Importing ${state.activities.length} activities...`);
    const activities = state.activities.map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description || "",
      proposed_by: a.proposedBy,
      status: a.status || "proposed",
      event_date: a.eventDate || null,
      location: a.location || "",
      budget_estimated: a.budgetEstimated || 0,
      budget_approved: a.budgetApproved || 0,
      approved_by: a.approvedBy || null,
      approved_at: a.approvedAt || null,
      reject_reason: a.rejectReason || "",
      document_urls: a.documentUrls || [],
      actual_expense: a.actualExpense || 0,
      refund_amount: a.refundAmount || 0,
      refund_slip_url: a.refundSlipUrl || "",
      expense_receipts: a.expenseReceipts || [],
      settled_by: a.settledBy || null,
      settled_at: a.settledAt || null,
      created_at: a.createdAt || new Date().toISOString(),
      updated_at: a.updatedAt || new Date().toISOString(),
      budget_expansion_requested: a.budgetExpansionRequested || 0,
      budget_expansion_reason: a.budgetExpansionReason || "",
      budget_expansion_status: a.budgetExpansionStatus || "none",
      budget_expansion_approved_by: a.budgetExpansionApprovedBy || null,
      budget_expansion_approved_at: a.budgetExpansionApprovedAt || null,
      budget_expansion_reject_reason: a.budgetExpansionRejectReason || "",
      external_incomes: a.externalIncomes || [],
    }));
    
    const { error } = await supabase.from("activities").upsert(activities, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Activities error: ${error.message}`);
    } else {
      console.log(`  ✅ ${activities.length} activities imported`);
    }
  }
  
  // 12. Import Budget Requests
  if (state.budgetRequests && state.budgetRequests.length > 0) {
    console.log(`📦 Importing ${state.budgetRequests.length} budget requests...`);
    const requests = state.budgetRequests.map((b: any) => ({
      id: b.id,
      activity_id: b.activityId || null,
      title: b.title,
      amount: b.amount,
      reason: b.reason || "",
      details: b.details || "",
      document_urls: b.documentUrls || [],
      status: b.status || "pending",
      requested_by: b.requestedBy,
      approved_by: b.approvedBy || null,
      approved_at: b.approvedAt || null,
      reject_reason: b.rejectReason || "",
      is_expansion: b.isExpansion || false,
      created_at: b.createdAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("budget_requests").upsert(requests, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Budget requests error: ${error.message}`);
    } else {
      console.log(`  ✅ ${requests.length} budget requests imported`);
    }
  }
  
  // 13. Import Announcements
  if (state.announcements && state.announcements.length > 0) {
    console.log(`📦 Importing ${state.announcements.length} announcements...`);
    const announcements = state.announcements.map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content || "",
      priority: a.priority || "normal",
      is_pinned: a.isPinned || false,
      created_by: a.createdBy,
      created_at: a.createdAt || new Date().toISOString(),
      updated_at: a.updatedAt || new Date().toISOString(),
    }));
    
    const { error } = await supabase.from("announcements").upsert(announcements, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Announcements error: ${error.message}`);
    } else {
      console.log(`  ✅ ${announcements.length} announcements imported`);
    }
  }
  
  // 14. Import Notifications
  if (state.notifications && state.notifications.length > 0) {
    console.log(`📦 Importing ${state.notifications.length} notifications...`);
    const notifications = state.notifications.map((n: any) => ({
      id: n.id,
      user_id: n.userId,
      title: n.title,
      message: n.message || "",
      type: n.type || "system",
      reference_id: n.referenceId || null,
      reference_type: n.referenceType || null,
      is_read: n.isRead || false,
      created_at: n.createdAt || new Date().toISOString(),
    }));
    
    // Insert in batches of 500 to avoid size limits
    for (let i = 0; i < notifications.length; i += 500) {
      const batch = notifications.slice(i, i + 500);
      const { error } = await supabase.from("notifications").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error(`  ❌ Notifications batch ${Math.floor(i/500)+1} error: ${error.message}`);
      }
    }
    console.log(`  ✅ ${notifications.length} notifications imported`);
  }
  
  // 15. Import Logs
  if (state.logs && state.logs.length > 0) {
    console.log(`📦 Importing ${state.logs.length} logs...`);
    const logs = state.logs.map((l: any) => ({
      id: l.id,
      user_id: l.userId,
      action: l.action,
      target_type: l.targetType || null,
      target_id: l.targetId || null,
      details: l.details || {},
      created_at: l.createdAt || new Date().toISOString(),
    }));
    
    // Insert in batches
    for (let i = 0; i < logs.length; i += 500) {
      const batch = logs.slice(i, i + 500);
      const { error } = await supabase.from("logs").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error(`  ❌ Logs batch ${Math.floor(i/500)+1} error: ${error.message}`);
      }
    }
    console.log(`  ✅ ${logs.length} logs imported`);
  }
  
  // 16. Import Petitions
  if (state.petitions && state.petitions.length > 0) {
    console.log(`📦 Importing ${state.petitions.length} petitions...`);
    const petitions = state.petitions.map((p: any) => ({
      id: p.id,
      title: p.title,
      category: p.category || "general",
      content: p.content || "",
      status: p.status || "pending",
      is_anonymous: p.isAnonymous || false,
      submitted_by: p.submittedBy,
      response: p.response || "",
      created_at: p.createdAt || new Date().toISOString(),
      resolved_at: p.resolvedAt || null,
      resolved_by: p.resolvedBy || null,
    }));
    
    const { error } = await supabase.from("petitions").upsert(petitions, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Petitions error: ${error.message}`);
    } else {
      console.log(`  ✅ ${petitions.length} petitions imported`);
    }
  }
  
  // 17. Import Password Resets
  if (state.passwordResets && state.passwordResets.length > 0) {
    console.log(`📦 Importing ${state.passwordResets.length} password resets...`);
    const resets = state.passwordResets.map((r: any) => ({
      id: r.id,
      user_id: r.userId,
      student_id: r.studentId,
      full_name: r.fullName,
      classroom: r.classroom || "ห้อง 1",
      status: r.status || "pending",
      requested_at: r.requestedAt || new Date().toISOString(),
      resolved_at: r.resolvedAt || null,
      resolved_by: r.resolvedBy || null,
    }));
    
    const { error } = await supabase.from("password_resets").upsert(resets, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ Password resets error: ${error.message}`);
    } else {
      console.log(`  ✅ ${resets.length} password resets imported`);
    }
  }
  
  // =============================================
  // Verification
  // =============================================
  console.log("\n🔍 Verifying migration...\n");
  
  const tables = [
    { name: "users", expected: state.users?.length || 0 },
    { name: "monthly_bills", expected: state.monthlyBills?.length || 0 },
    { name: "payments", expected: state.payments?.length || 0 },
    { name: "transactions", expected: state.transactions?.length || 0 },
    { name: "market_weeks", expected: state.marketWeeks?.length || 0 },
    { name: "market_items", expected: state.marketItems?.length || 0 },
    { name: "market_teams", expected: state.marketTeams?.length || 0 },
    { name: "activities", expected: state.activities?.length || 0 },
    { name: "budget_requests", expected: state.budgetRequests?.length || 0 },
    { name: "announcements", expected: state.announcements?.length || 0 },
    { name: "notifications", expected: state.notifications?.length || 0 },
    { name: "logs", expected: state.logs?.length || 0 },
    { name: "petitions", expected: state.petitions?.length || 0 },
    { name: "password_resets", expected: state.passwordResets?.length || 0 },
  ];
  
  let allGood = true;
  for (const table of tables) {
    const { count, error } = await supabase.from(table.name).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`  ❌ ${table.name}: Error - ${error.message}`);
      allGood = false;
    } else {
      const ok = count === table.expected;
      const icon = ok ? "✅" : "⚠️";
      console.log(`  ${icon} ${table.name}: ${count} rows (expected ${table.expected})`);
      if (!ok) allGood = false;
    }
  }
  
  console.log("\n" + "=".repeat(50));
  if (allGood) {
    console.log("🎉 Migration completed successfully! All data verified.");
  } else {
    console.log("⚠️  Migration completed with some differences. Please review above.");
  }
  console.log("=".repeat(50) + "\n");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
