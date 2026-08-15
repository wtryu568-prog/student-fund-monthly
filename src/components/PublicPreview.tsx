/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PublicPreview — Public-facing read-only summary page
 * Accessible without login via /#preview
 */

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  DollarSign,
  ShoppingBag,
  Award,
  FileText,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  LogIn,
  ChevronRight,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  BarChart3,
  PieChart,
  Megaphone,
  ExternalLink,
  RefreshCw,
  Shield,
} from "lucide-react";

// Types for the public preview data
interface PreviewData {
  settings: {
    fundName: string;
    monthlyFee: number;
  };
  memberCount: number;
  financialSummary: {
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    feeIncome: number;
    marketProfit: number;
    activityExpense: number;
  };
  billingSummary: {
    month: number;
    year: number;
    totalMembers: number;
    paidCount: number;
    pendingReviewCount: number;
    unpaidCount: number;
    amountPerPerson: number;
  };
  billingHistory: Array<{
    month: number;
    year: number;
    total: number;
    paid: number;
  }>;
  marketSummary: {
    totalWeeks: number;
    completedWeeks: number;
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
  };
  activities: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    eventDate: string | null;
    location: string;
    createdAt: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    priority: string;
    isPinned: boolean;
    createdAt: string;
  }>;
  generatedAt: string;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

function getThaiMonth(m: number) {
  return THAI_MONTHS[m - 1] || "";
}
function getThaiMonthShort(m: number) {
  return THAI_MONTHS_SHORT[m - 1] || "";
}

function getStatusLabel(status: string): { label: string; color: string; icon: React.ReactNode } {
  switch (status) {
    case "proposed": return { label: "เสนอแล้ว", color: "text-blue-600 bg-blue-50 border-blue-200", icon: <FileText size={12} /> };
    case "approved": return { label: "อนุมัติแล้ว", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: <CheckCircle size={12} /> };
    case "in_progress": return { label: "กำลังดำเนินการ", color: "text-amber-600 bg-amber-50 border-amber-200", icon: <Clock size={12} /> };
    case "completed": return { label: "เสร็จสิ้น", color: "text-emerald-700 bg-emerald-50 border-emerald-300", icon: <CheckCircle size={12} /> };
    case "rejected": return { label: "ไม่อนุมัติ", color: "text-rose-600 bg-rose-50 border-rose-200", icon: <XCircle size={12} /> };
    case "pending_settlement": return { label: "รอสรุป", color: "text-purple-600 bg-purple-50 border-purple-200", icon: <AlertCircle size={12} /> };
    default: return { label: status, color: "text-slate-600 bg-slate-50 border-slate-200", icon: <FileText size={12} /> };
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString("th-TH");
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("th-TH", {
      year: "numeric", month: "short", day: "numeric"
    });
  } catch {
    return dateStr;
  }
}

interface PublicPreviewProps {
  onGoToLogin: () => void;
}

