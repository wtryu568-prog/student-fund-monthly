/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign, 
  Bell, 
  ArrowUpRight, 
  ArrowDownRight, 
  Award, 
  ShoppingBag,
  Inbox,
  User as UserIcon
} from "lucide-react";
import { User, Transaction, Announcement, MonthlyBill, Notification, SystemSettings } from "../types";

interface DashboardProps {
  currentUser: User;
  users: User[];
  transactions: Transaction[];
  announcements: Announcement[];
  monthlyBills: MonthlyBill[];
  settings: SystemSettings;
  setTab: (tab: string) => void;
  notifications?: Notification[];
  onMarkNotificationsRead?: (notId?: string) => Promise<void>;
}

export default function Dashboard({
  currentUser,
  users,
  transactions,
  announcements,
  monthlyBills,
  settings,
  setTab,
  notifications = [],
  onMarkNotificationsRead
}: DashboardProps) {
  // Financial calculations
  const totalBalance = transactions.reduce((sum, tx) => sum + (tx.type === "income" ? tx.amount : -tx.amount), 0);
  const totalIncome = transactions.filter(tx => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);

  // Bill calculations for current month (dynamically detect latest cycle, fallback to June 2569)
  let currentMonth = 6;
  let currentYear = 2569;

  if (monthlyBills && monthlyBills.length > 0) {
    const sortedBills = [...monthlyBills].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });
    currentMonth = sortedBills[0].month;
    currentYear = sortedBills[0].year;
  }

  const getThaiMonthName = (m: number) => {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return months[m - 1] || "มิถุนายน";
  };

  const currentBills = monthlyBills.filter(b => b.month === currentMonth && b.year === currentYear);
  const totalPaidCount = currentBills.filter(b => b.status === "paid").length;
  const pendingReviewCount = currentBills.filter(b => b.status === "pending_review").length;
  const unpaidCount = currentBills.filter(b => b.status === "pending").length;
  const payPercentage = currentBills.length > 0 ? Math.round((totalPaidCount / currentBills.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header section with notification banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
          <DollarSign size={240} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <span className="bg-white/20 text-white font-medium text-[10px] sm:text-xs px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full backdrop-blur-md uppercase tracking-wider mb-2 sm:mb-3 inline-block">
            {settings.fundName || "เงินเก็บรุ่น06"}
          </span>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold font-sans tracking-tight mb-2">
            สวัสดีค่ะ คุณ{currentUser.fullName} ({currentUser.nickname})
          </h1>
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2.5">
            <button 
              id="dashboard_pay_now_btn"
              onClick={() => setTab("monthly")} 
              className="w-full sm:w-auto bg-white text-blue-700 hover:bg-blue-50 transition-all font-bold rounded-xl text-xs sm:text-sm px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-center gap-2 shadow-lg animate-pulse"
            >
              <DollarSign size={15} />ชำระเงินรายเดือน
            </button>
            <button 
              id="dashboard_view_profile_btn"
              onClick={() => setTab("profile")} 
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border border-white/15 hover:border-white/30 transition-all font-bold rounded-xl text-xs sm:text-sm px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              <UserIcon size={15} />ข้อมูลส่วนตัว & แก้ไขข้อมูล ✏️
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Fund Balance */}
        <div className="col-span-2 sm:col-span-1 bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-slate-500 font-medium text-xs sm:text-sm">ยอดเงินกองทุนรวม</span>
            <div className="bg-blue-50 text-blue-600 p-2 sm:p-2.5 rounded-xl">
              <DollarSign size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight font-display break-all">
              ฿{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium">รวมยอดเงินทุกช่องทาง</p>
          </div>
        </div>

        {/* Card 2: Income */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-slate-500 font-medium text-xs sm:text-sm truncate">รายรับทั้งหมด</span>
            <div className="bg-emerald-50 text-emerald-600 p-2 sm:p-2.5 rounded-xl shrink-0">
              <ArrowUpRight size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <h3 className="text-base sm:text-2xl font-bold text-emerald-600 tracking-tight font-display truncate">
              ฿{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] sm:text-xs text-emerald-500 font-semibold flex items-center gap-0.5 truncate">
              <TrendingUp size={10} className="sm:w-3 sm:h-3" /> ยอดเงินเข้าบัญชี
            </p>
          </div>
        </div>

        {/* Card 3: Expense */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-slate-500 font-medium text-xs sm:text-sm truncate">รายจ่ายทั้งหมด</span>
            <div className="bg-rose-50 text-rose-600 p-2 sm:p-2.5 rounded-xl shrink-0">
              <ArrowDownRight size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <h3 className="text-base sm:text-2xl font-bold text-rose-600 tracking-tight font-display truncate">
              ฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] sm:text-xs text-rose-400 font-medium truncate">เพื่อกิจกรรมหลัก</p>
          </div>
        </div>

        {/* Card 4: Member Counts */}
        <div className="col-span-2 sm:col-span-1 bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-slate-500 font-medium text-xs sm:text-sm">จำนวนสมาชิก</span>
            <div className="bg-purple-50 text-purple-600 p-2 sm:p-2.5 rounded-xl">
              <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight font-display">
              {users.length} คน
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium">72 คนในระบบคลาวด์</p>
          </div>
        </div>
      </div>

      {/* Progress & Quick Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Progress of current month bills */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-sans">ความคืบหน้าการชำระเงินเดือนนี้</h2>
              <p className="text-xs text-slate-400 font-sans">รอบเดือน {getThaiMonthName(currentMonth)} {currentYear} (ยอดจ่ายคนละ {settings.monthlyFee} บาท)</p>
            </div>
            <span className="text-blue-600 bg-blue-50 text-xs font-bold px-3 py-1 rounded-full">
              {payPercentage}% ของทั้งหมด
            </span>
          </div>

          <div className="relative pt-1">
            <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-100">
              <div style={{ width: `${payPercentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"></div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-50/50">
                <span className="block text-xl font-bold text-blue-600 font-display">{totalPaidCount}</span>
                <span className="text-xs text-slate-500 font-semibold font-sans">ชำระเรียบร้อย</span>
              </div>
              <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-50/50">
                <span className="block text-xl font-bold text-amber-600 font-display">{pendingReviewCount}</span>
                <span className="text-xs text-slate-500 font-semibold font-sans">รอตรวจสอบสลิป</span>
              </div>
              <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-50/50">
                <span className="block text-xl font-bold text-rose-600 font-display">{unpaidCount}</span>
                <span className="text-xs text-slate-500 font-semibold font-sans">ค้างชำระเงิน</span>
              </div>
            </div>
          </div>

          {/* Quick instructions block */}
          <div className="bg-slate-50 rounded-2xl p-4 flex gap-3 items-start">
            <Award className="text-blue-500 mt-1 shrink-0" size={20} />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-700">คำชี้แจงความโปร่งใสทางการเงิน</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                ทุกครั้งที่สมาชิกทำการชำระเงินและแนบสลิปผ่านทางระบบ เหรัญญิกจะมีหน้าที่ในการตรวจสอบยอดเงินและรายการที่เกิดขึ้นจริง 
                และระบบจะออกเลขใบเสร็จพร้อมลงบันทึกเป็นรายรับทันที รายการการเงินจะไม่ผ่านการจำลอง มีความน่าเชื่อถือ ตรวจสอบสลิปได้อย่างมั่นใจ
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Announcements */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800">
              <Bell size={18} className="text-blue-600" />
              <h2 className="text-base font-bold">บอร์ดประกาศข่าวกองทุน</h2>
            </div>
            <button 
              id="dashboard_view_all_ann_btn"
              onClick={() => setTab("monthly")} 
              className="text-xs text-blue-500 hover:underline font-semibold"
            >
              ดูทั้งหมด
            </button>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[250px] pr-1">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl transition-all border border-slate-100/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    ann.priority === "urgent" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {ann.priority === "urgent" ? "ด่วนที่สุด" : "ทั่วไป"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(ann.createdAt).toLocaleDateString("th-TH")}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-700 line-clamp-1">{ann.title}</h4>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Smart Reminder / Private Chat Notification Inbox */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Inbox size={20} className="text-amber-500" />
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                กล่องข้อความทวงถามส่วนบุคคล (Smart Reminder Box)
                {notifications.filter(n => n.userId === currentUser.id && !n.isRead).length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                    ใหม่ {notifications.filter(n => n.userId === currentUser.id && !n.isRead).length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">การแจ้งเตือนสไตล์เมนบอร์ด (In-app notification) ทวงถามแบบระบุตัวตน เจาะจงเฉพาะตัวคุณ เพื่อความปลอดภัยและความเป็นส่วนตัว</p>
            </div>
          </div>
          {notifications.filter(n => n.userId === currentUser.id && !n.isRead).length > 0 && onMarkNotificationsRead && (
            <button
              onClick={() => onMarkNotificationsRead()}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all self-start sm:self-auto"
            >
              ทำเครื่องหมายว่าอ่านแล้วทั้งหมด ✓
            </button>
          )}
        </div>

        {notifications.filter(n => n.userId === currentUser.id).length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100 text-slate-400 text-xs font-sans">
            🎉 ยินดีด้วย! คุณไม่มีรายการแจ้งเตือนค้างชำระหรือข้อความทวงถามส่วนบุคคลในขณะนี้
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
            {notifications.filter(n => n.userId === currentUser.id).map((not) => (
              <div 
                key={not.id} 
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !not.isRead 
                    ? "bg-amber-50/50 border-amber-100 shadow-sm" 
                    : "bg-slate-50/30 border-slate-100 opacity-75"
                }`}
              >
                <div className="space-y-2 max-w-xl flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      !not.isRead ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {!not.isRead ? "ยังไม่ได้อ่าน" : "อ่านแล้ว"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(not.createdAt).toLocaleString("th-TH")}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {not.title}
                  </h4>
                  <div className="text-xs text-slate-600 font-sans leading-relaxed bg-white/70 p-3 rounded-xl border border-slate-100/80 shadow-inner">
                    {not.message}
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => setTab("monthly")}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all text-center flex items-center justify-center gap-1 shadow-sm shadow-blue-500/10"
                  >
                    <DollarSign size={13} /> ไปหน้าชำระเงิน
                  </button>
                  {!not.isRead && onMarkNotificationsRead && (
                    <button
                      onClick={() => onMarkNotificationsRead(not.id)}
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition-all text-center"
                    >
                      รับทราบแล้ว ✓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
