/**
 * Special Campaigns Routes
 * /api/special-campaigns/create
 * /api/special-campaigns/toggle-status
 * /api/special-campaigns/delete
 * /api/special-campaigns/order
 * /api/special-campaigns/pay
 * /api/special-campaigns/review-order
 */

import { Router } from "express";
import { supabase } from "../config/supabase";
import { asyncHandler } from "../middleware/errorHandler";
import { convertKeysToCamel } from "../utils/camelCase";
import { extractAndSaveImage } from "../services/imageService";
import { SpecialCampaign, SpecialOrder } from "../../src/types";

const router = Router();

// Fail-safe storage engine
let inMemoryCampaigns: any[] = [];
let inMemoryOrders: any[] = [];
let isFallbackMode = false;

// Load campaigns from Supabase (Table -> Fallback images table -> Memory)
export async function getSpecialCampaigns(): Promise<SpecialCampaign[]> {
  try {
    const { data, error } = await supabase
      .from("special_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      inMemoryCampaigns = data;
      return convertKeysToCamel(data) as SpecialCampaign[];
    }

    if (error && error.code === "42P01") {
      isFallbackMode = true;
      const { data: fallback } = await supabase
        .from("images")
        .select("base64")
        .eq("id", "sys_special_campaigns")
        .single();

      if (fallback && fallback.base64) {
        try {
          inMemoryCampaigns = JSON.parse(fallback.base64);
        } catch (e) {}
      }
    }
    return convertKeysToCamel(inMemoryCampaigns) as SpecialCampaign[];
  } catch (err) {
    return convertKeysToCamel(inMemoryCampaigns) as SpecialCampaign[];
  }
}

async function persistCampaigns() {
  if (isFallbackMode) {
    await supabase.from("images").upsert({
      id: "sys_special_campaigns",
      base64: JSON.stringify(inMemoryCampaigns)
    });
  }
}

// Load orders from Supabase (Table -> Fallback images table -> Memory)
export async function getSpecialOrders(): Promise<SpecialOrder[]> {
  try {
    const { data, error } = await supabase
      .from("special_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      inMemoryOrders = data;
      return convertKeysToCamel(data) as SpecialOrder[];
    }

    if (error && error.code === "42P01") {
      isFallbackMode = true;
      const { data: fallback } = await supabase
        .from("images")
        .select("base64")
        .eq("id", "sys_special_orders")
        .single();

      if (fallback && fallback.base64) {
        try {
          inMemoryOrders = JSON.parse(fallback.base64);
        } catch (e) {}
      }
    }
    return convertKeysToCamel(inMemoryOrders) as SpecialOrder[];
  } catch (err) {
    return convertKeysToCamel(inMemoryOrders) as SpecialOrder[];
  }
}

async function persistOrders() {
  if (isFallbackMode) {
    await supabase.from("images").upsert({
      id: "sys_special_orders",
      base64: JSON.stringify(inMemoryOrders)
    });
  }
}

// 1. Create a new Special Campaign
router.post("/special-campaigns/create", asyncHandler(async (req, res) => {
  const { title, description, category, isMandatory, amountPerUnit, hasOptions, options, dueDate, userId } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "กรุณาระบุชื่อรายการเก็บเงินพิเศษ" });
  }

  const numAmount = Number(amountPerUnit);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "กรุณาระบุจำนวนเงินที่ถูกต้อง" });
  }

  const campaignId = `spc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newCampaign = {
    id: campaignId,
    title: title.trim(),
    description: description ? description.trim() : "",
    category: category || "other",
    is_mandatory: !!isMandatory,
    amount_per_unit: numAmount,
    has_options: !!hasOptions,
    options: Array.isArray(options) ? options : [],
    status: "active",
    due_date: dueDate || null,
    created_by: userId || "system",
    created_at: now,
    updated_at: now
  };

  // Try SQL table first
  const { error: insertError } = await supabase
    .from("special_campaigns")
    .insert(newCampaign);

  if (insertError && insertError.code === "42P01") {
    isFallbackMode = true;
  }

  // Always keep in-memory & fallback in sync
  inMemoryCampaigns = [newCampaign, ...inMemoryCampaigns.filter(c => c.id !== campaignId)];
  await persistCampaigns();

  // If isMandatory is true, create unpaid order items for all active users
  if (isMandatory) {
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("is_active", true);

    const activeUserList = users && users.length > 0 ? users : [];
    const newOrders = activeUserList.map(u => ({
      id: `spo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      campaign_id: campaignId,
      user_id: u.id,
      selected_option: null,
      quantity: 1,
      total_amount: numAmount,
      status: "unpaid",
      created_at: now,
      updated_at: now
    }));

    if (!isFallbackMode) {
      await supabase.from("special_orders").insert(newOrders);
    }
    inMemoryOrders = [...newOrders, ...inMemoryOrders];
    await persistOrders();
  }

  res.json({ success: true, campaign: convertKeysToCamel(newCampaign) });
}));

