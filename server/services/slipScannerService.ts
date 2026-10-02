/**
 * Slip Scanner & Student Matcher Service
 * Extracts Payer Name, Payee Name, Amount, Date/Time from bank slip images
 * and matches them against database users.
 */

import { supabase } from "../config/supabase";
import { ENV } from "../config/env";

export interface ExtractedSlipInfo {
  payerName: string | null;
  payeeName: string | null;
  amount: number | null;
  transDate: string | null;
  refNo: string | null;
  rawText: string;
}

export interface MatchedSlipResult {
  id: string;
  originalImage: string;
  extractedInfo: ExtractedSlipInfo;
  matchedUserId: string | null;
  matchedUserName: string | null;
  matchedUserStudentId: string | null;
  matchedUserNickname: string | null;
  confidenceStatus: "matched" | "name_mismatch" | "unmatched" | "already_paid";
  confidenceScore: number; // 0 - 100
  recommendedNote: string;
  billId?: string;
  suggestedAmount: number;
}

/**
 * Clean Thai name by removing titles, spaces, special chars
 */
export function normalizeThaiName(name: string): string {
  if (!name) return "";
  let clean = name.trim();
  // Remove titles
  clean = clean.replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|mr\.|mrs\.|ms\.|miss|dr\.)\s*/i, "");
  // Remove special symbols & extra spaces
  clean = clean.replace(/[^a-zA-Z0-9ก-๙\s]/g, " ");
  clean = clean.replace(/\s+/g, " ").trim();
  return clean.toLowerCase();
}

/**
 * Compare two Thai names and return similarity score (0 to 100)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeThaiName(name1);
  const norm2 = normalizeThaiName(name2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  // Check substring contains
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 85;
  }

  // Token matching (first name, last name)
  const tokens1 = norm1.split(" ").filter(Boolean);
  const tokens2 = norm2.split(" ").filter(Boolean);

  let matchCount = 0;
  for (const t1 of tokens1) {
    if (t1.length > 1 && tokens2.some(t2 => t2.includes(t1) || t1.includes(t2))) {
      matchCount++;
    }
  }

  if (tokens1.length > 0 && matchCount > 0) {
    const score = Math.round((matchCount / Math.max(tokens1.length, tokens2.length)) * 100);
    return Math.max(score, 60);
  }

  return 0;
}

/**
 * Lightweight Thai Slip Text & Pattern Parser
 */
export function parseSlipTextFromImageContent(base64Image: string): ExtractedSlipInfo {
  // Extract text patterns or metadata from base64 if present, or perform pattern detection
  let rawText = "";
  
  // Check if image data contains note or metadata suffix
  if (base64Image.includes("|NOTE:")) {
    const parts = base64Image.split("|NOTE:");
    rawText = decodeURIComponent(parts[1] || "");
  }

  // Regex patterns for Thai bank slips
  let payerName: string | null = null;
  let payeeName: string | null = null;
  let amount: number | null = null;
  let transDate: string | null = null;
  let refNo: string | null = null;

  // Extract amount pattern (e.g. 100.00 บาท, 100.00 THB, จำนวนเงิน 100.00)
  const amountMatch = rawText.match(/(?:จำนวนเงิน|ยอดเงิน|Amount|THB|บาท)\s*:?\s*([\d,]+\.?\d*)/i) ||
                      rawText.match(/([\d,]+\.\d{2})\s*(?:บาท|THB)/i);
  if (amountMatch) {
    const parsedAmt = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (!isNaN(parsedAmt) && parsedAmt > 0) {
      amount = parsedAmt;
    }
  }

  // Extract payer name pattern (e.g. จาก / From / นาย / นาง / นางสาว)
  const payerMatch = rawText.match(/(?:จาก|From|ผู้โอน)\s*:?\s*([ก-๙a-zA-Z\s]+)/i) ||
                     rawText.match(/(?:นาย|นางสาว|นาง)\s+([ก-๙\s]+)/i);
  if (payerMatch) {
    payerName = payerMatch[1].trim();
  }

  // Extract reference number pattern
  const refMatch = rawText.match(/(?:เลขที่อ้างอิง|Ref|Ref\.?\s*No|รหัสอ้างอิง)\s*:?\s*([A-Za-z0-9]+)/i);
  if (refMatch) {
    refNo = refMatch[1];
  }

  return {
    payerName,
    payeeName,
    amount,
    transDate,
    refNo,
    rawText
  };
}

/**
 * Advanced slip OCR parser using Gemini AI if GEMINI_API_KEY is available,
 * with fallback to pattern parser.
 */
