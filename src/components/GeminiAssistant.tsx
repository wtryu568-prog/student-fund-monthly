/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  X, 
  MessageSquare, 
  Maximize2, 
  Minimize2, 
  Bot, 
  User as UserIcon,
  HelpCircle,
  TrendingUp,
  Mail,
  AlertCircle
} from "lucide-react";
import { User } from "../types";
import { safeParseJson } from "../App";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: Date;
}

interface GeminiAssistantProps {
  currentUser: User;
}

export default function GeminiAssistant({ currentUser }: GeminiAssistantProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      text: "สวัสดีค่ะ! ยินดีต้อนรับเข้าสู่ระบบผู้ช่วยเหรัญญิก AI (AI Treasurer Assistant) 🤖✨\n\nฉันพร้อมช่วยวิเคราะห์รายรับ-รายจ่ายของห้อง ค้นหาข้อมูลยอดคงค้าง ดึงยอดค้างจ่ายสลิปค่าบำรุงห้อง หรือช่วยเหรัญญิกร่างข้อความทวงถามเงินแบบสุภาพให้ค่ะ มีอะไรอยากให้ช่วยวิเคราะห์ในวันนี้ไหมคะ?",
      createdAt: new Date()
    }
  ]);
  const [input, setInput] = useState<string>(" ");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const starterPrompts = [
    { label: "📊 สรุปสเตตัสเก็บเงินเดือนนี้", prompt: "ขอสรุปสถานะการเก็บเงินค่าบำรุงรายเดือนประจำเดือนปัจจุบันให้หน่อยว่าจ่ายแล้วกี่คน ค้างกี่คน และใครยังค้างชำระบ้าง" },
    { label: "💰 วิเคราะห์รายรับรายจ่าย", prompt: "ช่วยวิเคราะห์ผลสรุปรายรับรายจ่ายของห้องในระบบ ณ ตอนนี้ให้ที แนะนำเรื่องความโปร่งใสทางการเงินของระบบด้วยนะ" },
    { label: "🍉 ข้อเสนอแนะลดต้นทุนตลาด", prompt: "ขอคำแนะนำและไอเดียเจ๋งๆ ในการเพิ่มกำไรหรือลดต้นทุนสำหรับการจัดตลาดวันพุธ (Wednesday Market) หน่อยค่ะ" },
    { label: "✉️ ร่างข้อความทวงเงินสุภาพ", prompt: "ช่วยเขียนร่างข้อความเตือน (Reminder Message) เพื่อนำไปส่งทวงเงินเพื่อนๆ ที่ยังค้างจ่ายค่าบำรุงห้องหน่อย เอาแบบภาษาเป็นกันเอง สุภาพ มีมารยาท ไม่น่าเกลียด" }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      text: textToSend,
      createdAt: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const historyPayload = messages.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        text: msg.text
      }));

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          history: historyPayload,
          userId: currentUser.id
        })
      });

      if (!response.ok) {
        const errData = await safeParseJson(response);
        throw new Error(String(errData.error || "เซิร์ฟเวอร์ AI ไม่ตอบสนองหรือยังไม่ได้อัปเกรดคีย์สิทธิ์"));
      }

      const data = await safeParseJson(response);
      if (data.error) {
        throw new Error(String(data.error));
      }
      
      const botMsg: Message = {
        id: `msg_bot_${Date.now()}`,
        role: "model",
        text: String(data.reply || "ขออภัยด้วยค่ะ ระบบประมวลผลคำตอบไม่ได้ชั่วคราว"),
        createdAt: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      const errorMsg: Message = {
        id: `msg_err_${Date.now()}`,
        role: "model",
        text: `⚠️ เกิดข้อผิดพลาด: ${error.message || "ไม่สามารถดึงข้อมูล AI ได้"} รบกวนแจ้งเหรัญญิกหรือคณะกรรมการตรวจสอบการเปิดใช้งานคีย์สิทธิ์หลังบ้านนะคะ`,
        createdAt: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleSend(input);
    setInput("");
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        id="gemini_floating_toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-full p-4 shadow-2xl transition-all cursor-pointer flex items-center justify-center border border-indigo-400/20 group hover:scale-105"
        title="คุยกับผู้ช่วยเหรัญญิก AI"
      >
        <div className="relative">
          {/* Neon Pulse animation */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
          </span>
          <Sparkles className="group-hover:rotate-12 transition-transform" size={22} />
        </div>
      </button>

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] md:w-[420px] h-[550px] bg-white rounded-3xl border border-slate-100 shadow-2xl flex flex-col overflow-hidden z-50 animate-fade-in text-xs">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <Sparkles className="text-pink-300" size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide">ผู้ช่วยเหรัญญิก AI</h3>
                <span className="text-[10px] text-indigo-100 font-medium">คุยวิเคราะห์การคลังและร่างประกาศเรียลไทม์</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Log Panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Avatar */}
                {msg.role !== "user" && (
                  <div className="bg-indigo-100 text-indigo-600 p-1.5 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot size={16} />
                  </div>
                )}
                
                {/* Content Box */}
                <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none font-medium"
                    : msg.id.startsWith("msg_err_")
                      ? "bg-rose-50 text-rose-800 border border-rose-100 rounded-tl-none font-sans"
                      : "bg-white text-slate-700 border border-slate-100/50 rounded-tl-none font-sans"
                }`}>
                  <p className="whitespace-pre-line text-[11px] leading-relaxed">{msg.text}</p>
                  <span className={`block text-[8px] mt-1.5 text-right ${
                    msg.role === "user" ? "text-indigo-200" : "text-slate-400"
                  }`}>
                    {msg.createdAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {msg.role === "user" && (
                  <div className="bg-slate-200 text-slate-600 p-1.5 rounded-xl h-8 w-8 flex items-center justify-center shrink-0">
                    <UserIcon size={16} />
                  </div>
                )}
              </div>
            ))}

            {/* Waiting state typing bubble */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="bg-indigo-100 text-indigo-600 p-1.5 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="bg-white text-slate-700 border border-slate-100/50 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-1.5 py-4">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Starter Prompts Panel */}
          {messages.length === 1 && (
            <div className="p-3 bg-white border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 px-1 block uppercase tracking-wider">คำถามแนะนำด่วน:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {starterPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-all text-left rounded-xl border border-slate-100 line-clamp-2 hover:border-indigo-100 active:scale-95 font-medium leading-normal"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form input field box */}
          <form 
            onSubmit={handleSubmit}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ถาม AI เช่น สรุปยอดเงิน, ร่างทวงเงิน..."
              className="flex-1 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-700"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl p-2.5 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