export default function PublicPreview({ onGoToLogin }: PublicPreviewProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/preview?t=${Date.now()}`);
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลได้");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse opacity-20"></div>
            <div className="absolute inset-2 rounded-xl bg-white flex items-center justify-center shadow-lg">
              <Eye size={24} className="text-blue-600 animate-pulse" />
            </div>
          </div>
          <h2 className="text-sm font-bold text-slate-700">กำลังโหลดข้อมูลพรีวิว...</h2>
          <p className="text-[11px] text-slate-400">กรุณารอสักครู่ค่ะ</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm text-center shadow-xl border border-slate-100 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto">
            <AlertCircle size={24} className="text-rose-500" />
          </div>
          <h2 className="text-base font-bold text-slate-800">ไม่สามารถโหลดข้อมูลได้</h2>
          <p className="text-xs text-slate-500">{error || "กรุณาลองใหม่อีกครั้ง"}</p>
          <div className="flex gap-2">
            <button onClick={fetchPreview} className="flex-1 bg-blue-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5">
              <RefreshCw size={13} /> ลองใหม่
            </button>
            <button onClick={onGoToLogin} className="flex-1 bg-slate-100 text-slate-600 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5">
              <LogIn size={13} /> เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { settings, memberCount, financialSummary, billingSummary, billingHistory, marketSummary, activities, announcements } = data;
  const payPercentage = billingSummary.totalMembers > 0 ? Math.round((billingSummary.paidCount / billingSummary.totalMembers) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 font-sans">

      {/* ═══════════════════════ Top Bar ═══════════════════════ */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white border border-slate-200 shadow-md shadow-purple-950/10 shrink-0 flex items-center justify-center p-0.5">
              <img src="/logo.svg" alt="TNS Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight leading-none">{settings.fundName}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">หน้าดูข้อมูลสาธารณะ</span>
                <span className="text-[8px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Eye size={8} /> เปิดให้ทุกคนดูได้
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onGoToLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] sm:text-xs px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-95"
          >
            <LogIn size={13} />
            <span className="hidden sm:inline">เข้าสู่ระบบเพื่อจัดการ</span>
            <span className="sm:hidden">เข้าสู่ระบบ</span>
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-24">

        {/* ═══════════════════════ Hero Banner ═══════════════════════ */}
        <section className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 text-white shadow-2xl shadow-blue-900/20 overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-xl"></div>
          <div className="absolute right-4 bottom-4 opacity-[0.07]">
            <DollarSign size={180} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-white/15 backdrop-blur-md text-white font-bold text-[10px] sm:text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} /> ข้อมูลสดจากระบบจริง
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
              {settings.fundName}
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm max-w-lg leading-relaxed">
              หน้าพรีวิวข้อมูลสรุปกองทุนสำหรับผู้เยี่ยมชม — ครู นักเรียน และผู้ปกครองสามารถดูข้อมูลภาพรวมได้ทันที
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Users size={16} className="text-blue-200" />
                <div>
                  <p className="text-[9px] text-blue-200 uppercase tracking-wider font-bold">สมาชิก</p>
                  <p className="text-lg font-extrabold">{memberCount} คน</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 flex items-center gap-2">
                <DollarSign size={16} className="text-blue-200" />
                <div>
                  <p className="text-[9px] text-blue-200 uppercase tracking-wider font-bold">ค่ารายเดือน</p>
                  <p className="text-lg font-extrabold">฿{formatNumber(settings.monthlyFee)}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-300" />
                <div>
                  <p className="text-[9px] text-blue-200 uppercase tracking-wider font-bold">ยอดคงเหลือ</p>
                  <p className="text-lg font-extrabold text-emerald-300">฿{formatNumber(financialSummary.totalBalance)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Pinned Announcements ═══════════════════════ */}
        {announcements.length > 0 && (
          <section className="space-y-3">
            {announcements.filter(a => a.isPinned || a.priority === "urgent").map(ann => (
              <div
                key={ann.id}
                className={`rounded-2xl p-4 sm:p-5 border shadow-sm ${
                  ann.priority === "urgent"
                    ? "bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200"
                    : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    ann.priority === "urgent" ? "bg-rose-500 text-white" : "bg-blue-500 text-white"
                  }`}>
                    <Megaphone size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-800">{ann.title}</h4>
                      {ann.priority === "urgent" && (
                        <span className="text-[9px] bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full">ด่วน</span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed line-clamp-3">{ann.content}</p>
                    <p className="text-[9px] text-slate-400 mt-1.5 font-bold">{formatDate(ann.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ═══════════════════════ Financial Overview Cards ═══════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <BarChart3 size={14} className="text-emerald-600" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800">สรุปการเงินภาพรวม</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Balance */}
            <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/15 relative overflow-hidden group hover:shadow-emerald-500/25 transition-shadow">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition-transform">
                <DollarSign size={80} />
              </div>
              <p className="text-[10px] text-emerald-100 uppercase tracking-wider font-bold flex items-center gap-1"><TrendingUp size={11} /> ยอดคงเหลือรวม</p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-1.5">฿{formatNumber(financialSummary.totalBalance)}</p>
              <p className="text-[10px] text-emerald-200 mt-1">ข้อมูล ณ วันที่ {formatDate(data.generatedAt)}</p>
            </div>

            {/* Income */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">รายรับทั้งหมด</p>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ArrowUpRight size={14} className="text-emerald-500" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-600">฿{formatNumber(financialSummary.totalIncome)}</p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">ค่าบำรุงกองทุน</span>
                  <span className="font-bold text-slate-600">฿{formatNumber(financialSummary.feeIncome)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">กำไรตลาดพุธ</span>
                  <span className="font-bold text-slate-600">฿{formatNumber(financialSummary.marketProfit)}</span>
                </div>
              </div>
            </div>

            {/* Expense */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">รายจ่ายทั้งหมด</p>
                <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ArrowDownRight size={14} className="text-rose-500" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-rose-600">฿{formatNumber(financialSummary.totalExpense)}</p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">ค่าโครงการ/กิจกรรม</span>
                  <span className="font-bold text-slate-600">฿{formatNumber(financialSummary.activityExpense)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Billing Status ═══════════════════════ */}
        {billingSummary.totalMembers > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign size={14} className="text-blue-600" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800">สถิติชำระเงินรายเดือน</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Current cycle header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-blue-100 uppercase tracking-wider font-bold">รอบบิลปัจจุบัน</p>
                    <p className="text-lg font-extrabold mt-0.5">{getThaiMonth(billingSummary.month)} {billingSummary.year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold">{payPercentage}%</p>
                    <p className="text-[10px] text-blue-200 font-bold">ชำระแล้ว</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 bg-white/20 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${payPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                <div className="p-4 text-center">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-1.5">
                    <CheckCircle size={16} className="text-emerald-500" />
                  </div>
                  <p className="text-xl font-extrabold text-emerald-600">{billingSummary.paidCount}</p>
                  <p className="text-[10px] text-slate-400 font-bold">ชำระแล้ว</p>
                </div>
                <div className="p-4 text-center">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-1.5">
                    <Clock size={16} className="text-amber-500" />
                  </div>
                  <p className="text-xl font-extrabold text-amber-600">{billingSummary.pendingReviewCount}</p>
                  <p className="text-[10px] text-slate-400 font-bold">รอตรวจสอบ</p>
                </div>
                <div className="p-4 text-center">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-1.5">
                    <AlertCircle size={16} className="text-rose-500" />
                  </div>
                  <p className="text-xl font-extrabold text-rose-600">{billingSummary.unpaidCount}</p>
                  <p className="text-[10px] text-slate-400 font-bold">ยังไม่ชำระ</p>
                </div>
              </div>

              {/* Billing history mini chart */}
              {billingHistory.length > 1 && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-3">ประวัติการชำระ (ย้อนหลัง)</p>
                  <div className="flex items-end gap-2 h-20">
                    {[...billingHistory].reverse().map((cycle, i) => {
                      const pct = cycle.total > 0 ? (cycle.paid / cycle.total) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden" style={{ height: "60px" }}>
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-700 ease-out"
                              style={{ height: `${pct}%` }}
                            ></div>
                          </div>
                          <span className="text-[8px] text-slate-400 font-bold">{getThaiMonthShort(cycle.month)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══════════════════════ Market Summary ═══════════════════════ */}
        {marketSummary.totalWeeks > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                <ShoppingBag size={14} className="text-orange-600" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800">สรุปตลาดวันพุธ</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-3.5 border border-orange-100">
                  <p className="text-[10px] text-orange-500 uppercase tracking-wider font-bold">จำนวนสัปดาห์</p>
                  <p className="text-2xl font-extrabold text-orange-700 mt-1">{marketSummary.totalWeeks}</p>
                  <p className="text-[10px] text-orange-400 mt-0.5">{marketSummary.completedWeeks} สัปดาห์เสร็จสิ้น</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3.5 border border-emerald-100">
                  <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold">กำไรรวม</p>
                  <p className="text-2xl font-extrabold text-emerald-700 mt-1">฿{formatNumber(marketSummary.totalProfit)}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3.5 border border-blue-100">
                  <p className="text-[10px] text-blue-500 uppercase tracking-wider font-bold">รายได้รวม</p>
                  <p className="text-2xl font-extrabold text-blue-700 mt-1">฿{formatNumber(marketSummary.totalRevenue)}</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-3.5 border border-slate-100">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">ต้นทุนรวม</p>
                  <p className="text-2xl font-extrabold text-slate-700 mt-1">฿{formatNumber(marketSummary.totalCost)}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ Activities ═══════════════════════ */}
        {activities.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Award size={14} className="text-purple-600" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800">โครงการ / กิจกรรม</h3>
              <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                {activities.length} โครงการ
              </span>
            </div>

            <div className="space-y-3">
              {activities.map(act => {
                const statusInfo = getStatusLabel(act.status);
                return (
                  <div
                    key={act.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-500/10 group-hover:scale-105 transition-transform">
                        <Award size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-800">{act.title}</h4>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusInfo.color}`}>
                            {statusInfo.icon} {statusInfo.label}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2">{act.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                          {act.eventDate && (
                            <span className="flex items-center gap-1 font-bold">
                              <Calendar size={10} /> {formatDate(act.eventDate)}
                            </span>
                          )}
                          {act.location && (
                            <span className="flex items-center gap-1 font-bold">
                              <MapPin size={10} /> {act.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════ All Announcements ═══════════════════════ */}
        {announcements.filter(a => !a.isPinned && a.priority !== "urgent").length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Bell size={14} className="text-amber-600" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800">ประกาศทั่วไป</h3>
            </div>

            <div className="space-y-3">
              {announcements.filter(a => !a.isPinned && a.priority !== "urgent").map(ann => (
                <div key={ann.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 mb-1">{ann.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{ann.content}</p>
                  <p className="text-[9px] text-slate-400 mt-2 font-bold">{formatDate(ann.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ CTA Footer ═══════════════════════ */}
        <section className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-4 left-8"><Sparkles size={20} /></div>
            <div className="absolute top-12 right-12"><DollarSign size={30} /></div>
            <div className="absolute bottom-6 left-1/4"><Award size={25} /></div>
            <div className="absolute bottom-4 right-8"><ShoppingBag size={22} /></div>
          </div>

          <div className="relative z-10 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-4">
              <Shield size={24} className="text-blue-300" />
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold mb-2">ต้องการจัดการข้อมูล?</h3>
            <p className="text-slate-400 text-xs sm:text-sm mb-5 leading-relaxed">
              หากคุณเป็นสมาชิกกองทุนและต้องการชำระเงิน แก้ไขข้อมูล หรือจัดการระบบ กรุณาเข้าสู่ระบบด้วยรหัสนักศึกษาค่ะ
            </p>
            <button
              onClick={onGoToLogin}
              className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm px-6 py-3 sm:px-8 sm:py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-95 flex items-center gap-2 mx-auto"
            >
              <LogIn size={16} /> เข้าสู่ระบบด้วยรหัสนักศึกษา
              <ChevronRight size={14} />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-[10px] text-slate-400 space-y-1 pb-4">
          <p className="font-bold">หน้าพรีวิวสาธารณะ — {settings.fundName}</p>
          <p>ข้อมูลที่แสดงเป็นข้อมูลสรุปภาพรวมเท่านั้น ไม่เปิดเผยข้อมูลส่วนบุคคลใดๆ ค่ะ</p>
          <p className="text-slate-300">อัปเดตล่าสุด: {new Date(data.generatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
        </footer>
      </div>
    </div>
  );
}
