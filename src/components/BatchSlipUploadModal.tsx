/**
 * Batch Slip Upload & Student Matcher Modal
 * Allows Treasurers and Leaders to bulk upload payment slips, auto-read names/amounts,
 * match them to students, handle third-party transfers, and submit/approve in batch.
 */

import React, { useState, useEffect } from "react";
import { 
  UploadCloud, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  FileText, 
  Sparkles, 
  Trash2, 
  Check, 
  Eye, 
  HelpCircle,
  Clock,
  Zap,
  Info
} from "lucide-react";
import { User, MonthlyBill, Payment } from "../types";
import { compressImage } from "../utils/imageCompressor";

interface MatchedSlipItem {
  id: string;
  originalImage: string; // Base64 data URL
  payerName: string | null;
  payeeName: string | null;
  detectedAmount: number | null;
  refNo: string | null;
  transDate: string | null;
  selectedUserId: string;
  amount: number;
  note: string;
  confidenceStatus: "matched" | "name_mismatch" | "unmatched" | "already_paid";
  recommendedNote: string;
}

interface BatchSlipUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  monthlyBills: MonthlyBill[];
  payments: Payment[];
  onSuccess: () => void;
}

export default function BatchSlipUploadModal({
  isOpen,
  onClose,
  currentUser,
  users,
  monthlyBills,
  payments,
  onSuccess
}: BatchSlipUploadModalProps) {
  if (!isOpen) return null;

  // Derive unique months/years available in bills
  const availableBillsMap = new Map<string, { month: number; year: number; sampleBillId: string }>();
  monthlyBills.forEach(b => {
    const key = `${b.month}_${b.year}`;
    if (!availableBillsMap.has(key)) {
      availableBillsMap.set(key, { month: b.month, year: b.year, sampleBillId: b.id });
    }
  });

  const availableBillsList = Array.from(availableBillsMap.values()).sort((a, b) => b.year - a.year || b.month - a.month);
  
  const defaultBillKey = availableBillsList.length > 0
    ? `${availableBillsList[0].month}_${availableBillsList[0].year}`
    : "";

  const [selectedBillKey, setSelectedBillKey] = useState<string>(defaultBillKey);
  const [items, setItems] = useState<MatchedSlipItem[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitMode, setSubmitMode] = useState<"pending" | "approve">("pending");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const getThaiMonthName = (month: number) => {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return months[month - 1] || "";
  };

  // Find sample bill ID for API
  const activeBillGroup = availableBillsList.find(b => `${b.month}_${b.year}` === selectedBillKey);

  const activeBillsForMonth = activeBillGroup
    ? monthlyBills.filter(b => b.month === activeBillGroup.month && b.year === activeBillGroup.year)
    : [];

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMessage("");
    setIsScanning(true);

    try {
      const filesArray = Array.from(e.target.files);
      const base64List: string[] = [];

      for (const file of filesArray) {
        const reader = new FileReader();
        const base64Str = await new Promise<string>((resolve, reject) => {
          reader.onloadend = async () => {
            const compressed = await compressImage(reader.result as string, 900, 0.7);
            resolve(compressed);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        base64List.push(base64Str);
      }

      // Call backend scan-slips API
      const sampleBillId = activeBillsForMonth[0]?.id || "";
      const res = await fetch("/api/payments/scan-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slipImages: base64List, billId: sampleBillId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการสแกนอ่านไฟล์สลิป");
      }

      const newItems: MatchedSlipItem[] = (data.results || []).map((resItem: any) => {
        const matchedUserId = resItem.matchedUserId || "";
        const defaultAmt = resItem.suggestedAmount || 100;
        
        let noteText = "";
        if (resItem.confidenceStatus === "name_mismatch" && resItem.extractedInfo?.payerName) {
          noteText = `ฝากโอน / โอนโดย: ${resItem.extractedInfo.payerName} (ชื่อสลิปไม่ตรง)`;
        } else if (resItem.confidenceStatus === "matched" && resItem.matchedUserName) {
          noteText = `สแกนสลิปตรงกับ ${resItem.matchedUserName}`;
        } else if (resItem.confidenceStatus === "already_paid") {
          noteText = `สมาชิกท่านนี้มีรายการชำระแล้ว`;
        }

        return {
          id: resItem.id,
          originalImage: resItem.originalImage,
          payerName: resItem.extractedInfo?.payerName || null,
          payeeName: resItem.extractedInfo?.payeeName || null,
          detectedAmount: resItem.extractedInfo?.amount || null,
          refNo: resItem.extractedInfo?.refNo || null,
          transDate: resItem.extractedInfo?.transDate || null,
          selectedUserId: matchedUserId,
          amount: defaultAmt,
          note: noteText,
          confidenceStatus: resItem.confidenceStatus,
          recommendedNote: resItem.recommendedNote
        };
      });

      setItems(prev => [...prev, ...newItems]);
    } catch (err: any) {
      console.error("[Batch Upload Error]:", err);
      setErrorMessage(err.message || "เกิดข้อผิดพลาดในการอัปโหลดและอ่านสลิป");
    } finally {
      setIsScanning(false);
      // Reset input value
      e.target.value = "";
    }
  };

  const handleUpdateItem = (id: string, updates: Partial<MatchedSlipItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };

      // If user selected a student manually, update note if it was name_mismatch
      if (updates.selectedUserId && updates.selectedUserId !== item.selectedUserId) {
        const targetUser = users.find(u => u.id === updates.selectedUserId);
        if (item.confidenceStatus === "name_mismatch" && item.payerName && targetUser) {
          updated.note = `โอนแทน ${targetUser.fullName} (ชื่อสลิป: ${item.payerName})`;
        }
      }
      return updated;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmitAll = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (items.length === 0) {
      setErrorMessage("กรุณาเพิ่มรูปสลิปอย่างน้อย 1 รายการค่ะ");
      return;
    }

    // Validate that all items have a target user selected
    const unassignedIndex = items.findIndex(i => !i.selectedUserId);
    if (unassignedIndex !== -1) {
      setErrorMessage(`รายการที่ ${unassignedIndex + 1} ยังไม่ได้เลือกสมาชิกผู้ชำระเงิน กรุณาเลือกสมาชิกใน Dropdown ค่ะ`);
      return;
    }

    if (!activeBillGroup) {
      setErrorMessage("กรุณาเลือกรอบบิลเดือนที่ต้องการบันทึกสลิปค่ะ");
      return;
    }

    setIsSubmitting(true);
    try {
      const isAutoApprove = submitMode === "approve" && currentUser.role === "treasurer";
      let totalSuccess = 0;
      const errorsList: string[] = [];

      // Process items for matching monthly bills
      for (const item of items) {
        const targetBill = monthlyBills.find(b => 
          b.userId === item.selectedUserId && 
          b.month === activeBillGroup.month && 
          b.year === activeBillGroup.year
        );

        if (!targetBill) {
          const userObj = users.find(u => u.id === item.selectedUserId);
          errorsList.push(`ไม่พบบิลประจำเดือน ${getThaiMonthName(activeBillGroup.month)} ของ ${userObj?.fullName || item.selectedUserId}`);
          continue;
        }

        const payload = {
          billId: targetBill.id,
          treasurerId: currentUser.id,
          items: [{
            userId: item.selectedUserId,
            amount: item.amount,
            slipUrl: item.originalImage,
            note: item.note,
            autoApprove: isAutoApprove
          }]
        };

        const res = await fetch("/api/payments/bulk-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success && data.processedPayments?.length > 0) {
          totalSuccess += data.processedPayments.length;
        } else {
          if (data.errors && data.errors.length > 0) {
            errorsList.push(...data.errors);
          } else {
            errorsList.push(data.error || "เกิดข้อผิดพลาดในการบันทึกสลิป");
          }
        }
      }

      if (totalSuccess > 0) {
        setSuccessMessage(`บันทึกสลิปสำเร็จ ${totalSuccess} รายการเรียบร้อยแล้วค่ะ!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMessage(errorsList.join(", ") || "ไม่สามารถบันทึกสลิปได้ กรุณาตรวจสอบข้อมูล");
      }
    } catch (err: any) {
      console.error("[Bulk Submit Error]:", err);
      setErrorMessage(err.message || "เกิดข้อผิดพลาดในการบันทึกรายการ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-md border border-white/20">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">ระบบอัปโหลดสลิปรวม & ตรวจสอบอัตโนมัติ</h2>
              <p className="text-xs text-blue-100/90 mt-0.5">
                โยนสลิปหลายรูปพร้อมกัน ระบบสแกนอ่านชื่อและจับคู่สมาชิกให้อัตโนมัติ (รองรับฝากโอน/ชื่อไม่ตรง)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Bill Selection & Dropzone */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Bill Month Selector */}
            <div className="md:col-span-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                1. เลือกรอบบิลประจำเดือน
              </label>
              <select
                value={selectedBillKey}
                onChange={e => setSelectedBillKey(e.target.value)}
                className="w-full text-sm font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              >
                {availableBillsList.map(b => (
                  <option key={`${b.month}_${b.year}`} value={`${b.month}_${b.year}`}>
                    บิลเดือน {getThaiMonthName(b.month)} {b.year}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                * สลิปทั้งหมดในลอตนี้จะถูกนำไปจับคู่กับบิลประจำเดือนที่เลือก
              </p>
            </div>

            {/* Dropzone Multi File Picker */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                2. เลือกหรือโยนไฟล์สลิป (เลือกได้หลายรูปพร้อมกัน)
              </label>
              <label className="relative flex flex-col items-center justify-center p-5 border-2 border-dashed border-blue-400/70 hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50 rounded-xl cursor-pointer transition-all duration-200 group">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFilesSelect}
                  disabled={isScanning}
                  className="hidden"
                />
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-600 text-white rounded-full shadow-md group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                      {isScanning ? "กำลังสแกนและอ่านข้อมูลสลิป..." : "คลิกเพื่อเลือกสลิป หรือ ลากรูปภาพมาวางที่นี่"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      รองรับไฟล์ภาพ JPG, PNG, WEBP (เลือกได้หลายรูปทีเดียว)
                    </p>
                  </div>
                </div>
              </label>
            </div>

          </div>

          {/* Messages Alert */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center space-x-2.5 animate-shake">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Section 2: Items Preview & Matcher List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                <span>รายการสลิปที่สแกนแล้ว ({items.length} รายการ)</span>
              </h3>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างรายการทั้งหมด</span>
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-600">ยังไม่มีสลิปที่เลือก</p>
                <p className="text-xs text-slate-400 mt-1">
                  กรุณากดปุ่มเลือกไฟล์สลิปด้านบนเพื่อเริ่มสแกนอ่านข้อมูล
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {items.map((item, idx) => {
                  const selectedUserObj = users.find(u => u.id === item.selectedUserId);

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        item.confidenceStatus === "matched"
                          ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300"
                          : item.confidenceStatus === "name_mismatch"
                          ? "bg-amber-50/40 border-amber-200 hover:border-amber-300"
                          : item.confidenceStatus === "already_paid"
                          ? "bg-slate-100 border-slate-200"
                          : "bg-white border-slate-200 shadow-sm"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        
                        {/* Thumbnail */}
                        <div className="relative group flex-shrink-0">
                          <img
                            src={item.originalImage}
                            alt="สลิปโอนเงิน"
                            className="w-20 h-24 object-cover rounded-lg border border-slate-200 shadow-sm bg-slate-100 cursor-pointer group-hover:opacity-90 transition-opacity"
                            onClick={() => setPreviewImage(item.originalImage)}
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.originalImage)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-xs font-semibold"
                          >
                            <Eye className="w-4 h-4 mr-1" /> ดูรูป
                          </button>
                        </div>

                        {/* Details & Target Student Selector */}
                        <div className="flex-1 space-y-2.5">
                          
                          {/* Top Row: Detection info & Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                              
                              {/* Confidence Status Badge */}
                              {item.confidenceStatus === "matched" && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                  🟢 ชื่อตรงกับสมาชิก
                                </span>
                              )}
                              {item.confidenceStatus === "name_mismatch" && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                                  🟡 ชื่อสลิปไม่ตรง / ฝากโอน
                                </span>
                              )}
                              {item.confidenceStatus === "unmatched" && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                  🔴 โปรดเลือกสมาชิก
                                </span>
                              )}
                              {item.confidenceStatus === "already_paid" && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 border border-slate-300">
                                  ⚪ มีสลิปแล้ว
                                </span>
                              )}
                            </div>

                            {/* Detected Payer Name & Amount Info */}
                            <div className="text-xs text-slate-600 font-medium">
                              {item.payerName && (
                                <span className="mr-3">
                                  ชื่อสลิป: <strong className="text-slate-800">{item.payerName}</strong>
                                </span>
                              )}
                              {item.detectedAmount !== null && (
                                <span>
                                  ยอดสแกน: <strong className="text-blue-700">{item.detectedAmount.toLocaleString()} บาท</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Student Select Dropdown & Amount */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            
                            {/* Student Dropdown */}
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                สมาชิกผู้ชำระเงิน (ระบุคนโอนแทนได้):
                              </label>
                              <select
                                value={item.selectedUserId}
                                onChange={e => handleUpdateItem(item.id, { selectedUserId: e.target.value })}
                                className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
                              >
                                <option value="">-- กรุณาเลือกสมาชิก --</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>
                                    {u.studentId} - {u.fullName} {u.nickname ? `(${u.nickname})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Amount */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                จำนวนเงิน (บาท):
                              </label>
                              <input
                                type="number"
                                value={item.amount}
                                onChange={e => handleUpdateItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                                className="w-full text-xs font-bold text-blue-700 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 shadow-sm"
                              />
                            </div>
                          </div>

                          {/* Note & Delete Button */}
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={item.note}
                              onChange={e => handleUpdateItem(item.id, { note: e.target.value })}
                              placeholder="หมายเหตุเพิ่มเติม (เช่น ฝากเพื่อนโอนแทน)"
                              className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="ลบสลิปนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Submit Mode Selector */}
          {items.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                3. เลือกรูปแบบการบันทึกข้อมูล
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Pending Review Mode */}
                <label 
                  className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                    submitMode === "pending"
                      ? "bg-blue-50 border-blue-500 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="submitMode"
                    value="pending"
                    checked={submitMode === "pending"}
                    onChange={() => setSubmitMode("pending")}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-2.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      ส่งเข้าคิวรอเหรัญญิกตรวจสอบ (Pending Review)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      เสมือนเพื่อนแนบสลิปเอง ให้เหรัญญิกกดปุ่มอนุมัติสลิปทีละคนตามขั้นตอนเดิม
                    </p>
                  </div>
                </label>

                {/* Auto Approve Mode (Available for treasurer) */}
                <label 
                  className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                    currentUser.role !== "treasurer" ? "opacity-50 cursor-not-allowed" : ""
                  } ${
                    submitMode === "approve"
                      ? "bg-emerald-50 border-emerald-500 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="submitMode"
                    value="approve"
                    disabled={currentUser.role !== "treasurer"}
                    checked={submitMode === "approve"}
                    onChange={() => setSubmitMode("approve")}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="ml-2.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center">
                      <Zap className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      อนุมัติทันที (Auto Approve & ออกใบเสร็จ)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      บันทึกสถานะชำระแล้วเรียบร้อย อัปเดตยอดบัญชีและออกใบเสร็จรับเงินทันที
                    </p>
                  </div>
                </label>

              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            disabled={items.length === 0 || isSubmitting || isScanning}
            onClick={handleSubmitAll}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังบันทึกสลิป...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>ยืนยันบันทึกสลิปทั้งหมด ({items.length} รายการ)</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Image Preview Sub-Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img src={previewImage} alt="ขยายสลิป" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