// 2. Toggle Status (active <-> closed)
router.post("/special-campaigns/toggle-status", asyncHandler(async (req, res) => {
  const { campaignId, status } = req.body;
  if (!campaignId) return res.status(400).json({ error: "Missing campaignId" });

  const newStatus = status === "closed" ? "closed" : "active";
  const now = new Date().toISOString();

  if (!isFallbackMode) {
    await supabase
      .from("special_campaigns")
      .update({ status: newStatus, updated_at: now })
      .eq("id", campaignId);
  }

  inMemoryCampaigns = inMemoryCampaigns.map(c => 
    c.id === campaignId ? { ...c, status: newStatus, updated_at: now } : c
  );
  await persistCampaigns();

  res.json({ success: true, status: newStatus });
}));

// 3. Delete Campaign
router.post("/special-campaigns/delete", asyncHandler(async (req, res) => {
  const { campaignId } = req.body;
  if (!campaignId) return res.status(400).json({ error: "Missing campaignId" });

  if (!isFallbackMode) {
    await supabase.from("special_orders").delete().eq("campaign_id", campaignId);
    await supabase.from("special_campaigns").delete().eq("id", campaignId);
  }

  inMemoryCampaigns = inMemoryCampaigns.filter(c => c.id !== campaignId);
  inMemoryOrders = inMemoryOrders.filter(o => o.campaign_id !== campaignId);

  await persistCampaigns();
  await persistOrders();

  res.json({ success: true });
}));

