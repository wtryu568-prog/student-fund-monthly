import React, { useState } from "react";
import { Lock, AlertCircle, KeyRound, User as UserIcon, RefreshCw, ChevronLeft, CheckCircle2, Mail, Sparkles, Eye } from "lucide-react";
import { User } from "../types";
import { safeParseJson } from "../App";

interface LoginViewProps {
  users: User[];
  onLogin: (studentId: string, passwordStr: string) => Promise<User>;
  onDirectLogin?: (user: User) => void;
  onBackToPreview?: () => void;
}

export default function LoginView({ users, onLogin, onDirectLogin, onBackToPreview }: LoginViewProps) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Email login tab states
  const [activeTab, setActiveTab] = useState<"password" | "email">("password");
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // Forgot password flow states
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStudentId, setForgotStudentId] = useState("");
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string | null>(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !password) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await onLogin(studentId, password);
    } catch (err: any) {
      setError(err.message || "รหัสท้ายนักศึกษาหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      setEmailError("กรุณากรอกอีเมลมหาลัยของท่านค่ะ");
      return;
    }

    setEmailError(null);
    setIsEmailLoading(true);
    try {
      const res = await fetch("/api/auth/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput })
      });
      const data = await safeParseJson(res);
      if (data.error) {
        throw new Error(String(data.error));
      }
      if (!res.ok) {
        throw new Error(String(data.error || "ไม่สามารถเข้าสู่ระบบด้วยอีเมลนี้ได้"));
      }
      if (onDirectLogin) {
        onDirectLogin(data.user as User);
      }
    } catch (err: any) {
      setEmailError(err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วยอีเมล");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccessMsg(null);
    setForgotErrorMsg(null);

    if (!forgotStudentId) {
      setForgotErrorMsg("กรุณาระบุเลข 3 ตัวท้ายของรหัสนักศึกษา หรือรหัสเต็มค่ะ");
      return;
    }

    setIsSendingForgot(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: forgotStudentId })
      });
      const data = await safeParseJson(res);
      if (data.error) {
        throw new Error(String(data.error));
      }
      if (!res.ok) {
        throw new Error(String(data.error || "ไม่สามารถทำรายการได้"));
      }
      setForgotSuccessMsg(String(data.message || "ส่งคำขอรีเซ็ตรหัสผ่านสำเร็จเรียบร้อยแล้วค่ะ!"));
      setForgotStudentId("");
    } catch (err: any) {
      setForgotErrorMsg(err.message || "เกิดข้อผิดพลาด กรุณาตรวจสอบรหัสนักศึกษาอีกครั้งนะคะ");
    } finally {
      setIsSendingForgot(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col justify-center items-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-xl space-y-7">
        
        {!isForgotMode ? (
          <>
            {/* Portal Header */}
            <div className="text-center space-y-2.5">
              <div className="mx-auto w-20 h-20 rounded-full p-1 bg-white border border-slate-100 shadow-xl shadow-purple-950/10 flex items-center justify-center overflow-hidden">
                <img src="/logo.svg" alt="TNS Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">เข้าสู่ระบบกองทุนห้อง</h1>
                <p className="text-xs text-slate-400 font-medium mt-1 font-sans">ระบบบริหารสวัสดิการและการเงินโปร่งใส ชั้นปีที่ 3</p>
              </div>
            </div>

            {/* Login Tab Selectors */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("password");
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "password"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <KeyRound size={13} />
                ใช้รหัสผ่าน
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("email");
                  setEmailError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "email"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Mail size={13} />
                อีเมลมหาลัย ⚡
              </button>
            </div>

            {activeTab === "password" ? (
              <>
                {/* Error Message Alert */}
                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
                    <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                    <div>
                      <span className="font-bold block text-rose-800">เข้าสู่ระบบไม่สำเร็จ</span>
                      {error}
                    </div>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleFormSubmit} className="space-y-4.5 text-xs">
                  
                  {/* Student ID (3 digits) Input */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-600 flex items-center gap-1.5">
                      <UserIcon size={13} className="text-slate-400" />
                      <span>เลข 3 ตัวท้ายของรหัสนักศึกษา <span className="text-[10px] text-slate-400 font-normal">(หรือป้อนรหัสเต็ม 12 หลัก)</span></span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="เช่น 002 หรือ 169214210002"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="w-full p-3.5 pl-11 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-xs font-bold transition-all"
                        required
                      />
                      <span className="absolute left-4 top-4 text-slate-400 text-xs">ID</span>
                    </div>
                  </div>

                  {/* Standard Password Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-slate-600 flex items-center gap-1.5">
                        <KeyRound size={13} className="text-slate-400" />
                        <span>รหัสผ่าน <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded">(เริ่มต้น 123456)</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotMode(true);
                          setForgotSuccessMsg(null);
                          setForgotErrorMsg(null);
                          setForgotStudentId("");
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-bold hover:underline transition-all"
                      >
                        ลืมรหัสผ่าน? 🔑
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="เริ่มแรกป้อน 123456"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3.5 pl-11 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-xs font-bold transition-all"
                        required
                      />
                      <span className="absolute left-4 top-4 text-slate-400 text-xs">PW</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/15 text-xs flex items-center justify-center gap-2 mt-2 disabled:bg-blue-400"
                  >
                    {isLoading ? "กำลังตรวจสอบข้อมูล..." : "เข้าสู่ระบบอย่างปลอดภัย ➜"}
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* Email Login Feedback */}
                {emailError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
                    <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                    <div>
                      <span className="font-bold block text-rose-800">เข้าสู่ระบบด้วยอีเมลไม่ได้</span>
                      {emailError}
                    </div>
                  </div>
                )}

                {/* Email Passwordless Form */}
                <form onSubmit={handleEmailFormSubmit} className="space-y-4.5 text-xs">
                  <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl text-[11px] text-amber-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Sparkles size={13} className="text-amber-500 shrink-0" />
                      <span>เข้าสู่ระบบด่วนโดยไม่ต้องใช้รหัสผ่าน!</span>
                    </div>
                    <p className="text-slate-500 font-medium leading-relaxed">
                      เพียงระบุอีเมลมหาลัยที่เคยบันทึกไว้ในโปรไฟล์ของท่าน (เช่น อีเมล @rmutsvmail.com หรืออีเมลอื่นที่ท่านระบุไว้) ก็เข้าใช้งานได้ทันทีค่ะ
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-600 flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" />
                      <span>ป้อนอีเมลมหาลัยของท่าน</span>
                    </label>
                    <input
                      type="email"
                      placeholder="เช่น user@rmutsvmail.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full p-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-xs font-bold transition-all"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isEmailLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/15 text-xs flex items-center justify-center gap-2 mt-2 disabled:bg-emerald-400"
                  >
                    {isEmailLoading ? "กำลังตรวจสอบอีเมล..." : "เข้าสู่ระบบด่วน ⚡"}
                  </button>
                </form>
              </>
            )}

            {/* Friendly Guidance Footer */}
            <div className="pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400 space-y-2">
              <p>🔒 ระบบรักษาความปลอดภัยข้อมูลส่วนบุคคลและข้อมูลการเงิน</p>
              <p>หากลืมรหัสผ่านหรือไม่มีอีเมลมหาลัย สามารถติดต่อเหรัญญิกเพื่อขอรีเซ็ตรหัสผ่านกลับเป็นสแตนดาร์ด "123456" ได้เสมอนะคะ</p>
              {onBackToPreview && (
                <button
                  type="button"
                  onClick={onBackToPreview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 text-indigo-600 font-bold text-[11px] rounded-xl hover:from-indigo-100 hover:to-blue-100 transition-all mt-1"
                >
                  <Eye size={12} /> กลับไปหน้าดูข้อมูลสรุปกองทุน
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Forgot Password Header */}
            <div className="text-center space-y-2.5 animate-in fade-in zoom-in duration-200">
              <div className="mx-auto w-16 h-16 bg-amber-500 rounded-[1.5rem] text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                <RefreshCw size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">กู้คืนรหัสผ่านเริ่มต้น</h1>
                <p className="text-xs text-slate-400 font-medium mt-1">ส่งคำขอรีเซ็ตรหัสผ่านกลับเป็นสแตนดาร์ด "123456"</p>
              </div>
            </div>

            {/* Success Msg */}
            {forgotSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-700 animate-in fade-in duration-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500 mt-0.5" />
                  <div>
                    <span className="font-bold block text-emerald-800">ส่งคำขอสำเร็จแล้วค่ะ!</span>
                    {forgotSuccessMsg}
                  </div>
                </div>
              </div>
            )}

            {/* Error Msg */}
            {forgotErrorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
                <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <span className="font-bold block text-rose-800">ทำรายการไม่สำเร็จ</span>
                  {forgotErrorMsg}
                </div>
              </div>
            )}

            {/* Forgot Form */}
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4.5 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600 flex items-center gap-1.5">
                  <UserIcon size={13} className="text-slate-400" />
                  <span>ป้อนเลขท้ายนักศึกษาของคุณเพื่อกู้คืนรหัสผ่าน</span>
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="ป้อนรหัส 3 ตัวท้าย (เช่น 002) หรือรหัสเต็ม"
                  value={forgotStudentId}
                  onChange={(e) => setForgotStudentId(e.target.value)}
                  className="w-full p-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-xs font-bold transition-all"
                  required
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSendingForgot}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/15 text-xs flex items-center justify-center gap-2"
                >
                  {isSendingForgot ? "กำลังส่งคำขอรีเซ็ต..." : "ส่งคำขอรีเซ็ตเป็น 123456"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsForgotMode(false)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-bold py-3.5 rounded-xl transition-all hover:bg-slate-100 text-xs flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft size={14} />
                  <span>ย้อนกลับไปหน้าเข้าสู่ระบบ</span>
                </button>
              </div>
            </form>

            <div className="pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
              💡 ระบบจะส่งแจ้งเตือนและส่งคำขอไปยังหน้าแผงควบคุมของเหรัญญิก เมื่อเหรัญญิกกดอนุมัติ รหัสผ่านของเพื่อนจะถูกเซ็ตกลับเป็น "123456" ค่ะ
            </div>
          </>
        )}
      </div>
    </div>
  );
}
