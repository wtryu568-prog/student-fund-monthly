/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Phone, 
  Facebook, 
  Award, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Plus, 
  Trash2, 
  X, 
  Sparkles 
} from "lucide-react";
import { User, MonthlyBill } from "../types";

interface MemberListProps {
  currentUser: User;
  users: User[];
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
  ) => Promise<unknown>;
  onAddMember?: (studentId: string, fullName: string, nickname: string, email: string, phone: string, role: string, position: string, classroom: string) => Promise<unknown>;
  onDeleteMember?: (targetUserId: string) => Promise<unknown>;
}

export default function MemberList({
  currentUser,
  users,
  monthlyBills,
  onUpdateMember,
  onAddMember,
  onDeleteMember
}: MemberListProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [classroomFilter, setClassroomFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(currentUser);

  // States for updating member details (for treasurer edit panel)
  const [editRole, setEditRole] = useState<string>("");
  const [editPosition, setEditPosition] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // States for self editing
  const [isEditingSelf, setIsEditingSelf] = useState<boolean>(false);
  const [isEditingPeer, setIsEditingPeer] = useState<boolean>(false);
  const [selfFullName, setSelfFullName] = useState<string>("");
  const [selfNickname, setSelfNickname] = useState<string>("");
  const [selfEmail, setSelfEmail] = useState<string>("");
  const [selfPhone, setSelfPhone] = useState<string>("");
  const [selfClassroom, setSelfClassroom] = useState<string>("");
  const [selfSuccessMsg, setSelfSuccessMsg] = useState<string>("");
  const [selfErrorMsg, setSelfErrorMsg] = useState<string>("");

  useEffect(() => {
    if (selectedUser) {
      setEditRole(selectedUser.role);
      setEditPosition(selectedUser.position || "");
      setSelfFullName(selectedUser.fullName || "");
      setSelfNickname(selectedUser.nickname || "");
      setSelfEmail(selectedUser.email || "");
      setSelfPhone(selectedUser.phone || "");
      setSelfClassroom(selectedUser.classroom || "ห้อง 1");
      setIsEditingSelf(false);
      setIsEditingPeer(false);
      setSelfSuccessMsg("");
      setSelfErrorMsg("");
    }
  }, [selectedUser]);

  // Add Member Modal States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [newStudentId, setNewStudentId] = useState<string>("");
  const [newFullName, setNewFullName] = useState<string>("");
  const [newNickname, setNewNickname] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newPhone, setNewPhone] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("member");
  const [newPosition, setNewPosition] = useState<string>("นักศึกษาชั้นปีที่ 3");
  const [newClassroom, setNewClassroom] = useState<string>("ห้อง 1");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Filter members
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.studentId.includes(searchTerm) ||
                          u.nickname.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesClassroom = classroomFilter === "all" || u.classroom === classroomFilter;
    return matchesSearch && matchesRole && matchesClassroom;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "treasurer":
        return <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">🔴 เหรัญญิก</span>;
      case "leader":
        return <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">🎓 หัวหน้าห้อง</span>;
      case "committee":
        return <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">🎓 คณะกรรมการ</span>;
      case "member":
      default:
        return <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">👥 สมาชิกทั่วไป</span>;
    }
  };

  const handleUpdateSelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsUpdating(true);
    setSelfSuccessMsg("");
    setSelfErrorMsg("");
    try {
      await onUpdateMember(
        selectedUser.id, 
        undefined, // role
        undefined, // position
        undefined, // isActive
        selfFullName,
        selfNickname,
        selfEmail,
        selfPhone,
        selfClassroom
      );
      setSelfSuccessMsg("บันทึกข้อมูลส่วนตัวของคุณเรียบร้อยแล้ว! 🎉");
      setIsEditingSelf(false);
      // Close side panel or refresh selection
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      console.error(err);
      setSelfErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsUpdating(true);
    try {
      await onUpdateMember(selectedUser.id, editRole, editPosition, selectedUser.isActive);
      // Close side panel or refresh selection
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePeerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsUpdating(true);
    setSelfSuccessMsg("");
    setSelfErrorMsg("");
    try {
      await onUpdateMember(
        selectedUser.id, 
        undefined, // role
        undefined, // position
        undefined, // isActive
        selfFullName,
        selfNickname,
        selfEmail,
        selfPhone,
        undefined // classroom
      );
      setSelfSuccessMsg("บันทึกข้อมูลเพื่อนร่วมห้องเรียบร้อยแล้ว! 🎉");
      setIsEditingPeer(false);
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      console.error(err);
      setSelfErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId || !newFullName || !onAddMember) return;
    setIsAdding(true);
    setErrorMessage("");
    try {
      const res = await onAddMember(
        newStudentId,
        newFullName,
        newNickname,
        newEmail,
        newPhone,
        newRole,
        newPosition,
        newClassroom
      ) as { success: boolean; user: User };
      // Select the newly added user to show their profile details immediately
      setSelectedUser(res.user);
      setNewStudentId("");
      setNewFullName("");
      setNewNickname("");
      setNewEmail("");
      setNewPhone("");
      setNewRole("member");
      setNewPosition("นักศึกษาชั้นปีที่ 3");
      setNewClassroom("ห้อง 1");
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMessage(err.message || "เกิดข้อผิดพลาดในการลงทะเบียนสมาชิก");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMemberClick = async () => {
    if (!selectedUser || !onDeleteMember) return;
    setShowDeleteConfirm(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Directory Left Column */}
      <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
              <Users size={18} className="text-blue-600" /> ทำเนียบรายชื่อสมาชิกห้อง 3/A
            </h2>
            <p className="text-[11px] text-slate-400">รายชื่อนักศึกษาชั้นปีที่ 3 ในทะเบียนระบบกองทุนรุ่นส่วนกลาง</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">
              ทั้งหมด {filteredUsers.length} คน
            </span>
            {(currentUser.role === "treasurer" || currentUser.role === "leader") && onAddMember && (
              <button 
                onClick={() => {
                  setErrorMessage("");
                  setNewStudentId("");
                  setNewFullName("");
                  setNewNickname("");
                  setNewEmail("");
                  setNewPhone("");
                  if (currentUser.role === "leader") {
                    setNewClassroom(currentUser.classroom || "ห้อง 1");
                    setNewRole("member");
                  } else {
                    setNewClassroom("ห้อง 1");
                    setNewRole("member");
                  }
                  setShowAddModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-full text-[10px] flex items-center gap-0.5 transition-all shadow-sm"
              >
                <Plus size={11} /> เพิ่มเพื่อนตกหล่น
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="relative sm:col-span-2">
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาตามรหัสนักศึกษา, ชื่อจริง, ชื่อเล่น..." 
              className="w-full text-xs p-2.5 pl-8 border border-slate-200 rounded-xl focus:outline-none"
            />
            <Search className="absolute left-2.5 top-3.5 text-slate-400" size={14} />
          </div>
          <div>
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700 font-medium"
            >
              <option value="all">บทบาททั้งหมด</option>
              <option value="treasurer">เหรัญญิก</option>
              <option value="leader">หัวหน้าห้อง</option>
              <option value="committee">กรรมการ</option>
              <option value="member">สมาชิกทั่วไป</option>
            </select>
          </div>
          {(currentUser.role === "treasurer" || currentUser.role === "leader" || currentUser.role === "committee") && (
            <div>
              <select 
                value={classroomFilter}
                onChange={(e) => setClassroomFilter(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700 font-medium"
              >
                <option value="all">ห้องเรียนทั้งหมด</option>
                <option value="ห้อง 1">ห้อง 1</option>
                <option value="ห้อง 2">ห้อง 2</option>
              </select>
            </div>
          )}
        </div>

        {/* Directory Grid list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
          {filteredUsers.length === 0 ? (
            <div className="sm:col-span-2 text-center py-16 text-slate-400 text-xs italic">
              ไม่พบรายชื่อเพื่อนที่สอดคล้องกับการค้นหา
            </div>
          ) : (
            filteredUsers.map((user) => {
              const userBills = monthlyBills.filter(b => b.userId === user.id);
              const unpaidBills = userBills.filter(b => b.status !== "paid");
              const hasBills = userBills.length > 0;
              const hasUnpaid = unpaidBills.length > 0;
              
              return (
                <div 
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setEditRole(user.role);
                    setEditPosition(user.position || "");
                  }}
                  className={`p-3 rounded-2xl cursor-pointer border transition-all flex items-center justify-between text-xs ${
                    selectedUser?.id === user.id 
                      ? "border-blue-500 bg-blue-50/30" 
                      : "border-slate-100 hover:bg-slate-50 bg-white"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-800">{user.fullName} ({user.nickname})</span>
                      {getRoleBadge(user.role)}
                      {user.classroom && (
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded shrink-0">
                          {user.classroom}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400">รหัสนักศึกษา: {user.studentId}</p>
                  </div>
                  <div className="shrink-0 pl-1">
                    {!hasBills ? (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <CheckCircle2 size={10} className="text-slate-400" /> ไม่มีบิลค้าง
                      </span>
                    ) : !hasUnpaid ? (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> จ่ายครบแล้ว
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                        <Clock size={10} /> ค้าง {unpaidBills.length} บิล
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Directory Detail Side Card */}
      <div className="lg:col-span-1 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4 h-fit">
        {selectedUser ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center space-y-2 pb-4 border-b border-slate-100 relative">
              {currentUser.role === "treasurer" && currentUser.id !== selectedUser.id && onDeleteMember && (
                <button 
                  onClick={handleDeleteMemberClick}
                  className="absolute top-0 right-0 p-1.5 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-all"
                  title="ลบสมาชิกรุ่นห้องคนนี้ (กรณีรายชื่อเกิน)"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center font-bold text-slate-500 font-sans text-xl">
                {selectedUser.nickname}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{selectedUser.fullName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedUser.position || "นักศึกษาชั้นปีที่ 3"}</p>
                <div className="mt-2 flex justify-center">{getRoleBadge(selectedUser.role)}</div>
              </div>
            </div>

            {/* Profile Info details or self edit form */}
            {isEditingSelf ? (
              <form onSubmit={handleUpdateSelfSubmit} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-3">
                <h4 className="font-bold text-slate-700 flex items-center gap-1">
                  <UserCheck size={14} className="text-blue-600" /> แก้ไขข้อมูลส่วนตัวของคุณ
                </h4>
                
                {selfErrorMsg && (
                  <div className="p-2 bg-rose-50 text-rose-600 font-bold rounded-lg text-[10px]">
                    {selfErrorMsg}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ชื่อจริง - นามสกุล</label>
                  <input 
                    type="text" 
                    value={selfFullName}
                    onChange={(e) => setSelfFullName(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ชื่อเล่น</label>
                  <input 
                    type="text" 
                    value={selfNickname}
                    onChange={(e) => setSelfNickname(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ห้องเรียน {currentUser.role !== "treasurer" && currentUser.role !== "committee" && "(เฉพาะเหรัญญิกและคณะกรรมการแก้ไขได้เท่านั้น)"}</label>
                  <select 
                    value={selfClassroom}
                    onChange={(e) => setSelfClassroom(e.target.value)}
                    disabled={currentUser.role !== "treasurer" && currentUser.role !== "committee"}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <option value="ห้อง 1">ห้อง 1</option>
                    <option value="ห้อง 2">ห้อง 2</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">เบอร์โทรศัพท์</label>
                  <input 
                    type="text" 
                    value={selfPhone}
                    onChange={(e) => setSelfPhone(e.target.value)}
                    placeholder="เช่น 0891234567"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-mono text-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ลิงก์ Facebook หรือช่องทางติดต่อ</label>
                  <input 
                    type="text" 
                    value={selfEmail}
                    onChange={(e) => setSelfEmail(e.target.value)}
                    required
                    placeholder="เช่น facebook.com/username หรือ ชื่อ Facebook"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button 
                    type="button"
                    onClick={() => setIsEditingSelf(false)}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl py-2 transition-all text-[11px]"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-2 transition-all text-[11px]"
                  >
                    {isUpdating ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                  </button>
                </div>
              </form>
            ) : isEditingPeer ? (
              <form onSubmit={handleUpdatePeerSubmit} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-3">
                <h4 className="font-bold text-slate-700 flex items-center gap-1">
                  <UserCheck size={14} className="text-blue-600" /> แก้ไขข้อมูลเพื่อน
                </h4>
                
                {selfErrorMsg && (
                  <div className="p-2 bg-rose-50 text-rose-600 font-bold rounded-lg text-[10px]">
                    {selfErrorMsg}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ชื่อจริง - นามสกุล</label>
                  <input 
                    type="text" 
                    value={selfFullName}
                    onChange={(e) => setSelfFullName(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ชื่อเล่น</label>
                  <input 
                    type="text" 
                    value={selfNickname}
                    onChange={(e) => setSelfNickname(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">เบอร์โทรศัพท์</label>
                  <input 
                    type="text" 
                    value={selfPhone}
                    onChange={(e) => setSelfPhone(e.target.value)}
                    placeholder="เช่น 0891234567"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-mono text-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ลิงก์ Facebook หรือช่องทางติดต่อ</label>
                  <input 
                    type="text" 
                    value={selfEmail}
                    onChange={(e) => setSelfEmail(e.target.value)}
                    required
                    placeholder="เช่น facebook.com/username หรือ ชื่อ Facebook"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700 font-sans"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button 
                    type="button"
                    onClick={() => setIsEditingPeer(false)}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl py-2 transition-all text-[11px]"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-2 transition-all text-[11px]"
                  >
                    {isUpdating ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="space-y-3 text-xs font-sans text-slate-600">
                  <div className="flex items-center gap-2">
                    <Users className="text-slate-400" size={14} />
                    <span>ห้องเรียน: <strong className="text-slate-700 font-sans">{selectedUser.classroom || "ไม่ระบุ"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="text-slate-400" size={14} />
                    <span>เบอร์โทรศัพท์: <strong className="text-slate-700 font-mono">{selectedUser.phone || "ไม่ระบุ"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Facebook className="text-slate-400" size={14} />
                    <span className="line-clamp-1 font-sans">Facebook: <strong className="text-slate-700 font-sans">{selectedUser.email || "ไม่ระบุ"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="text-slate-400" size={14} />
                    <span>รหัสนิสิต: <strong className="text-slate-700 font-mono">{selectedUser.studentId}</strong></span>
                  </div>
                  {currentUser.role === "treasurer" && (
                    <div className="mt-3 p-3 bg-rose-50/70 border border-rose-100 rounded-2xl space-y-1">
                      <div className="text-[10px] text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        🔑 กู้คืนสิทธิ์ / รหัสผ่านของเพื่อน
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">รหัสผ่านปัจจุบัน:</span>
                        <strong className="font-mono text-rose-700 font-extrabold bg-white border border-rose-100 px-2 py-0.5 rounded shadow-sm select-all">
                          {selectedUser.password || "123456"}
                        </strong>
                      </div>
                      <p className="text-[9px] text-slate-400 italic text-right mt-0.5">* ใช้ช่วยเพื่อนเมื่อเพื่อนลืมรหัสเข้าใช้งาน</p>
                    </div>
                  )}
                </div>

                {selfSuccessMsg && (
                  <div className="p-2 bg-emerald-50 text-emerald-600 font-bold rounded-lg text-[10px] text-center">
                    {selfSuccessMsg}
                  </div>
                )}

                {currentUser.id === selectedUser.id && (
                  <button 
                    onClick={() => {
                      setIsEditingSelf(true);
                      setSelfSuccessMsg("");
                      setSelfErrorMsg("");
                    }}
                    className="w-full bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl py-2.5 transition-all text-[11px] flex items-center justify-center gap-1"
                  >
                    ✏️ แก้ไขข้อมูลส่วนตัวของคุณ
                  </button>
                )}

                {currentUser.id !== selectedUser.id && (currentUser.role === "treasurer" || (currentUser.role === "leader" && selectedUser.classroom === currentUser.classroom)) && (
                  <button 
                    onClick={() => {
                      setIsEditingPeer(true);
                      setSelfSuccessMsg("");
                      setSelfErrorMsg("");
                    }}
                    className="w-full bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold rounded-xl py-2.5 transition-all text-[11px] flex items-center justify-center gap-1"
                  >
                    ✏️ แก้ไขข้อมูลเพื่อนคนนี้
                  </button>
                )}
              </>
            )}

            {/* Admin Management Panel (Treasurer only) */}
            {currentUser.role === "treasurer" && currentUser.id !== selectedUser.id && (
              <form onSubmit={handleUpdateUserSubmit} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-3">
                <h4 className="font-bold text-slate-700 flex items-center gap-1">
                  <UserCheck size={14} className="text-blue-600" /> จัดการให้สิทธิ์การใช้งาน
                </h4>
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ปรับบทบาทสิทธิ์</label>
                  <select 
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="member">สมาชิกทั่วไป (member)</option>
                    <option value="leader">หัวหน้าห้อง (leader)</option>
                    <option value="committee">คณะกรรมการห้อง (committee)</option>
                    <option value="treasurer">เหรัญญิกรุ่น (treasurer)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-500 font-bold">ตำแหน่งบริหาร / หน้าที่</label>
                  <input 
                    type="text" 
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    placeholder="เช่น รองหัวหน้าห้อง, เลขานุการ, ฝ่ายกีฬา" 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-2.5 transition-all text-[11px] shadow-md shadow-blue-500/10"
                >
                  {isUpdating ? "กำลังบันทึกสิทธิ์..." : "ยืนยันการตั้งค่าสิทธิ์เข้าใช้งาน"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-xs">
            คลิกเลือกรายชื่อเพื่อนในชั้นปีที่ 3 เพื่อดูข้อมูลและจัดการสิทธิ์
          </div>
        )}
      </div>

      {/* Add Member Modal (Treasurer Only) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1">
                <Sparkles size={16} className="text-amber-500" /> เพิ่มรายชื่อนิสิตห้องเรียน (ตกหล่น)
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] rounded-xl font-bold">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleAddMemberSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600">รหัสนักศึกษา (สำหรับใช้ Login บัญชี)</label>
                <input 
                  type="text" 
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="เช่น 169214210073"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-600">ชื่อ-นามสกุลจริง</label>
                <input 
                  type="text" 
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="เช่น สมพร พูลอนันต์"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">ชื่อเล่นเพื่อน</label>
                  <input 
                    type="text" 
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    placeholder="เช่น กอล์ฟ"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">เบอร์โทรศัพท์</label>
                  <input 
                    type="text" 
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0812345678"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-600">ลิงก์ Facebook หรือช่องทางติดต่อ</label>
                <input 
                  type="text" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="เช่น facebook.com/username หรือ ชื่อ Facebook ของเพื่อน"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-600">ห้องเรียน</label>
                <select 
                  value={newClassroom}
                  onChange={(e) => setNewClassroom(e.target.value)}
                  disabled={currentUser.role === "leader"}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-white font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="ห้อง 1">ห้อง 1</option>
                  <option value="ห้อง 2">ห้อง 2</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-600">บทบาท & ตำแหน่งแรกรุ่น</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={currentUser.role === "leader"}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-white font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="member">สมาชิกทั่วไป (member)</option>
                  <option value="leader">หัวหน้าห้อง (leader)</option>
                  <option value="committee">คณะกรรมการห้องเรียน (committee)</option>
                  <option value="treasurer">เหรัญญิกรุ่น (treasurer)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2.5 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isAdding}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/10"
                >
                  {isAdding ? "กำลังบันทึก..." : "เพิ่มสมาชิกเข้ากองทุน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Member Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">ยืนยันการลบสมาชิก?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                คุณแน่ใจหรือไม่ที่จะลบคุณ "{selectedUser.fullName}" ออกจากทะเบียนนักศึกษารุ่นห้อง? การดำเนินงานนี้จะลบข้อมูลที่เกี่ยวข้องออกและไม่สามารถกู้คืนได้
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const targetUser = selectedUser;
                  setShowDeleteConfirm(false);
                  setSelectedUser(null);
                  try {
                    await onDeleteMember(targetUser.id);
                  } catch (err: any) {
                    alert(err.message || "เกิดข้อผิดพลาดในการลบสมาชิก");
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                ยืนยันการลบ
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