// 4. Place / Update Student Order (Choose Size/Option, Quantity)
router.post("/special-campaigns/order", asyncHandler(async (req, res) => {
  const { campaignId, userId, selectedOption, quantity } = req.body;

  if (!campaignId || !userId) {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน (campaignId หรือ userId)" });
  }

  // Find campaign
  let campaign = inMemoryCampaigns.find(c => c.id === campaignId);
  if (!campaign) {
    const { data } = await supabase.from("special_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (data) campaign = data;
  }

  if (!campaign) {
    return res.status(404).json({ error: "ไม่พบข้อมูลรายการเก็บเงินพิเศษนี้" });
  }

  const unitAmount = Number(campaign.amount_per_unit || campaign.amountPerUnit) || 0;
  const numQty = Math.max(1, Number(quantity) || 1);
  const totalAmount = unitAmount * numQty;
  const now = new Date().toISOString();

  const existingIndex = inMemoryOrders.findIndex(o => (o.campaign_id || o.campaignId) === campaignId && (o.user_id || o.userId) === userId);

  let resultOrder: any;

  if (existingIndex >= 0) {
    const existing = inMemoryOrders[existingIndex];
    resultOrder = {
      ...existing,
      selected_option: selectedOption || existing.selected_option || existing.selectedOption,
      quantity: numQty,
      total_amount: totalAmount,
      updated_at: now
    };
    inMemoryOrders[existingIndex] = resultOrder;
  } else {
    resultOrder = {
      id: `spo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      campaign_id: campaignId,
      user_id: userId,
      selected_option: selectedOption || null,
      quantity: numQty,
      total_amount: totalAmount,
      status: "unpaid",
      created_at: now,
      updated_at: now
    };
    inMemoryOrders.unshift(resultOrder);
  }

  if (!isFallbackMode) {
    await supabase.from("special_orders").upsert(resultOrder);
  }
  await persistOrders();

  res.json({ success: true, order: convertKeysToCamel(resultOrder) });
}));

// 5. Submit Payment Slip for Special Order
router.post("/special-campaigns/pay", asyncHandler(async (req, res) => {
  const { campaignId, orderId, userId, selectedOption, quantity, slipUrl, note } = req.body;

  if (!campaignId || !userId) {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
  }

  if (!slipUrl || !slipUrl.trim()) {
    return res.status(400).json({ error: "กรุณาแนบรูปหลักฐานสลิปการโอนเงิน" });
  }

  let processedSlipUrl = slipUrl;

  // Compress / upload slip image if base64
  if (slipUrl.startsWith("data:image/")) {
    processedSlipUrl = await extractAndSaveImage(
      slipUrl,
      "/api/special-campaigns/pay",
      { campaignId, userId }
    );
  }

  const now = new Date().toISOString();

  let campaign = inMemoryCampaigns.find(c => c.id === campaignId);
  const unitAmount = Number(campaign?.amount_per_unit || campaign?.amountPerUnit) || 0;
  const numQty = Math.max(1, Number(quantity) || 1);
  const totalAmount = unitAmount * numQty;

  let existingIndex = inMemoryOrders.findIndex(o => 
    (orderId && o.id === orderId) || ((o.campaign_id || o.campaignId) === campaignId && (o.user_id || o.userId) === userId)
  );

  let resultOrder: any;

  if (existingIndex >= 0) {
    const existing = inMemoryOrders[existingIndex];
    resultOrder = {
      ...existing,
      selected_option: selectedOption || existing.selected_option || existing.selectedOption,
      quantity: numQty,
      total_amount: totalAmount > 0 ? totalAmount : existing.total_amount,
      slip_url: processedSlipUrl,
      status: "pending_review",
      note: note || null,
      paid_at: now,
      updated_at: now
    };
    inMemoryOrders[existingIndex] = resultOrder;
  } else {
    resultOrder = {
      id: `spo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      campaign_id: campaignId,
      user_id: userId,
      selected_option: selectedOption || null,
      quantity: numQty,
      total_amount: totalAmount,
      slip_url: processedSlipUrl,
      status: "pending_review",
      note: note || null,
      paid_at: now,
      created_at: now,
      updated_at: now
    };
    inMemoryOrders.unshift(resultOrder);
  }

  if (!isFallbackMode) {
    await supabase.from("special_orders").upsert(resultOrder);
  }
  await persistOrders();

  res.json({ success: true, slipUrl: processedSlipUrl, order: convertKeysToCamel(resultOrder) });
}));

// 6. Review Order Payment (Approve / Reject)
router.post("/special-campaigns/review-order", asyncHandler(async (req, res) => {
  const { orderId, action, rejectReason, reviewerId } = req.body;

  if (!orderId || !action) {
    return res.status(400).json({ error: "Missing orderId or action" });
  }

  const now = new Date().toISOString();
  const newStatus = action === "approve" ? "paid" : "rejected";

  const idx = inMemoryOrders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    inMemoryOrders[idx] = {
      ...inMemoryOrders[idx],
      status: newStatus,
      reviewed_by: reviewerId || "treasurer",
      reviewed_at: now,
      reject_reason: action === "reject" ? (rejectReason || "สลิปไม่ถูกต้อง") : null,
      updated_at: now
    };
  }

  if (!isFallbackMode) {
    await supabase
      .from("special_orders")
      .update({
        status: newStatus,
        reviewed_by: reviewerId || "treasurer",
        reviewed_at: now,
        reject_reason: action === "reject" ? (rejectReason || "สลิปไม่ถูกต้อง") : null,
        updated_at: now
      })
      .eq("id", orderId);
  }

  await persistOrders();

  res.json({ success: true, status: newStatus });
}));

export default router;
