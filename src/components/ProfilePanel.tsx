/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  User as UserIcon, 
  Facebook, 
  Phone, 
  Users, 
  Award, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Save,
  Check,
  CreditCard,
  History
} from "lucide-react";
import { User, MonthlyBill, Payment } from "../types";

interface ProfilePanelProps {
  currentUser: User;
  monthlyBills: MonthlyBill[];
  onUpdateMember: (
    targetUserId: string, 
    role?: string, 
    position?: string, 
    isActive?: boolean,
    fullName?: string,
    nickname?: string,
    email?: string,
    phone?: string,
    classroom?: string
  ) => Promise<any>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<any>;
}

export default function ProfilePanel({
  currentUser,
  monthlyBills,
  onUpdateMember,
  onChangePassword
}: ProfilePanelProps) {
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [classroom, setClassroom] = useState(currentUser.classroom || "ห้อง 1");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [email, setEmail] = useState(currentUser.email || "");

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState("");
  const [pwdErrorMsg, setPwdErrorMsg] = useState("");

  // Sync state with currentUser if currentUser changes (e.g., simulated user switches)
  useEffect(() => {
    setFullName(currentUser.fullName);
    setNickname(currentUser.nickname);
    setClassroom(currentUser.classroom || "ห้อง 1");
    setPhone(currentUser.phone || "");
    setEmail(currentUser.email || "");
    setSuccessMsg("");
    setErrorMsg("");
  }, [currentUser]);

  // Calculate bill stats for the current user
  const userBills = monthlyBills.filter(b => b.userId === currentUser.id);
  const paidCount = userBills.filter(b => b.status === "paid").length;
  const pendingCount = userBills.filter(b => b.status === "pending_review").length;
  const unpaidCount = userBills.filter(b => b.status === "pending").length;
  const totalAmountOwed = userBills.reduce((acc, curr) => acc + (curr.status !== "paid" ? curr.amount : 0), 0);

  const getThaiMonthName = (monthNum: number) => {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return months[monthNum - 1] || "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !nickname.trim()) {
      setErrorMsg("กรุณากรอกชื่อจริงและชื่อเล่นด้วยค่ะ");
      return;
    }
    
    setIsSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      await onUpdateMember(
        currentUser.id,
        undefined, // role
        undefined, // position
        undefined, // isActive
        fullName,
        nickname,
        email,
        phone,
        classroom
      );
      setSuccessMsg("อัปเดตข้อมูลส่วนตัวของคุณเรียบร้อยแล้วค่ะ! 🎉");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccessMsg("");
    setPwdErrorMsg("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwdErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่องค่ะ");
      return;
    }

    if (newPassword.length < 6) {
      setPwdErrorMsg("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษรค่ะ");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdErrorMsg("รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกันค่ะ");
      return;
    }

    setIsChangingPwd(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      setPwdSuccessMsg("เปลี่ยนรหัสผ่านสำเร็จแล้วค่ะ! 🔑");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwdErrorMsg(err.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
    } finally {
      setIsChangingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper Banner Accent */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg shadow-blue-600/10">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
          <UserIcon size={180} />
        </div>
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/10">
            👤 บัญชีผู้ใช้งานระบบกองทุน
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight">
              คุณ{currentUser.fullName} ({currentUser.nickname})
            </h2>
            <p className="text-xs md:text-sm text-blue-100 font-medium">
              ห้องเรียน: {currentUser.classroom || "ไม่ระบุ"} • รหัสนิสิต: {currentUser.studentId}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Info Edit & Payments Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Edit Form Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              ✏️ แก้ไขรายละเอียดส่วนตัว
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              เพื่อนๆ สามารถอัปเดตข้อมูลการติดต่อของตนเองได้ตลอดเวลาเพื่อให้เหรัญญิกตรวจสอบง่ายขึ้นค่ะ
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-2xl flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600">ชื่อจริง - นามสกุล</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-medium text-slate-700 transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600">ชื่อเล่น</label>
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-medium text-slate-700 transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600">
                  ห้องเรียน {currentUser.role !== "treasurer" && "🔒 (เฉพาะเหรัญญิกแก้ไขได้)"}
                </label>
                {currentUser.role !== "treasurer" ? (
                  <div className="w-full p-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl font-bold font-sans cursor-not-allowed">
                    {classroom}
                  </div>
                ) : (
                  <select 
                    value={classroom}
                    onChange={(e) => setClassroom(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-bold text-slate-700 transition-all"
                  >
                    <option value="ห้อง 1">ห้อง 1</option>
                    <option value="ห้อง 2">ห้อง 2</option>
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600">เบอร์โทรศัพท์ติดต่อ</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 0891234567"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-mono font-medium text-slate-700 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-600 flex items-center gap-1.5">
                <Facebook size={14} className="text-blue-600" /> ลิงก์ Facebook หรือช่องทางติดต่อ
              </label>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="เช่น facebook.com/username หรือ ชื่อบัญชี Facebook"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-medium text-slate-700 transition-all"
                required
              />
            </div>

            <div className="pt-2">
              <button 
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-md shadow-blue-600/15 flex items-center justify-center gap-2 text-xs"
              >
                <Save size={14} />
                {isSaving ? "กำลังบันทึกข้อมูล..." : "บันทึกข้อมูลส่วนตัว"}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              🔑 ตั้งค่ารหัสผ่านใหม่
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              เพื่อความปลอดภัยในการเข้าใช้งาน โปรดเปลี่ยนรหัสผ่านสแตนดาร์ดของคุณเป็นรหัสผ่านส่วนตัวนะคะ
            </p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
            {pwdSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" />
                <span>{pwdSuccessMsg}</span>
              </div>
            )}

            {pwdErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-2xl flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-500" />
                <span>{pwdErrorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-600">รหัสผ่านปัจจุบัน</label>
              <input 
                type="password" 
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="ป้อนรหัสผ่านปัจจุบันของคุณ (หรือ 123456 แรกเข้า)"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-mono font-medium text-slate-700 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600">รหัสผ่านใหม่</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="ต้องมีอย่างน้อย 6 ตัวอักษร"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-mono font-medium text-slate-700 transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600">ยืนยันรหัสผ่านใหม่</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="ป้อนรหัสผ่านใหม่อีกครั้ง"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-mono font-medium text-slate-700 transition-all"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit"
                disabled={isChangingPwd}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-md shadow-slate-800/15 flex items-center justify-center gap-2 text-xs"
              >
                <Save size={14} />
                {isChangingPwd ? "กำลังดำเนินการเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่านส่วนตัว"}
              </button>
            </div>
          </form>
        </div>
      </div>

        {/* Payment Summary Sidebar Column */}
        <div className="space-y-6">
          {/* Quick Statistics Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CreditCard size={15} className="text-blue-600" /> สรุปการชำระเงินของฉัน
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl text-center space-y-1">
                <p className="text-[10px] text-slate-400 font-bold">ยอดรอบบิลทั้งหมด</p>
                <p className="text-lg font-bold font-mono text-slate-700">{userBills.length} <span className="text-[10px] font-normal">เดือน</span></p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl text-center space-y-1">
                <p className="text-[10px] text-emerald-500 font-bold">ชำระเรียบร้อย</p>
                <p className="text-lg font-bold font-mono text-emerald-600">{paidCount} <span className="text-[10px] font-normal">เดือน</span></p>
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl text-center space-y-1">
                <p className="text-[10px] text-amber-500 font-bold">รอเหรัญญิกตรวจ</p>
                <p className="text-lg font-bold font-mono text-amber-600">{pendingCount} <span className="text-[10px] font-normal">เดือน</span></p>
              </div>

              <div className="p-3 bg-rose-50 rounded-2xl text-center space-y-1">
                <p className="text-[10px] text-rose-500 font-bold">ค้างชำระกองทุน</p>
                <p className="text-lg font-bold font-mono text-rose-600">{unpaidCount} <span className="text-[10px] font-normal">เดือน</span></p>
              </div>
            </div>

            {totalAmountOwed > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 flex items-center justify-between text-xs font-bold font-sans">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>ยอดค้างรวม:</span>
                </div>
                <span className="font-mono text-sm">฿{totalAmountOwed.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* System Role Badge Card */}
          <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/60 flex items-center gap-3.5 text-xs">
            <div className="bg-white p-3 rounded-2xl border border-slate-200">
              <Award size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">สิทธิ์เข้าถึงระบบของคุณ</p>
              <p className="font-bold text-slate-800 mt-0.5">
                {currentUser.role === "treasurer" 
                  ? "🔴 เหรัญญิกกองทุน (สิทธิ์แอดมินสูงสุด)" 
                  : currentUser.role === "committee" 
                    ? "⭐ คณะกรรมการรุ่น (สิทธิ์แอดมินบริหาร)" 
                    : currentUser.role === "leader"
                      ? "🎓 หัวหน้าห้องเรียน"
                      : "👥 สมาชิกทั่วไป"}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                {currentUser.role === "treasurer" 
                  ? "สามารถตรวจสอบสลิป อนุมัติเบิกจ่าย เรียกเก็บบิล และจัดการสมาชิกทั้งหมดได้ค่ะ" 
                  : currentUser.role === "committee"
                    ? "สามารถตรวจสอบสลิป ร่วมจัดการข้อมูลสมาชิก เรียกเก็บบิล และสิทธิ์ดูแลระบบส่วนกลางร่วมกับเหรัญญิกค่ะ"
                    : currentUser.role === "leader"
                      ? "สามารถบันทึกยอดเงินสดสำหรับห้องของตนเอง ติดตามยอดค้างชำระ และส่งคำแจ้งเตือนถึงเพื่อนร่วมชั้นเรียนค่ะ"
                      : "สามารถชำระเงินกองทุนประจำเดือน แนบสลิปโอนเงิน ติดตามบันทึกการเบิกจ่าย และเสนอคำร้องเรียนต่างๆ ได้ค่ะ"}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Bill History List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <History size={15} className="text-slate-500" /> ประวัติรอบบิลชำระเงินของฉัน
        </h3>

        {userBills.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            ไม่พบประวัติรอบบิลของคุณในขณะนี้ค่ะ
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userBills.map((bill) => (
              <div 
                key={bill.id} 
                className={`p-4 rounded-2xl border text-xs flex items-center justify-between transition-all ${
                  bill.status === "paid" 
                    ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/60" 
                    : bill.status === "pending_review"
                      ? "bg-amber-50/30 border-amber-100 hover:bg-amber-50/60 animate-pulse"
                      : "bg-rose-50/20 border-rose-100 hover:bg-rose-50/40"
                }`}
              >
                <div className="space-y-1">
                  <p className="font-bold text-slate-700">รอบบิลเดือน: {getThaiMonthName(bill.month)} {bill.year}</p>
                  <p className="text-[10px] text-slate-400">
                    กำหนดชำระ: <span className="font-mono">{new Date(bill.dueDate).toLocaleDateString("th-TH")}</span>
                  </p>
                </div>

                <div className="text-right space-y-1.5">
                  <p className="font-bold font-mono text-slate-800">฿{bill.amount.toLocaleString()}</p>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    bill.status === "paid" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : bill.status === "pending_review"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                  }`}>
                    {bill.status === "paid" && (
                      <>
                        <CheckCircle size={10} />
                        <span>ชำระเรียบร้อย</span>
                      </>
                    )}
                    {bill.status === "pending_review" && (
                      <>
                        <Clock size={10} />
                        <span>รอตรวจสอบสลิป</span>
                      </>
                    )}
                    {bill.status === "pending" && (
                      <>
                        <AlertCircle size={10} />
                        <span>ยังไม่ได้ชำระ</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
