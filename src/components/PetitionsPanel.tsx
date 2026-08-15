/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Inbox, 
  Send, 
  HelpCircle, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  User as UserIcon, 
  UserX,
  FileText,
  Plus,
  X,
  CornerDownRight
} from "lucide-react";
import { User, Notification } from "../types";

export interface Petition {
  id: string;
  title: string;
  category: "extension" | "suggestion" | "system" | "other" | string;
  content: string;
  status: "pending" | "investigating" | "resolved" | "rejected" | string;
  isAnonymous: boolean;
  submittedBy: string;
  response?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface PetitionsPanelProps {
  currentUser: User;
  users: User[];
  petitions: Petition[];
  onSubmitPetition: (title: string, category: string, content: string, isAnonymous: boolean) => Promise<any>;
  onRespondPetition: (petitionId: string, status: string, response: string) => Promise<any>;
}

export default function PetitionsPanel({
  currentUser,
  users,
  petitions = [],
  onSubmitPetition,
  onRespondPetition
}: PetitionsPanelProps) {
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Submit Form States
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("extension");
  const [content, setContent] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Respond Form States
  const [respondingToId, setRespondingToId] = useState<string | null>(null);
  const [adminResponse, setAdminResponse] = useState<string>("");
  const [adminStatus, setAdminStatus] = useState<string>("resolved");
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [respondError, setRespondError] = useState<string | null>(null);

  const isTreasurer = currentUser.role === "treasurer";
  const isCommittee = false;
  const canRespond = isTreasurer;

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "extension": return "ขอผ่อนผันการชำระเงิน";
      case "suggestion": return "ข้อเสนอแนะเกี่ยวกับกิจกรรม";
      case "system": return "แจ้งปัญหาการใช้งานระบบ";
      default: return "เรื่องอื่นๆ";
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case "extension": return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case "suggestion": return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "system": return "bg-indigo-50 text-indigo-700 border border-indigo-200/50";
      default: return "bg-slate-50 text-slate-700 border border-slate-200/50";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
        return (
          <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-100">
            <CheckCircle size={10} /> ดำเนินการแล้ว
          </span>
        );
      case "investigating":
        return (
          <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] px-2.5 py-1 rounded-full border border-indigo-100">
            <Clock size={10} /> กำลังตรวจสอบ
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1.5 bg-rose-50 text-rose-700 font-bold text-[10px] px-2.5 py-1 rounded-full border border-rose-100">
            <AlertCircle size={10} /> ปฏิเสธคำร้อง
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 bg-slate-100 text-slate-600 font-bold text-[10px] px-2.5 py-1 rounded-full border border-slate-200/50">
            <HelpCircle size={10} /> รอรับเรื่อง
          </span>
        );
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.fullName} (${user.nickname})` : "ไม่พบชื่อผู้ใช้";
  };

  const handleCreatePetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setSubmitError("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่องด้วยค่ะ");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await onSubmitPetition(title, category, content, isAnonymous);
      
      // Reset Form
      setTitle("");
      setCategory("extension");
      setContent("");
      setIsAnonymous(false);
      setShowSubmitModal(false);
      alert("ยื่นคำร้องหรือข้อเสนอแนะสำเร็จเรียบร้อยแล้วค่ะ");
    } catch (err: any) {
      setSubmitError(err.message || "เกิดข้อผิดพลาดในการยื่นคำร้อง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingToId) return;
    if (!adminResponse.trim()) {
      setRespondError("กรุณากรอกรายละเอียดการตอบกลับด้วยค่ะ");
      return;
    }

    try {
      setIsResponding(true);
      setRespondError(null);
      await onRespondPetition(respondingToId, adminStatus, adminResponse);
      
      setRespondingToId(null);
      setAdminResponse("");
      setAdminStatus("resolved");
      alert("บันทึกการตอบกลับคำร้องเสร็จสิ้นเรียบร้อยแล้วค่ะ");
    } catch (err: any) {
      setRespondError(err.message || "เกิดข้อผิดพลาดในการบันทึกการตอบกลับ");
    } finally {
      setIsResponding(false);
    }
  };

  // Filtered lists
  const filteredPetitions = petitions.filter(p => {
    const matchesCat = filterCategory === "all" || p.category === filterCategory;
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    return matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Upper header action board */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Inbox className="text-blue-600" size={24} /> ระบบคำร้อง & ข้อเสนอแนะส่วนกลาง
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            พื้นที่โปร่งใสสำหรับยื่นคำขอผ่อนผันค่าบำรุงห้อง เสนอแนะหัวข้อกิจกรรม หรือแจ้งปัญหาการคลังในรุ่น
          </p>
        </div>
        <button
          onClick={() => {
            setSubmitError(null);
            setShowSubmitModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-3 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-blue-500/15 shrink-0 self-start md:self-auto"
        >
          <Plus size={16} /> เขียนคำร้อง / ข้อเสนอแนะใหม่
        </button>
      </div>

      {/* Filter and control row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">ตัวกรอง:</span>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">ทุกหมวดหมู่การร้องเรียน</option>
          <option value="extension">ขอผ่อนผันค่าบำรุงเงิน</option>
          <option value="suggestion">ข้อเสนอแนะกิจกรรม</option>
          <option value="system">แจ้งปัญหาการใช้งาน</option>
          <option value="other">เรื่องอื่นๆ</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">ทุกสถานะคำร้อง</option>
          <option value="pending">รอรับเรื่อง</option>
          <option value="investigating">กำลังตรวจสอบ</option>
          <option value="resolved">ดำเนินการเสร็จสิ้น</option>
          <option value="rejected">ปฏิเสธคำร้อง</option>
        </select>
        
        <div className="text-xs text-slate-400 ml-auto font-medium">
          พบรายการคำร้องทั้งหมด {filteredPetitions.length} รายการ
        </div>
      </div>

      {/* Main Petitions List Container */}
      <div className="space-y-4">
        {filteredPetitions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
            <Inbox className="mx-auto text-slate-300" size={48} />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-600">ไม่พบข้อมูลคำร้องเรียน</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                ไม่มีข้อมูลคำร้องเรียนหรือข้อเสนอแนะที่ตรงกับตัวกรองที่เลือกในขณะนี้ค่ะ
              </p>
            </div>
          </div>
        ) : (
          filteredPetitions.map((petition) => {
            const isOwner = petition.submittedBy === currentUser.id;
            return (
              <div 
                key={petition.id}
                className={`bg-white rounded-3xl p-5 md:p-6 border transition-all hover:shadow-md ${
                  isOwner ? "border-blue-100 bg-blue-50/5" : "border-slate-100"
                } space-y-4`}
              >
                {/* Header Row of Item */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-50 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getCategoryBadgeClass(petition.category)}`}>
                        {getCategoryLabel(petition.category)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        เลขที่ {petition.id} · {new Date(petition.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-base font-bold text-slate-800 mt-1">{petition.title}</h3>
                  </div>
                  <div>{getStatusBadge(petition.status)}</div>
                </div>

                {/* Content body */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    {petition.content}
                  </p>
                  
                  {/* Author Meta */}
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] px-1 font-medium">
                    {petition.isAnonymous ? (
                      <>
                        <UserX size={12} className="text-slate-400" />
                        <span>ผู้ส่ง: ผู้ใช้ไม่ประสงค์ออกนาม (ส่งแบบไม่ระบุตัวตน)</span>
                      </>
                    ) : (
                      <>
                        <UserIcon size={12} className="text-blue-500" />
                        <span>ผู้ส่ง: {getUserName(petition.submittedBy)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Response Area (If exists) */}
                {petition.response ? (
                  <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                      <CornerDownRight size={14} />
                      <span>บันทึกชี้แจงจากเหรัญญิก/คณะกรรมการ</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pl-5 whitespace-pre-line">
                      {petition.response}
                    </p>
                    <div className="text-[9px] text-slate-400 pl-5 font-medium">
                      ตอบกลับโดย: {getUserName(petition.resolvedBy || "")} · {petition.resolvedAt && new Date(petition.resolvedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ) : (
                  canRespond && (
                    <div className="pt-2">
                      {respondingToId === petition.id ? (
                        <form onSubmit={handleRespondSubmit} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                          <h4 className="text-xs font-bold text-slate-700">ชี้แจง/ตอบรับการดำเนินการข้อร้องเรียน</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">ปรับสถานะขั้นตอน:</label>
                              <select
                                value={adminStatus}
                                onChange={(e) => setAdminStatus(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                              >
                                <option value="investigating">กำลังตรวจสอบ (Investigating)</option>
                                <option value="resolved">ดำเนินการแล้วเสร็จ (Resolved)</option>
                                <option value="rejected">ปฏิเสธคำร้องเรียน (Rejected)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">คำชี้แจง / รายละเอียดตอบกลับ:</label>
                            <textarea
                              rows={2}
                              value={adminResponse}
                              onChange={(e) => setAdminResponse(e.target.value)}
                              placeholder="กรอกผลสรุปการตรวจสอบ การอนุญาตผ่อนผัน หรือข้ออธิบายชี้แจง..."
                              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none placeholder-slate-400 resize-none"
                            ></textarea>
                          </div>

                          {respondError && (
                            <p className="text-[10px] text-rose-500 font-bold">{respondError}</p>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              type="submit"
                              disabled={isResponding}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-4 py-2 rounded-xl transition-all"
                            >
                              {isResponding ? "กำลังบันทึก..." : "บันทึกผลการชี้แจง"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRespondingToId(null);
                                setAdminResponse("");
                              }}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-[11px] px-4 py-2 rounded-xl transition-all"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => {
                            setRespondingToId(petition.id);
                            setAdminResponse(petition.response || "");
                            setAdminStatus(petition.status === "pending" ? "resolved" : petition.status);
                            setRespondError(null);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <MessageSquare size={13} /> ตอบรับ/อัปเดตคำร้องเรียนนี้
                        </button>
                      )
                    }
                  </div>
                )
              )}
              </div>
            );
          })
        )}
      </div>

      {/* Submit Petition Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                <FileText className="text-blue-600" size={18} /> เขียนคำร้องหรือข้อเสนอแนะ
              </h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePetition} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600">เรื่อง / หัวข้อคำร้องเรียน:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น ขอผ่อนผันชำระค่ากองทุนงวดมิถุนายน, เสนอเพิ่มหัวข้อสวัสดิการ..."
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">เลือกหมวดหมู่:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-2 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
                  >
                    <option value="extension">ขอผ่อนผันการชำระเงิน</option>
                    <option value="suggestion">ข้อเสนอแนะเกี่ยวกับกิจกรรม</option>
                    <option value="system">แจ้งปัญหาการใช้งานระบบ</option>
                    <option value="other">เรื่องอื่นๆ</option>
                  </select>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2.5 cursor-pointer hover:bg-slate-100/50 transition-all">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                    />
                    <div className="text-left">
                      <span className="block font-bold text-[11px] text-slate-600">ส่งแบบไม่ระบุตัวตน</span>
                      <span className="block text-[9px] text-slate-400">จะไม่แสดงรหัส/ชื่อคุณบนบอร์ด</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-600">รายละเอียดคำร้องเรียนหรือข้อเสนอแนะ:</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="กรุณาอธิบายเหตุผลหรือระบุรายละเอียดให้ครบถ้วนเพื่อให้เหรัญญิกและคณะกรรมการพิจารณาได้อย่างถูกต้อง..."
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white placeholder-slate-400 resize-none leading-relaxed"
                ></textarea>
              </div>

              {submitError && (
                <p className="text-xs text-rose-500 font-bold">{submitError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
                >
                  <Send size={14} /> {isSubmitting ? "กำลังส่งคำร้อง..." : "ยื่นคำร้องเรียนเสร็จสิ้น"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
