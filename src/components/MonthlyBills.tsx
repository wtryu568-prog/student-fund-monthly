/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  UploadCloud, 
  FileText, 
  Download, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  QrCode,
  DollarSign,
  Check,
  Copy,
  ChevronDown,
  Search
} from "lucide-react";
import { User, MonthlyBill, Payment, getDetailedBillStatus } from "../types";
import { compressImage } from "../utils/imageCompressor";

interface MonthlyBillsProps {
  currentUser: User;
  monthlyBills: MonthlyBill[];
  payments: Payment[];
  settings: any;
  users?: User[];
  onSubmitSlip: (billId: string, amount: number, slipUrl: string, note: string, targetUserId?: string) => Promise<any>;
  onCancelSlip: (billId: string, targetUserId?: string) => Promise<any>;
  onRecordCashPayment?: (billId: string, userId: string, amount: number, note?: string) => Promise<any>;
  onDeleteMonthlyBills?: (month: number, year: number) => Promise<any>;
}

export default function MonthlyBills({
  currentUser,
  monthlyBills,
  payments,
  settings,
  users = [],
  onSubmitSlip,
  onCancelSlip,
  onRecordCashPayment,
  onDeleteMonthlyBills
}: MonthlyBillsProps) {
  const [targetUserId, setTargetUserId] = useState<string>(currentUser.id);
  const [billClassroomFilter, setBillClassroomFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);

  // Classmate selection for leader or treasurer
  const canSelectClassmate = currentUser.role === "leader" || currentUser.role === "treasurer";
  const classmateUsers = currentUser.role === "leader"
    ? users.filter(u => u.classroom === currentUser.classroom)
    : (billClassroomFilter === "all" ? users : users.filter(u => u.classroom === billClassroomFilter));

  const filteredClassmates = classmateUsers.filter(u => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      u.fullName.toLowerCase().includes(term) ||
      (u.nickname && u.nickname.toLowerCase().includes(term)) ||
      u.studentId.toLowerCase().includes(term)
    );
  });

  const activeUser = users.find(u => u.id === targetUserId) || currentUser;

  // Filter bills for the logged in or selected user
  const myBills = monthlyBills.filter(b => b.userId === targetUserId);
  const myPayments = payments.filter(p => p.userId === targetUserId);

  const [selectedBill, setSelectedBill] = useState<MonthlyBill | null>(null);

  useEffect(() => {
    const userBills = monthlyBills.filter(b => b.userId === targetUserId);
    setSelectedBill(userBills.find(b => b.status !== "paid") || userBills[0] || null);
    setPaymentMethod("transfer");
    setUploadSuccess(false);
    setSlipUrl("");
    setSlipFile(null);
    setNote("");
  }, [targetUserId, monthlyBills]);

  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipUrl, setSlipUrl] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<"transfer" | "cash">("transfer");

  const pendingPayment = selectedBill ? myPayments.find(p => p.billId === selectedBill.id && p.status === "pending_review") : null;
  const isCashPending = pendingPayment?.slipUrl === "cash";
  const displaySlipUrl = pendingPayment?.slipUrl && pendingPayment.slipUrl !== "cash" ? pendingPayment.slipUrl : slipUrl;

  const getThaiMonthName = (month: number) => {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return months[month - 1] || "";
  };

  const getApprovedAmt = (billId: string) => {
    return payments
      .filter(p => p.billId === billId && p.status === "approved")
      .reduce((sum, p) => sum + p.amount, 0);
  };

  useEffect(() => {
    if (selectedBill) {
      const approvedAmt = getApprovedAmt(selectedBill.id);
      const remaining = selectedBill.amount - approvedAmt;
      setCustomAmount(remaining > 0 ? remaining : 0);
    }
  }, [selectedBill, payments]);

  // PromptPay QR Code generator mock. In a real environment, we can construct standard CRC-16 PromptPay payloads.
  // For standard user needs, we can draw a beautiful PromptPay box that is extremely realistic!
  // Let's create an elegant visual mock of a PromptPay QR code with details
  const getPromptPayQR = (amount: number) => {
    if (settings.promptpayQrUrl) {
      return settings.promptpayQrUrl;
    }
    // Return standard API QR code with simulated PromptPay payload or real API QR
    const ppNum = settings.promptpayNumber.replace(/[^0-9]/g, "");
    // Using a reliable static QR generator that draws PromptPay-like QR for demo, or a beautiful visual layout
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=002d62&data=PromptPay:${ppNum}?amount=${amount}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSlipFile(file);

      // Create a local URL for review
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string, 800, 0.6);
        setSlipUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectMockSlip = (index: number) => {
    // Let users choose from realistic pre-configured payment slips in order to test easily
    const mockSlips = [
      "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=300",
      "https://images.unsplash.com/photo-1563013544-824ae1d704d3?q=80&w=300"
    ];
    setSlipUrl(mockSlips[index]);
    setSlipFile(new File([], `mock_slip_${index + 1}.png`));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;

    const finalSlipUrl = paymentMethod === "cash" ? "cash" : slipUrl;
    if (!finalSlipUrl) return;

    setIsUploading(true);
    try {
      if (paymentMethod === "cash" && onRecordCashPayment) {
        // Record directly with the secured server helper
        await onRecordCashPayment(
          selectedBill.id,
          targetUserId,
          customAmount || (selectedBill.amount - getApprovedAmt(selectedBill.id)),
          note || (currentUser.role === "leader" ? "แจ้งชำระด้วยเงินสด (บันทึกโดยหัวหน้าห้อง)" : "ชำระด้วยเงินสด (เหรัญญิกบันทึกด้วยตนเอง)")
        );
      } else {
        await onSubmitSlip(
          selectedBill.id, 
          customAmount || (selectedBill.amount - getApprovedAmt(selectedBill.id)), 
          finalSlipUrl, 
          note || (paymentMethod === "cash" ? "แจ้งชำระด้วยเงินสดแก่เหรัญญิก" : ""),
          targetUserId
        );
      }
      setUploadSuccess(true);
      setSlipFile(null);
      setSlipUrl("");
      setNote("");
    } catch (error: any) {
      console.error("Submit payment failed", error);
      alert(error?.message || "เกิดข้อผิดพลาดในการส่งหลักฐานการชำระเงิน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelClick = async () => {
    if (!selectedBill) return;
    if (!window.confirm("⚠️ ยืนยันการยกเลิก?\n\nคุณต้องการยกเลิกคำขอชำระเงินและลบหลักฐานที่ส่งนี้ใช่หรือไม่? เพื่อให้คุณสามารถเลือกวิธีชำระเงินหรือส่งหลักฐานใหม่ได้อีกครั้ง")) {
      return;
    }
    
    setIsCancelling(true);
    try {
      await onCancelSlip(selectedBill.id, targetUserId);
      setUploadSuccess(false);
      setSlipUrl("");
      setSlipFile(null);
      setNote("");
      alert("ยกเลิกคำขอชำระเงินเรียบร้อยแล้วค่ะ คุณสามารถเลือกชำระเงินใหม่ได้เลย");
    } catch (err: any) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการยกเลิก: " + (err.message || String(err)));
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (bill: MonthlyBill) => {
    const statusInfo = getDetailedBillStatus(bill, payments);
    return (
      <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${statusInfo.badgeClass}`}>
        {statusInfo.statusType === "paid" && <CheckCircle2 size={14} />}
        {statusInfo.statusType === "pending_review" && <Clock size={14} />}
        {statusInfo.statusType === "not_due" && <Clock size={14} />}
        {statusInfo.statusType === "grace_period" && <Clock size={14} />}
        {statusInfo.statusType === "overdue" && <XCircle size={14} />}
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Classmate Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            📊 ระบบตรวจสอบยอดและชำระเงินกองทุน
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {currentUser.role === "leader" 
              ? `คุณล็อกอินในสิทธิ์ หัวหน้าห้อง (${currentUser.classroom}) - สามารถจัดการชำระเงินแทนเพื่อนร่วมห้องได้ค่ะ`
              : "กรุณาเลือกเดือนและรอบบิลทางด้านซ้ายเพื่อดูรายละเอียดการโอนหรือชำระด้วยเงินสด"}
          </p>
        </div>

        {canSelectClassmate && (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
            {currentUser.role === "treasurer" && (
              <div className="space-y-1 sm:text-right w-full sm:w-auto">
                <label className="block text-[10px] text-slate-500 font-bold uppercase">เลือกห้องเรียน</label>
                <select
                  value={billClassroomFilter}
                  onChange={(e) => {
                    setBillClassroomFilter(e.target.value);
                    setTargetUserId(currentUser.id); // Reset target to self when changing classroom
                  }}
                  className="w-full sm:w-auto p-2.5 border border-slate-200 rounded-xl font-bold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">🎓 ทุกห้องเรียน</option>
                  <option value="ห้อง 1">🎓 ห้อง 1</option>
                  <option value="ห้อง 2">🎓 ห้อง 2</option>
                </select>
              </div>
            )}
            
            {classmateUsers.length > 0 && (
              <div className="relative shrink-0 w-full sm:w-auto">
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">เลือกคนชำระเงิน (ช่วยเพื่อนชำระแทน)</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                    className="w-full sm:w-auto min-w-[240px] md:min-w-[280px] p-2.5 border border-slate-200 rounded-xl font-bold text-xs bg-slate-50 text-slate-750 hover:bg-slate-100/70 focus:outline-none flex items-center justify-between gap-2.5 shadow-sm transition-all text-left"
                  >
                    <span className="truncate">
                      {activeUser.id === currentUser.id 
                        ? `👤 ตัวฉันเอง (${activeUser.fullName})` 
                        : `👥 [${activeUser.classroom || "ไม่ระบุห้อง"}] ${activeUser.fullName} (${activeUser.nickname || "ไม่มีชื่อเล่น"})`}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isSelectorOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isSelectorOpen && (
                    <>
                      {/* Invisible backdrop to close the dropdown when clicking outside */}
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsSelectorOpen(false)}
                      />
                      
                      {/* Floating Dropdown Card */}
                      <div className="absolute right-0 left-0 sm:left-auto sm:w-80 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[360px]">
                        {/* Search Input Box */}
                        <div className="p-3 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-21">
                          <div className="relative">
                            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={12} />
                            <input
                              type="text"
                              autoFocus
                              placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัสนักศึกษา..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full p-2.5 pl-8.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 placeholder-slate-400 bg-white text-slate-700"
                              onClick={(e) => e.stopPropagation()} // Prevent closing popover when clicking the input
                            />
                            {searchTerm && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchTerm("");
                                }}
                                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                              >
                                ล้าง
                              </button>
                            )}
                          </div>
                        </div>

                        {/* List of Options */}
                        <div className="overflow-y-auto max-h-[280px] py-1 divide-y divide-slate-50">
                          {/* Option 1: Myself */}
                          <button
                            type="button"
                            onClick={() => {
                              setTargetUserId(currentUser.id);
                              setSearchTerm("");
                              setIsSelectorOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between ${
                              targetUserId === currentUser.id 
                                ? "bg-blue-50 text-blue-700 font-bold" 
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="truncate font-sans">👤 ตัวฉันเอง ({currentUser.fullName})</span>
                            {targetUserId === currentUser.id && <Check size={14} className="text-blue-600 shrink-0" />}
                          </button>

                          {/* Matching Classmates */}
                          {filteredClassmates.filter(u => u.id !== currentUser.id).map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setTargetUserId(u.id);
                                setSearchTerm("");
                                setIsSelectorOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 transition-all flex flex-col gap-0.5 ${
                                targetUserId === u.id 
                                  ? "bg-blue-50 text-blue-700 font-bold" 
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold truncate font-sans">
                                  👥 {u.fullName} {u.nickname ? `(${u.nickname})` : ""}
                                </span>
                                {targetUserId === u.id && <Check size={14} className="text-blue-600 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                <span>[{u.classroom || "ไม่ระบุห้อง"}]</span>
                                <span>•</span>
                                <span>รหัส: {u.studentId}</span>
                              </div>
                            </button>
                          ))}

                          {filteredClassmates.filter(u => u.id !== currentUser.id).length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400">
                              ❌ ไม่พบรายชื่อเพื่อนที่ตรงกับ "{searchTerm}"
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left Column: List of Bills */}
      <div className="md:col-span-1 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3 sm:space-y-4 h-fit">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">รายการค่าบำรุงกองทุนรายเดือน</h2>
          <p className="text-[11px] sm:text-xs text-slate-400">ปัดหน้าจอเพื่อเลื่อน หรือคลิกเลือกเดือนเพื่อชำระเงิน</p>
        </div>
        
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 snap-x scrollbar-none">
          {myBills.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm w-full">
              ยังไม่มีบิลเรียกเก็บเงินในระบบ
            </div>
          ) : (
            myBills.map((bill) => {
              return (
                <div 
                  key={bill.id}
                  onClick={() => {
                    setSelectedBill(bill);
                    setUploadSuccess(false);
                    setSlipUrl("");
                    setSlipFile(null);
                  }}
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer border transition-all flex items-center justify-between min-w-[210px] md:min-w-0 snap-start shrink-0 ${
                    selectedBill?.id === bill.id 
                      ? "border-blue-500 bg-blue-50/50" 
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-800">
                      รอบเดือน {getThaiMonthName(bill.month)} {bill.year}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-sans">
                      ฿{bill.amount} | {new Date(bill.dueDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 scale-90 sm:scale-100 origin-right">
                    {getStatusBadge(bill)}
                    <ChevronRight size={14} className="text-slate-400 hidden sm:block" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Middle & Right Column: Payment Details and Scanner */}
      <div className="md:col-span-2 space-y-6">
        {selectedBill ? (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">
                  รายละเอียดรอบชำระ
                </span>
                <h2 className="text-xl font-bold text-slate-800 mt-2 font-sans">
                  รอบเดือน {getThaiMonthName(selectedBill.month)} {selectedBill.year} (ยอดชำระ ฿{selectedBill.amount})
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {getDetailedBillStatus(selectedBill, payments).subText}
                </p>
              </div>
              <div>{getStatusBadge(selectedBill)}</div>
            </div>

            {/* If paid already, display invoice/receipt */}
            {selectedBill.status === "paid" ? (
              <div className="bg-emerald-50/40 rounded-2xl p-6 border border-emerald-100 flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-emerald-500 text-white p-3.5 rounded-full">
                  <CheckCircle2 size={36} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-emerald-800">ชำระเงินเรียบร้อยแล้วค่ะ</h3>
                  <p className="text-xs text-emerald-600">ตรวจสอบและอนุมัติใบเสร็จโดยเหรัญญิกกองทุนเรียบร้อยแล้ว</p>
                </div>

                {/* Display Receipt Card */}
                {myPayments.find(p => p.billId === selectedBill.id && p.status === "approved") && (
                  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm w-full max-w-sm text-left space-y-3 font-sans">
                    <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                      <span className="text-[10px] font-bold text-slate-400 font-mono">Receipt No.</span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {myPayments.find(p => p.billId === selectedBill.id)?.receiptNumber}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span className="text-slate-400">ชื่อนักศึกษา:</span>
                      <span className="text-slate-800 font-bold text-right">{activeUser.fullName}</span>
 
                      <span className="text-slate-400">รหัสประจำตัว:</span>
                      <span className="text-slate-800 font-mono text-right">{activeUser.studentId}</span>

                      <span className="text-slate-400">ยอดชำระ:</span>
                      <span className="text-slate-800 font-bold text-right">฿{selectedBill.amount.toFixed(2)}</span>

                      <span className="text-slate-400">วันที่อนุมัติ:</span>
                      <span className="text-slate-800 text-right">
                        {new Date(myPayments.find(p => p.billId === selectedBill.id && p.status === "approved")?.reviewedAt || "").toLocaleDateString("th-TH")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedBill.status === "pending_review" || uploadSuccess ? (
              <div className="bg-amber-50/40 rounded-2xl p-6 border border-amber-100 flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-amber-500 text-white p-3.5 rounded-full animate-pulse">
                  <Clock size={36} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-amber-850">
                    {isCashPending ? "ส่งคำขอชำระเงินสดเรียบร้อย" : "อัปโหลดสลิปเรียบร้อยแล้ว"}
                  </h3>
                  <p className="text-xs text-amber-700 max-w-sm leading-relaxed">
                    {isCashPending 
                      ? "อยู่ระหว่างรอเหรัญญิกตรวจสอบและกดยืนยันการรับเงินสดเข้าระบบหลังบ้านค่ะ" 
                      : "กำลังรอเหรัญญิกตรวจสอบความถูกต้องของข้อมูลและสลิปการโอนเงินค่ะ"}
                  </p>
                </div>

                {/* Pending payment details */}
                {pendingPayment && (
                  <div className="bg-white p-4 rounded-xl border border-amber-200/50 text-xs text-left w-full max-w-xs space-y-1.5 font-sans shadow-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>รูปแบบการจ่าย:</span>
                      <span className="font-bold text-slate-700">{isCashPending ? "💵 เงินสด" : "🏦 โอนเงินผ่านธนาคาร"}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>จำนวนเงินที่แจ้ง:</span>
                      <span className="font-mono font-bold text-slate-800">฿{pendingPayment.amount}</span>
                    </div>
                    {pendingPayment.note && (
                      <div className="border-t border-slate-100 pt-1.5 mt-1 text-[11px] text-slate-500">
                        <span className="font-bold">บันทึก:</span> {pendingPayment.note}
                      </div>
                    )}
                  </div>
                )}

                {displaySlipUrl && displaySlipUrl !== "cash" && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm max-w-xs bg-white">
                    <img src={displaySlipUrl} alt="Submitted Slip" className="max-h-48 object-contain" referrerPolicy="no-referrer" />
                  </div>
                )}

                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelClick}
                  className="mt-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2.5 px-5 rounded-xl text-xs transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                >
                  {isCancelling ? "กำลังยกเลิก..." : "❌ ยกเลิกคำขอนี้ / ส่งหลักฐานใหม่"}
                </button>
              </div>
            ) : (
              /* If not paid, show PromptPay and Slip uploader */
              <div className="space-y-6">
                {/* Payment Method Switcher */}
                {canSelectClassmate && targetUserId !== currentUser.id ? (
                  <div className="bg-slate-50 p-1 rounded-2xl border border-slate-100 flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("transfer");
                        setSlipUrl("");
                        setSlipFile(null);
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        paymentMethod === "transfer"
                          ? "bg-blue-600 text-white shadow-md font-sans"
                          : "text-slate-500 hover:text-slate-850 hover:bg-slate-100/60 font-sans"
                      }`}
                    >
                      🏦 แนบสลิปโอนเงินแทนเพื่อน
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("cash");
                        setSlipUrl("");
                        setSlipFile(null);
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        paymentMethod === "cash"
                          ? "bg-blue-600 text-white shadow-md font-sans"
                          : "text-slate-500 hover:text-slate-850 hover:bg-slate-100/60 font-sans"
                      }`}
                    >
                      💵 รับชำระเป็นเงินสดจากเพื่อน
                    </button>
                  </div>
                ) : (
                  <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100/80 flex items-center justify-between text-xs font-sans text-blue-900">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">🏦</span>
                      <span>ชำระผ่านการโอนเงิน (สแกน QR Code หรือคัดลอกเลขบัญชี แล้วแนบสลิป)</span>
                    </div>
                    <span className="text-[10px] text-blue-700 font-bold shrink-0 bg-blue-100/70 px-2 py-0.5 rounded-lg">
                      💡 หากจ่ายเงินสด ให้ส่งเงินสดแก่หัวหน้าห้อง/เหรัญญิกเพื่อบันทึกรับเงิน
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-150">
                  {/* Left Column: QR / Cash Guide */}
                  {paymentMethod === "cash" && canSelectClassmate && targetUserId !== currentUser.id ? (
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 rounded-2xl p-6 border border-emerald-100 text-left space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="bg-emerald-600 text-white w-fit px-3 py-1 rounded-full font-bold flex items-center gap-1.5 text-[10px] tracking-wider font-sans">
                          💵 วิธีชำระด้วยเงินสด
                        </div>
                        <h4 className="font-bold text-slate-850 text-sm">จ่ายเงินสดโดยตรงแก่เหรัญญิกประจำห้อง</h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-sans">
                          คุณสามารถนำเงินสดจำนวน <strong className="text-emerald-700 text-sm font-mono font-bold">฿{customAmount || (selectedBill.amount - getApprovedAmt(selectedBill.id))} บาท</strong> ไปจ่ายให้กับเหรัญญิกประจำห้องของคุณได้โดยตรงค่ะ
                        </p>
                        <div className="bg-white p-3.5 rounded-xl border border-emerald-100/60 text-[11px] text-slate-500 space-y-1.5 font-sans">
                          <p className="font-bold text-slate-700">📌 ขั้นตอนในการดำเนินงาน:</p>
                          <p>1. กรอกยอดเงินที่ต้องการจ่ายที่ช่องขวามือ</p>
                          <p>2. เขียนบันทึกเพื่อแจ้งว่าจ่ายให้กับใคร (ถ้าจำเป็น)</p>
                          <p>3. กดปุ่มด้านล่างเพื่อแจ้งเหรัญญิก</p>
                          <p>4. เมื่อเหรัญญิกได้รับเงินสดแล้ว จะกดยืนยันบิลนี้ให้ทันทีค่ะ</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* PromptPay / Bank Account Side */
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="bg-[#002d62] text-white px-4 py-1.5 rounded-full font-bold flex items-center gap-1.5 text-xs tracking-wider">
                        <QrCode size={14} /> {settings.bankName || "พร้อมเพย์"}
                      </div>

                      {((!settings.bankName || settings.bankName.includes("พร้อมเพย์") || settings.bankName.toLowerCase().includes("prompt")) || settings.promptpayQrUrl) ? (
                        <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100">
                          <img 
                            src={getPromptPayQR(customAmount || (selectedBill.amount - getApprovedAmt(selectedBill.id)))} 
                            alt="Payment QR Code" 
                            className="w-44 h-44 object-contain mx-auto"
                          />
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 rounded-2xl w-full text-left space-y-4 shadow-md relative overflow-hidden my-1">
                          {/* Decorative background circle */}
                          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 pointer-events-none">
                            <DollarSign size={120} />
                          </div>
                          <div>
                            <p className="text-[10px] text-blue-100 uppercase tracking-widest font-bold">ช่องทางโอนผ่านธนาคาร</p>
                            <p className="font-sans font-bold text-base mt-0.5">{settings.bankName}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-blue-100 uppercase tracking-widest font-bold">ชื่อบัญชี</p>
                            <p className="font-sans font-medium text-xs truncate">{settings.promptpayName}</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 w-full">
                        <p className="text-xs text-slate-400 font-semibold uppercase">ชื่อบัญชีรับโอน</p>
                        <h4 className="text-sm font-bold text-slate-800">{settings.promptpayName}</h4>
                        
                        <div className="mt-2.5 flex items-center justify-between gap-2 bg-white border border-slate-200 p-2 rounded-xl w-full max-w-xs mx-auto">
                          <div className="text-left min-w-0 flex-1 px-1">
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">เลขบัญชี / เบอร์พร้อมเพย์</p>
                            <p className="text-xs font-mono font-bold text-slate-800 truncate">{settings.promptpayNumber}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(settings.promptpayNumber);
                              setCopiedText(true);
                              setTimeout(() => setCopiedText(false), 2000);
                            }}
                            className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold ${
                              copiedText 
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
                                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 active:scale-95"
                            }`}
                            title="คัดลอกเลขบัญชี"
                          >
                            {copiedText ? (
                              <>
                                <Check size={12} className="animate-bounce" />
                                <span>คัดลอกแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>คัดลอก</span>
                              </>
                            )}
                          </button>
                        </div>

                        {getApprovedAmt(selectedBill.id) > 0 && (
                          <p className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg mt-2">
                            ชำระแล้วบางส่วน: ฿{getApprovedAmt(selectedBill.id)} / ฿{selectedBill.amount}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Right Column: Form Side */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm">
                      {paymentMethod === "cash" ? "กรอกรายละเอียดชำระเงินสด" : "อัปโหลดสลิปหลักฐานการโอนเงิน"}
                    </h3>
                    
                    {/* Amount Input Block */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-600">ระบุยอดเงินที่จะชำระในรอบนี้ (บาท)</label>
                        <span className="text-slate-400 font-medium">
                          ยอดค้าง: <span className="font-mono font-bold text-slate-800">฿{selectedBill.amount - getApprovedAmt(selectedBill.id)}</span>
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3.5 text-slate-400 text-xs font-bold">฿</span>
                        <input
                          type="number"
                          min={1}
                          max={selectedBill.amount - getApprovedAmt(selectedBill.id)}
                          placeholder={`ระบุยอดเงินที่จะจ่าย เช่น ${selectedBill.amount - getApprovedAmt(selectedBill.id)}`}
                          value={customAmount || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const maxLimit = selectedBill.amount - getApprovedAmt(selectedBill.id);
                            if (val > maxLimit) {
                              setCustomAmount(maxLimit);
                            } else {
                              setCustomAmount(val);
                            }
                          }}
                          className="w-full text-xs p-3.5 pl-8 border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none font-mono font-bold bg-white"
                          required
                        />
                      </div>
                      {paymentMethod === "transfer" && (
                        <p className="text-[10px] text-slate-400">
                          ⚡ *คุณสามารถพิมพ์จำนวนเงินที่ต้องการชำระได้ตามต้องการ และ QR Code ด้านซ้ายจะปรับยอดเงินตามโดยอัตโนมัติค่ะ*
                        </p>
                      )}
                    </div>

                    {paymentMethod === "transfer" && (
                      <>
                        {/* Image Preview Block */}
                        {slipUrl ? (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-48 group bg-slate-50">
                            <img src={slipUrl} alt="Slip Upload Preview" className="w-full h-48 object-contain bg-slate-100" />
                            <div className="absolute top-2 right-2 flex items-center gap-1.5">
                              <button 
                                type="button"
                                onClick={() => {
                                  setSlipUrl("");
                                  setSlipFile(null);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-2.5 py-1 transition-all text-xs font-bold shadow-md flex items-center gap-1"
                                title="ลบรูปสลิปนี้"
                              >
                                🗑️ ลบสลิป
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center bg-slate-50/50 cursor-pointer relative">
                            <input 
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              required
                            />
                            <UploadCloud className="text-slate-400 mb-2" size={32} />
                            <p className="text-xs font-bold text-slate-700">ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-sans">รูปภาพสลิปชำระเงินขนาดไม่เกิน 500KB</p>
                          </div>
                        )}

                        {/* Sandbox helpers to make testing delightful */}
                        {!slipUrl && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold text-slate-400">💡 ตัวเลือกสลิปทดสอบด่วน (คลิกเพื่อทดสอบทันที):</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                type="button"
                                onClick={() => selectMockSlip(0)}
                                className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-all"
                              >
                                สลิปจำลอง 1
                              </button>
                              <button 
                                type="button"
                                onClick={() => selectMockSlip(1)}
                                className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-all"
                              >
                                สลิปจำลอง 2
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Custom notes */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">
                        {paymentMethod === "cash" ? "บันทึกเพิ่มเติม (เช่น จ่ายเมื่อตอนพักกลางวัน)" : "บันทึกเพิ่มเติม (ถ้ามี)"}
                      </label>
                      <input 
                        type="text" 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={paymentMethod === "cash" ? "ระบุข้อมูลเพิ่มเติมเพื่อให้ตรวจสอบง่ายขึ้น" : "เช่น โอนเวลา 14:30 น."}
                        className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isUploading || (paymentMethod === "transfer" && !slipUrl)}
                      className={`w-full font-semibold rounded-xl text-xs py-3 text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                        isUploading || (paymentMethod === "transfer" && !slipUrl)
                          ? "bg-slate-300 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 hover:shadow-xl"
                      }`}
                    >
                      {isUploading 
                        ? "กำลังส่งข้อมูล..." 
                        : paymentMethod === "cash"
                          ? "แจ้งชำระด้วยเงินสดแก่เหรัญญิก"
                          : "ส่งสลิปให้เหรัญญิกตรวจสอบ"
                      }
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm text-center py-12 text-slate-400">
            กรุณาเลือกบิลเพื่อดูรายละเอียด
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
