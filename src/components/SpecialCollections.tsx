/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Special Collections / Custom Campaigns Component
 * (ระบบเก็บเงินพิเศษ / ค่าเสื้อ / ค่าทริป / ค่าชุดกิจกรรม)
 */

import React, { useState } from "react";
import { 
  ShoppingBag, 
  Shirt, 
  Bus, 
  Package, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  QrCode, 
  Upload, 
  Trash2, 
  X, 
  FileText, 
  Users, 
  Download,
  AlertCircle
} from "lucide-react";
import { User, SystemSettings, SpecialCampaign, SpecialOrder, UserRole } from "../types";
import { compressImage } from "../utils/imageCompressor";

export interface SpecialCollectionsProps {
  currentUser: User;
  users: User[];
  settings: SystemSettings;
  specialCampaigns: SpecialCampaign[];
  specialOrders: SpecialOrder[];
  onCreateCampaign: (
    title: string, 
    description: string, 
    category: "t_shirt" | "activity_gear" | "trip" | "other", 
    isMandatory: boolean, 
    amountPerUnit: number, 
    hasOptions: boolean, 
    options: string[], 
    dueDate?: string
  ) => Promise<unknown>;
  onToggleCampaignStatus: (campaignId: string, status: "active" | "closed") => Promise<unknown>;
  onDeleteCampaign: (campaignId: string) => Promise<unknown>;
  onPlaceOrder: (campaignId: string, selectedOption: string, quantity: number) => Promise<unknown>;
  onSubmitPayment: (campaignId: string, orderId: string | undefined, selectedOption: string, quantity: number, slipUrl: string, note: string) => Promise<unknown>;
  onReviewOrder: (orderId: string, action: "approve" | "reject", rejectReason?: string) => Promise<unknown>;
}