export async function analyzeSlipImage(base64Image: string): Promise<ExtractedSlipInfo> {
  const apiKey = ENV.GEMINI_API_KEY;
  
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      let cleanBase64 = base64Image;
      if (cleanBase64.includes("|NOTE:")) {
        cleanBase64 = cleanBase64.split("|NOTE:")[0];
      }
      
      const mimeMatch = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (mimeMatch) {
        const mimeType = mimeMatch[1];
        const data = mimeMatch[2];

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              inlineData: {
                mimeType,
                data
              }
            },
            {
              text: `กรุณาวิเคราะห์รูปภาพสลิปการโอนเงินนี้ และสกัดข้อมูลดังต่อไปนี้ในรูปแบบ JSON สั้นๆ:
{
  "payerName": "ชื่อผู้โอนเงิน (เช่น นาย สมชาย ใจดี)",
  "payeeName": "ชื่อผู้รับเงิน",
  "amount": จำนวนเงินโอน (เป็นตัวเลขอย่างเดียว เช่น 100),
  "transDate": "วันและเวลาโอน",
  "refNo": "เลขที่อ้างอิงการโอน"
}
ตอบเฉพาะ JSON เท่านั้น`
            }
          ]
        });

        const respText = response.text || "";
        const jsonMatch = respText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            payerName: parsed.payerName || null,
            payeeName: parsed.payeeName || null,
            amount: typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount) || null,
            transDate: parsed.transDate || null,
            refNo: parsed.refNo || null,
            rawText: respText
          };
        }
      }
    } catch (err) {
      console.warn("[Slip Scanner Service] Gemini AI scan failed, falling back to local parser:", err);
    }
  }

  // Fallback to local parsing
  return parseSlipTextFromImageContent(base64Image);
}

/**
 * Scan multiple slip images and match them against all active users in Supabase database.
 */
export async function processAndMatchSlips(
  slipImages: string[],
  billId?: string
): Promise<MatchedSlipResult[]> {
  // Fetch all active users from database
  const { data: dbUsers } = await supabase
    .from("users")
    .select("id, student_id, full_name, nickname, classroom")
    .eq("is_active", true);

  const users = dbUsers || [];

  // Fetch bill info if billId provided
  let targetBillAmount = 100;
  let alreadyPaidUserIds = new Set<string>();

  if (billId) {
    const { data: bill } = await supabase.from("monthly_bills").select("amount").eq("id", billId).single();
    if (bill && bill.amount) {
      targetBillAmount = bill.amount;
    }

    // Check existing approved/pending payments for this bill
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("user_id, status")
      .eq("bill_id", billId)
      .in("status", ["approved", "pending_review"]);

    (existingPayments || []).forEach(p => alreadyPaidUserIds.add(p.user_id));
  }

  const results: MatchedSlipResult[] = [];

  for (let i = 0; i < slipImages.length; i++) {
    const imgData = slipImages[i];
    const slipId = `slip_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`;
    
    // Analyze slip content
    const extracted = await analyzeSlipImage(imgData);

    let bestMatchUser: any = null;
    let maxScore = 0;

    if (extracted.payerName) {
      for (const u of users) {
        // Compare with full_name
        const nameScore = calculateNameSimilarity(extracted.payerName, u.full_name);
        
        // Compare with nickname
        let nickScore = 0;
        if (u.nickname) {
          nickScore = calculateNameSimilarity(extracted.payerName, u.nickname);
        }

        // Compare with student_id
        let studentIdScore = 0;
        if (extracted.rawText && extracted.rawText.includes(u.student_id)) {
          studentIdScore = 100;
        }

        const currentMax = Math.max(nameScore, nickScore, studentIdScore);
        if (currentMax > maxScore) {
          maxScore = currentMax;
          bestMatchUser = u;
        }
      }
    }

    let confidenceStatus: "matched" | "name_mismatch" | "unmatched" | "already_paid" = "unmatched";
    let matchedUserId: string | null = null;
    let matchedUserName: string | null = null;
    let matchedUserStudentId: string | null = null;
    let matchedUserNickname: string | null = null;
    let recommendedNote = "";

    if (bestMatchUser && maxScore >= 60) {
      matchedUserId = bestMatchUser.id;
      matchedUserName = bestMatchUser.full_name;
      matchedUserStudentId = bestMatchUser.student_id;
      matchedUserNickname = bestMatchUser.nickname;

      if (alreadyPaidUserIds.has(bestMatchUser.id)) {
        confidenceStatus = "already_paid";
        recommendedNote = `สมาชิกท่านนี้ชำระหรือมีสลิปในระบบแล้ว (${bestMatchUser.full_name})`;
      } else {
        confidenceStatus = "matched";
        recommendedNote = `สแกนพบผู้โอนตรงกับสมาชิก: ${bestMatchUser.full_name} (${bestMatchUser.student_id})`;
      }
    } else if (extracted.payerName) {
      confidenceStatus = "name_mismatch";
      recommendedNote = `สแกนพบผู้โอน: "${extracted.payerName}" (ชื่อไม่ตรงกับสมาชิกในห้อง - สามารถเลือกสมาชิกที่โอนแทนได้)`;
    } else {
      confidenceStatus = "unmatched";
      recommendedNote = "ไม่สามารถอ่านชื่อผู้โอนจากสลิปได้ (โปรดระบุสมาชิกและยอดเงินด้วยตนเอง)";
    }

    const finalAmount = extracted.amount && extracted.amount > 0 ? extracted.amount : targetBillAmount;

    results.push({
      id: slipId,
      originalImage: imgData,
      extractedInfo: extracted,
      matchedUserId,
      matchedUserName,
      matchedUserStudentId,
      matchedUserNickname,
      confidenceStatus,
      confidenceScore: maxScore,
      recommendedNote,
      suggestedAmount: finalAmount,
      billId
    });
  }

  return results;
}