export default function SpecialCollections({
  currentUser,
  users,
  settings,
  specialCampaigns,
  specialOrders,
  onCreateCampaign,
  onToggleCampaignStatus,
  onDeleteCampaign,
  onPlaceOrder,
  onSubmitPayment,
  onReviewOrder
}: SpecialCollectionsProps) {
  const isManagementRole = [UserRole.TREASURER, UserRole.LEADER, UserRole.COMMITTEE].includes(currentUser.role);

  const [selectedCampaign, setSelectedCampaign] = useState<SpecialCampaign | null>(
    specialCampaigns[0] || null
  );

  React.useEffect(() => {
    if (selectedCampaign) {
      const updated = specialCampaigns.find(c => c.id === selectedCampaign.id);
      if (updated) setSelectedCampaign(updated);
    } else if (specialCampaigns.length > 0) {
      setSelectedCampaign(specialCampaigns[0]);
    }
  }, [specialCampaigns]);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showSlipPreviewModal, setShowSlipPreviewModal] = useState<string | null>(null);

  // Form States: Create Campaign
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newCategory, setNewCategory] = useState<"t_shirt" | "activity_gear" | "trip" | "other">("t_shirt");
  const [newIsMandatory, setNewIsMandatory] = useState<boolean>(false);
  const [newAmountPerUnit, setNewAmountPerUnit] = useState<string>("");
  const [newHasOptions, setNewHasOptions] = useState<boolean>(true);
  const [newOptionsText, setNewOptionsText] = useState<string>("S (36\"), M (38\"), L (40\"), XL (42\"), 2XL (44\")");
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Form States: Order & Pay
  const [orderOption, setOrderOption] = useState<string>("");
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [orderSlipUrl, setOrderSlipUrl] = useState<string>("");
  const [orderNote, setOrderNote] = useState<string>("");
  const [isSubmittingPay, setIsSubmittingPay] = useState<boolean>(false);

  // Form States: Review
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Mock Slips for fast testing
  const mockSlips = [
    { name: "สลิป KPlus 350.00 บาท", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='550' viewBox='0 0 400 550'><rect width='100%' height='100%' fill='%23047857'/><text x='50%' y='40%' font-size='24' fill='white' font-family='sans-serif' text-anchor='middle' font-weight='bold'>KPLUS SLIP SUCCESS</text><text x='50%' y='50%' font-size='32' fill='%23a7f3d0' font-family='sans-serif' text-anchor='middle' font-weight='bold'>฿350.00</text><text x='50%' y='60%' font-size='16' fill='white' font-family='sans-serif' text-anchor='middle'>ชำระค่าเสื้อช็อป</text></svg>" },
    { name: "สลิป SCB 700.00 บาท", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='550' viewBox='0 0 400 550'><rect width='100%' height='100%' fill='%234c1d95'/><text x='50%' y='40%' font-size='24' fill='white' font-family='sans-serif' text-anchor='middle' font-weight='bold'>SCB EASY SLIP</text><text x='50%' y='50%' font-size='32' fill='%23ddd6fe' font-family='sans-serif' text-anchor='middle' font-weight='bold'>฿700.00</text><text x='50%' y='60%' font-size='16' fill='white' font-family='sans-serif' text-anchor='middle'>ชำระค่าเสื้อช็อป (2 ตัว)</text></svg>" }
  ];

  const handleSlipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string, 900, 0.7);
        setOrderSlipUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("กรุณาระบุชื่อรายการเก็บเงินพิเศษ");
      return;
    }
    const numAmt = parseFloat(newAmountPerUnit);
    if (isNaN(numAmt) || numAmt <= 0) {
      alert("กรุณาระบุจำนวนเงินต่อหน่วยที่ถูกต้อง");
      return;
    }

    const optionsArray = newHasOptions
      ? newOptionsText.split(",").map(o => o.trim()).filter(Boolean)
      : [];

    setIsSubmittingCreate(true);
    try {
      await onCreateCampaign(
        newTitle.trim(),
        newDescription.trim(),
        newCategory,
        newIsMandatory,
        numAmt,
        newHasOptions,
        optionsArray,
        newDueDate || undefined
      );
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewAmountPerUnit("");
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการสร้างรายการ");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;

    if (selectedCampaign.hasOptions && (!selectedCampaign.options || selectedCampaign.options.length > 0) && !orderOption) {
      alert("กรุณาเลือกไซส์/ตัวเลือกสินค้า");
      return;
    }

    if (!orderSlipUrl) {
      alert("กรุณาแนบรูปภาพสลิปการโอนเงิน");
      return;
    }

    const myOrder = specialOrders.find(o => o.campaignId === selectedCampaign.id && o.userId === currentUser.id);

    setIsSubmittingPay(true);
    try {
      await onSubmitPayment(
        selectedCampaign.id,
        myOrder?.id,
        orderOption,
        orderQuantity,
        orderSlipUrl,
        orderNote
      );
      setShowPayModal(false);
      setOrderSlipUrl("");
      setOrderNote("");
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการส่งสลิปชำระเงิน");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleReview = async (orderId: string, action: "approve" | "reject") => {
    if (action === "reject" && !rejectReason.trim()) {
      alert("กรุณาระบุเหตุผลการปฏิเสธสลิป");
      return;
    }
    setIsSubmittingReview(true);
    try {
      await onReviewOrder(orderId, action, action === "reject" ? rejectReason.trim() : undefined);
      setRejectingOrderId(null);
      setRejectReason("");
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Export CSV (Excel compatible)
  const handleExportCSV = () => {
    if (!selectedCampaign) return;

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel Thai language support
    csvContent += "ลำดับ,รหัสนักศึกษา,ชื่อ-นามสกุล,ตัวเลือก/ไซส์,จำนวน,ยอดเงินรวม (บาท),สถานะชำระเงิน,วันเวลาชำระเงิน\n";

    users.forEach((usr, index) => {
      const order = specialOrders.find(o => o.campaignId === selectedCampaign.id && o.userId === usr.id);
      const opt = order?.selectedOption || (selectedCampaign.hasOptions ? "ไม่ได้เลือก" : "ทั่วไป");
      const qty = order?.quantity || 0;
      const amt = order?.totalAmount || selectedCampaign.amountPerUnit;
      const statusLabel = order?.status === "paid" ? "ชำระแล้ว" : order?.status === "pending_review" ? "รอตรวจสอบ" : order?.status === "rejected" ? "ถูกปฏิเสธ" : "ยังไม่ชำระ";
      const paidDate = order?.paidAt ? new Date(order.paidAt).toLocaleDateString("th-TH") : "-";

      const cleanName = usr.fullName.replace(/,/g, " ");
      csvContent += `${index + 1},${usr.studentId},${cleanName},${opt},${qty},${amt},${statusLabel},${paidDate}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `สรุปการเก็บเงิน_${selectedCampaign.title.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF Report
  const handleExportPDF = () => {
    if (!selectedCampaign) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("กรุณายืนยันเปิด Pop-up เพื่อบันทึกไฟล์ PDF ค่ะ");
      return;
    }

    const optSummaryHtml = Object.entries(optionBreakdown).map(([opt, qty]) => `
      <div style="display:inline-block; background:#f1f5f9; padding:6px 12px; border-radius:8px; margin:3px; border:1px solid #cbd5e1; font-size:11px;">
        <strong>${opt}:</strong> ${qty} ตัว
      </div>
    `).join("");

    const rowsHtml = users.map((usr, index) => {
      const order = specialOrders.find(o => o.campaignId === selectedCampaign.id && o.userId === usr.id);
      const opt = order?.selectedOption || (selectedCampaign.hasOptions ? "-" : "ทั่วไป");
      const qty = order?.quantity || 0;
      const amt = order?.totalAmount || selectedCampaign.amountPerUnit;
      const statusLabel = order?.status === "paid" ? "ชำระแล้ว" : order?.status === "pending_review" ? "รอตรวจสอบ" : order?.status === "rejected" ? "ถูกปฏิเสธ" : "ยังไม่ชำระ";
      const statusColor = order?.status === "paid" ? "#059669" : order?.status === "pending_review" ? "#d97706" : "#dc2626";

      return `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:center;">${index + 1}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-family:monospace;">${usr.studentId}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>${usr.fullName}</strong></td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:center;">${opt}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:center;">${qty}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold;">฿${amt.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:center; font-weight:bold; color:${statusColor};">${statusLabel}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>รายงานสรุปการเก็บเงินพิเศษ - ${selectedCampaign.title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Sarabun', sans-serif; font-size: 12px; color: #1e293b; padding: 20px; }
            h1 { font-size: 20px; color: #0f172a; margin-bottom: 4px; text-align: center; }
            p.sub { text-align: center; color: #64748b; font-size: 11px; margin-top: 0; }
            .box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #f1f5f9; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: bold; text-align: left; }
            .signatures { margin-top: 40px; width: 100%; }
            .sig-cell { width: 50%; text-align: center; font-size: 11px; vertical-align: top; }
          </style>
        </head>
        <body>
          <h1>รายงานสรุปการเก็บเงินพิเศษ: ${selectedCampaign.title}</h1>
          <p class="sub">ออกเอกสาร ณ วันที่ ${new Date().toLocaleDateString("th-TH", {year:"numeric", month:"long", day:"numeric"})}</p>
          
          <div class="box">
            <table style="margin:0; border:none;">
              <tr>
                <td><strong>ราคาต่อหน่วย:</strong> ฿${selectedCampaign.amountPerUnit.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td><strong>ยอดจัดเก็บได้แล้ว:</strong> ฿${totalPaidAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td><strong>ผู้ชำระแล้ว:</strong> ${paidOrders.length} / ${users.length} คน</td>
              </tr>
            </table>
            ${selectedCampaign.hasOptions ? `<div style="margin-top:10px;"><strong>สรุปยอดตามไซส์/ตัวเลือก:</strong><br/>${optSummaryHtml}</div>` : ""}
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align:center;">ลำดับ</th>
                <th>รหัสนักศึกษา</th>
                <th>ชื่อ-นามสกุล</th>
                <th style="text-align:center;">ไซส์/ตัวเลือก</th>
                <th style="text-align:center;">จำนวน</th>
                <th style="text-align:right;">ยอดรวม</th>
                <th style="text-align:center;">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <table class="signatures">
            <tr>
              <td class="sig-cell">
                <br/><br/>
                ลงชื่อ........................................................<br/>
                ( ${settings.promptpayName || "เหรัญญิกกองทุน"} )<br/>
                เหรัญญิกประจำห้อง
              </td>
              <td class="sig-cell">
                <br/><br/>
                ลงชื่อ........................................................<br/>
                (........................................................)<br/>
                อาจารย์ที่ปรึกษา / ประธานโครงการ
              </td>
            </tr>
          </table>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Icon selector by category
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "t_shirt":
        return <Shirt className="text-indigo-600" size={20} />;
      case "trip":
        return <Bus className="text-amber-600" size={20} />;
      case "activity_gear":
        return <Package className="text-emerald-600" size={20} />;
      default:
        return <ShoppingBag className="text-purple-600" size={20} />;
    }
  };

  // Helper stats for selected campaign
  const campaignOrders = selectedCampaign 
    ? specialOrders.filter(o => o.campaignId === selectedCampaign.id)
    : [];

  const paidOrders = campaignOrders.filter(o => o.status === "paid");
  const pendingOrders = campaignOrders.filter(o => o.status === "pending_review");
  const unpaidOrders = campaignOrders.filter(o => o.status === "unpaid" || o.status === "rejected");

  const totalPaidAmount = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPendingAmount = pendingOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Option breakdown stats (e.g. S: 5, M: 12, L: 18)
  const optionBreakdown: Record<string, number> = {};
  paidOrders.forEach(o => {
    const key = o.selectedOption || "ทั่วไป";
    optionBreakdown[key] = (optionBreakdown[key] || 0) + o.quantity;
  });

  const currentUserOrder = selectedCampaign
    ? specialOrders.find(o => o.campaignId === selectedCampaign.id && o.userId === currentUser.id)
    : null;

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-semibold backdrop-blur-md">
              <ShoppingBag size={14} />
              <span>Special Collections & Custom Campaigns</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display">
              ระบบเก็บเงินพิเศษ (ค่าเสื้อ / ค่ากิจกรรม / ค่าทริป)
            </h1>
            <p className="text-xs text-purple-200/80 max-w-2xl leading-relaxed">
              จัดการรายการเก็บเงินเฉพาะกิจที่ไม่เกี่ยวข้องกับเงินกองกลางรายเดือน ติดตามรายคน อนุมัติสลิป และเลือกตัวเลือกสินค้าได้อย่างสะดวก
            </p>
          </div>

          {isManagementRole && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-xs shrink-0 cursor-pointer"
            >
              <Plus size={18} />
              <span>+ สร้างรายการเก็บเงินพิเศษ</span>
            </button>
          )}
        </div>
      </div>

      {/* Campaign Selection Tabs */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
            รายการเก็บเงินพิเศษทั้งหมด ({specialCampaigns.length})
          </h2>
          {selectedCampaign && isManagementRole && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleCampaignStatus(selectedCampaign.id, selectedCampaign.status === "active" ? "closed" : "active")}
                className={`text-[11px] font-bold px-3 py-1 rounded-xl transition-all border ${
                  selectedCampaign.status === "active"
                    ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {selectedCampaign.status === "active" ? "🔒 ปิดรับชำระ" : "🔓 เปิดรับชำระ"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`ยืนยันการลบรายการ "${selectedCampaign.title}" ใช่หรือไม่?`)) {
                    onDeleteCampaign(selectedCampaign.id);
                  }
                }}
                className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-xl transition-all"
              >
                <Trash2 size={13} className="inline mr-1" />
                ลบรายการ
              </button>
            </div>
          )}
        </div>

        {specialCampaigns.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            ยังไม่มีรายการเก็บเงินพิเศษเปิดใช้งาน สามารถคลิกสร้างรายการใหม่ได้ค่ะ
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {specialCampaigns.map((camp) => {
              const isSelected = selectedCampaign?.id === camp.id;
              const campOrders = specialOrders.filter(o => o.campaignId === camp.id);
              const paidCount = campOrders.filter(o => o.status === "paid").length;

              return (
                <div
                  key={camp.id}
                  onClick={() => setSelectedCampaign(camp)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
                    isSelected
                      ? "bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                      : "bg-slate-50/60 hover:bg-slate-100/80 border-slate-200/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                        {getCategoryIcon(camp.category)}
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-slate-800 line-clamp-1">{camp.title}</h3>
                        <p className="text-[10px] text-slate-500">
                          {camp.isMandatory ? "⚡ บังคับทุกคนจ่าย" : "🙋‍♂️ สั่งซื้อตามสมัครใจ"}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      camp.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {camp.status === "active" ? "กำลังเปิด" : "ปิดแล้ว"}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-xs font-extrabold text-indigo-700">
                      ฿{camp.amountPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="text-[9px] font-normal text-slate-400"> / หน่วย</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ชำระแล้ว: <strong className="text-emerald-600">{paidCount}</strong> คน
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Campaign Details */}
      {selectedCampaign && (
        <div className="space-y-6">
          {/* Status & Stats Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ราคาต่อหน่วย</span>
              <p className="text-xl font-extrabold text-slate-800">
                ฿{selectedCampaign.amountPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">{selectedCampaign.hasOptions ? `มี ${selectedCampaign.options?.length || 0} ตัวเลือก` : "ราคาคงที่"}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ยอดเงินที่จัดเก็บได้แล้ว</span>
              <p className="text-xl font-extrabold text-emerald-700">
                ฿{totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">จากผู้ชำระแล้ว {paidOrders.length} คน</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">รอตรวจสอบสลิป</span>
              <p className="text-xl font-extrabold text-amber-700">
                ฿{totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">จำนวน {pendingOrders.length} รายการ</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">ยังไม่ชำระเงิน</span>
              <p className="text-xl font-extrabold text-rose-700">
                {unpaidOrders.length} คน
              </p>
              <p className="text-[10px] text-slate-500">กำหนดชำระ: {selectedCampaign.dueDate ? new Date(selectedCampaign.dueDate).toLocaleDateString("th-TH") : "ไม่ระบุ"}</p>
            </div>
          </div>

          {/* Student Personal Order Action Panel */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider font-mono">สถานะการสั่งซื้อชำระเงินของคุณ</span>
                <h3 className="text-lg font-bold font-display">{selectedCampaign.title}</h3>
              </div>

              {currentUserOrder?.status === "paid" ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                  <CheckCircle2 size={16} />
                  <span>ชำระเงินเรียบร้อยแล้ว</span>
                </div>
              ) : currentUserOrder?.status === "pending_review" ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                  <Clock size={16} />
                  <span>รอเหรัญญิกตรวจสอบสลิป</span>
                </div>
              ) : currentUserOrder?.status === "rejected" ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
                  <XCircle size={16} />
                  <span>สลิปถูกปฏิเสธ (โปรดแนบใหม่)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold">
                  <AlertCircle size={16} />
                  <span>ยังไม่ได้ชำระเงิน</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400">ตัวเลือกที่เลือก:</span>
                <p className="font-bold text-sm text-indigo-200 mt-0.5">
                  {currentUserOrder?.selectedOption || (selectedCampaign.hasOptions ? "ยังไม่ได้เลือก" : "ทั่วไป")}
                </p>
              </div>

              <div>
                <span className="text-slate-400">จำนวนที่สั่ง:</span>
                <p className="font-bold text-sm text-indigo-200 mt-0.5">
                  {currentUserOrder?.quantity || 1} รายการ (ยอด ฿{((currentUserOrder?.quantity || 1) * selectedCampaign.amountPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </p>
              </div>

              <div className="flex items-center sm:justify-end">
                {selectedCampaign.status === "active" && (
                  <button
                    onClick={() => {
                      if (currentUserOrder?.selectedOption) setOrderOption(currentUserOrder.selectedOption);
                      if (currentUserOrder?.quantity) setOrderQuantity(currentUserOrder.quantity);
                      setShowPayModal(true);
                    }}
                    className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-2xl shadow-md transition-all text-xs cursor-pointer"
                  >
                    {currentUserOrder ? "✏️ แก้ไขสั่งซื้อ / แนบสลิปใหม่" : "🛒 ชำระเงิน / แนบสลิปโอน"}
                  </button>
                )}
              </div>
            </div>

            {currentUserOrder?.rejectReason && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-200 text-xs">
                ⚠️ เหตุผลการปฏิเสธ: {currentUserOrder.rejectReason}
              </div>
            )}
          </div>

          {/* Option Breakdown Summary (Total sizes summary for T-Shirts) */}
          {selectedCampaign.hasOptions && Object.keys(optionBreakdown).length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-sm text-slate-800 font-display flex items-center gap-2">
                  <Package size={16} className="text-indigo-600" />
                  <span>สรุปยอดจำแนกตามไซส์/ตัวเลือก (สำหรับส่งสั่งโรงงาน)</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {Object.entries(optionBreakdown).map(([opt, qty]) => (
                  <div key={opt} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block truncate">{opt}</span>
                    <span className="text-base font-extrabold text-indigo-700 block mt-0.5">{qty} <span className="text-[10px] font-normal text-slate-400">ตัว</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Management Dashboard Table: All Students Order Status */}
          {isManagementRole && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-slate-800 font-display">ตารางติดตามรายคน & ตรวจสอบสลิป</h3>
                  <p className="text-xs text-slate-500 font-sans">รายชื่อสมาชิกในห้องทั้งหมดกับการชำระเงินในรายการนี้</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono mr-2">รวมนักศึกษาทั้งหมด: {users.length} คน</span>
                  <button
                    onClick={handleExportPDF}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    <FileText size={14} />
                    <span>🖨️ เซฟเป็น PDF / พิมพ์สรุป</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    <Download size={14} />
                    <span>📊 เซฟเป็นไฟล์ Excel (CSV)</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-3">นักศึกษา</th>
                      <th className="py-3 px-3">ตัวเลือก/ไซส์</th>
                      <th className="py-3 px-3">จำนวน</th>
                      <th className="py-3 px-3 text-right">ยอดรวม</th>
                      <th className="py-3 px-3 text-center">หลักฐานสลิป</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-3 text-right">อนุมัติ/จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {users.map((usr) => {
                      const order = specialOrders.find(o => o.campaignId === selectedCampaign.id && o.userId === usr.id);

                      return (
                        <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800">{usr.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{usr.studentId}</div>
                          </td>

                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {order?.selectedOption || (selectedCampaign.hasOptions ? "-" : "ทั่วไป")}
                          </td>

                          <td className="py-3 px-3 font-semibold">
                            {order?.quantity || 0}
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            ฿{(order?.totalAmount || selectedCampaign.amountPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {order?.slipUrl ? (
                              <button
                                onClick={() => setShowSlipPreviewModal(order.slipUrl || null)}
                                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                              >
                                📎 ดูสลิป
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">ไม่มีสลิป</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {order?.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                <CheckCircle2 size={12} /> ชำระแล้ว
                              </span>
                            ) : order?.status === "pending_review" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 animate-pulse">
                                <Clock size={12} /> รอตรวจสอบ
                              </span>
                            ) : order?.status === "rejected" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                <XCircle size={12} /> ถูกปฏิเสธ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                ยังไม่ชำระ
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            {order?.status === "pending_review" ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleReview(order.id, "approve")}
                                  disabled={isSubmittingReview}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-xs transition-all cursor-pointer"
                                >
                                  ✓ อนุมัติ
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingOrderId(order.id);
                                    setRejectReason("");
                                  }}
                                  disabled={isSubmittingReview}
                                  className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-xs transition-all cursor-pointer"
                                >
                                  ✕ ปฏิเสธ
                                </button>
                              </div>
                            ) : order?.status === "paid" ? (
                              <button
                                onClick={() => handleReview(order.id, "reject")}
                                className="text-[10px] text-slate-400 hover:text-rose-600 underline font-semibold"
                              >
                                ยกเลิกการอนุมัติ
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Campaign */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800 font-display">สร้างรายการเก็บเงินพิเศษ</h3>
                  <p className="text-[11px] text-slate-500 font-sans">ระบุรายละเอียดการเก็บเงินค่าเสื้อ ค่ากิจกรรม หรือทริป</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCampaignSubmit} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">ชื่อรายการเก็บเงิน *</label>
                <input 
                  type="text"
                  required
                  placeholder="เช่น ค่าเสื้อช็อปประจำรุ่น TNS-06, ค่าทริปบายเนียร์..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">หมวดหมู่รายการ</label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                  >
                    <option value="t_shirt">👕 เสื้อผ้า / เสื้อช็อป / เสื้อห้อง</option>
                    <option value="activity_gear">🎒 ชุดอุปกรณ์กิจกรรม</option>
                    <option value="trip">🚌 ทริป / สัมมนา / บายเนียร์</option>
                    <option value="other">🏷️ ค่าใช้จ่ายอื่นๆ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">ราคาต่อหน่วย (บาท) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="350.00"
                    value={newAmountPerUnit}
                    onChange={(e) => setNewAmountPerUnit(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">เงื่อนไขการจัดเก็บ</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewIsMandatory(true)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      newIsMandatory 
                        ? "bg-purple-50 border-purple-500 text-purple-900 font-bold" 
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <span className="block font-bold">⚡ บังคับทุกคนจ่าย</span>
                    <span className="text-[10px] text-slate-400 font-normal">สร้างคิวชำระให้นักศึกษาทุกคนในห้อง</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewIsMandatory(false)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      !newIsMandatory 
                        ? "bg-purple-50 border-purple-500 text-purple-900 font-bold" 
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <span className="block font-bold">🙋‍♂️ ตามความสมัครใจ</span>
                    <span className="text-[10px] text-slate-400 font-normal">เปิดให้เลือกสั่งซื้อเฉพาะคนที่สนใจ</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">มีตัวเลือกไซส์ / ตัวเลือกสินค้า</label>
                  <input 
                    type="checkbox"
                    checked={newHasOptions}
                    onChange={(e) => setNewHasOptions(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                  />
                </div>

                {newHasOptions && (
                  <div>
                    <input 
                      type="text"
                      placeholder="ระบุตัวเลือกแยกด้วยเครื่องหมายจุลภาค (,) เช่น S, M, L, XL, 2XL"
                      value={newOptionsText}
                      onChange={(e) => setNewOptionsText(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">คั่นแต่ละตัวเลือกด้วยเครื่องหมายจุลภาค (,)</p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">รายละเอียดเพิ่มเติม</label>
                <textarea 
                  rows={2}
                  placeholder="คำอธิบาย เช่น สั่งตัดเสื้อช็อปปักโลโก้รุ่น..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">กำหนดชำระเงินวันสุดท้าย (ถ้ามี)</label>
                <input 
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmittingCreate}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl transition-all cursor-pointer font-sans"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer font-sans"
                >
                  {isSubmittingCreate ? "กำลังสร้าง..." : "สร้างรายการเก็บเงิน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Student Pay & Order */}
      {showPayModal && selectedCampaign && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800 font-display">ชำระเงิน & แนบสลิป</h3>
                  <p className="text-[11px] text-slate-500 font-sans">{selectedCampaign.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs font-sans">
              {/* Option Selector */}
              {selectedCampaign.hasOptions && selectedCampaign.options && selectedCampaign.options.length > 0 && (
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">เลือกไซส์ / ตัวเลือกสินค้า *</label>
                  <select
                    value={orderOption}
                    onChange={(e) => setOrderOption(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                  >
                    <option value="">-- โปรดเลือกไซส์/ตัวเลือก --</option>
                    {selectedCampaign.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">จำนวนที่ต้องการสั่งซื้อ</label>
                <input 
                  type="number"
                  min="1"
                  max="20"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-center space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ยอดเงินรวมที่ต้องโอนชำระ</span>
                <p className="text-2xl font-extrabold text-emerald-700">
                  ฿{(selectedCampaign.amountPerUnit * orderQuantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">โอนเข้าบัญชี: {settings.promptpayName} ({settings.promptpayNumber})</p>
              </div>

              {/* Slip Attachment */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">แนบรูปภาพสลิปการโอนเงิน *</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-all">
                  {orderSlipUrl ? (
                    <div className="space-y-2">
                      <img 
                        src={orderSlipUrl} 
                        alt="Slip preview" 
                        className="max-h-36 mx-auto rounded-lg object-contain shadow-xs border border-slate-200"
                      />
                      <button 
                        type="button"
                        onClick={() => setOrderSlipUrl("")}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                      >
                        เปลี่ยนรูปสลิป
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} className="mx-auto text-slate-400 mb-1" />
                      <label className="cursor-pointer font-bold text-emerald-600 hover:text-emerald-700 text-xs">
                        คลิกเพื่อเลือกรูปสลิป
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleSlipFileChange} 
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Mock Slips */}
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 font-bold">หรือเลือกรูปสลิปจำลองสำหรับทดสอบ:</p>
                <div className="grid grid-cols-2 gap-1">
                  {mockSlips.map((ms, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setOrderSlipUrl(ms.url)}
                      className="text-[9px] bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 py-1.5 px-2 rounded-lg border border-slate-200 font-medium truncate transition-all text-center cursor-pointer"
                    >
                      📎 {ms.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                <input 
                  type="text"
                  placeholder="เช่น ฝากพี่โอนแทน..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowPayModal(false)}
                  disabled={isSubmittingPay}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl transition-all cursor-pointer font-sans"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingPay}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer font-sans"
                >
                  {isSubmittingPay ? "กำลังส่งข้อมูล..." : "ส่งสลิปชำระเงิน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject Reason Dialog */}
      {rejectingOrderId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-sm text-slate-800 font-display">ระบุเหตุผลการปฏิเสธสลิป</h3>
            <textarea 
              rows={3}
              placeholder="เช่น ยอดเงินโอนไม่ตรงตามจริง, รูปสลิปมองไม่ชัด..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setRejectingOrderId(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                onClick={() => handleReview(rejectingOrderId, "reject")}
                disabled={isSubmittingReview}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Slip Full Preview */}
      {showSlipPreviewModal && (
        <div 
          onClick={() => setShowSlipPreviewModal(null)}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in cursor-pointer"
        >
          <div className="bg-white rounded-3xl p-4 max-w-md w-full shadow-2xl relative space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-xs text-slate-700">รูปภาพสลิปชำระเงิน</span>
              <button onClick={() => setShowSlipPreviewModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <img 
              src={showSlipPreviewModal} 
              alt="Slip Full Preview" 
              className="max-h-[70vh] w-full object-contain rounded-2xl border border-slate-200" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
