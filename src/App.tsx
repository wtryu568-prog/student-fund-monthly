/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { 
  Sparkles, 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign, 
  Award, 
  ShoppingBag, 
  FileText, 
  Lock, 
  ChevronRight,
  LogOut,
  Bell,
  Inbox,
  QrCode,
  X,
  Menu,
  User as UserIcon,
  Database,
  Check,
  Copy
} from "lucide-react";

// Types
import { User, MonthlyBill, Payment, Transaction, MarketWeek, MarketItem, BudgetRequest, Announcement, Notification, UserRole, AppState } from "./types";

// Modular Components
import Dashboard from "./components/Dashboard";
import MonthlyBills from "./components/MonthlyBills";
import WednesdayMarket from "./components/WednesdayMarket";
import Activities from "./components/Activities";
import FinancialReports from "./components/FinancialReports";
import ProfilePanel from "./components/ProfilePanel";
import MemberList from "./components/MemberList";
import AdminPanel from "./components/AdminPanel";
import LoginView from "./components/LoginView";
import PublicPreview from "./components/PublicPreview";
import { useLoading } from "./components/LoadingOverlay";

// Safe JSON parser helper to prevent "Unexpected token '<'" crash when server returns HTML error pages
export async function safeParseJson(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await res.json() as Record<string, unknown>;
    } catch (e) {
      // ignore and fall through
    }
  }
  try {
    const text = await res.text();
    if (text.trim().toLowerCase().startsWith("<!doctype") || text.trim().toLowerCase().startsWith("<html")) {
      return { error: "เซิร์ฟเวอร์ขัดข้องชั่วคราว (ได้รับหน้าเว็บ HTML แทนข้อมูล JSON) - กรุณาลองใหม่อีกครั้งค่ะ" };
    }
    return { error: text || `Error ${res.status}: ${res.statusText}` };
  } catch (e) {
    return { error: `Error ${res.status}: ${res.statusText}` };
  }
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showMobileMore, setShowMobileMore] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Show login form toggle — default is preview (landing page for visitors)
  const [showLoginForm, setShowLoginForm] = useState<boolean>(false);

  // Global loading overlay hook
  const { withLoading } = useLoading();

  // Refs to manage race conditions and debouncing on concurrent updates
  const fetchStateAbortControllerRef = React.useRef<AbortController | null>(null);
  const isCriticalFetchRunningRef = React.useRef<boolean>(false);
  const realtimeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch complete state with AbortController to handle in-flight requests correctly.
  // By default, fetchState is "critical" (e.g. user-initiated actions).
  const fetchState = async (isCritical: boolean = true) => {
    // If this is a background (real-time) fetch but a critical fetch is currently running,
    // we bypass it entirely since the critical fetch is already updating with the latest data.
    if (!isCritical && isCriticalFetchRunningRef.current) {
      console.log("[fetchState] Skipping background realtime fetch because a critical user action fetch is already running.");
      return;
    }

    if (isCritical) {
      isCriticalFetchRunningRef.current = true;
    }

    // Abort any in-flight requests to avoid older requests overwriting newer state
    if (fetchStateAbortControllerRef.current) {
      fetchStateAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchStateAbortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/state?t=${Date.now()}`, {
        signal: controller.signal
      });
      if (!res.ok) {
        const errData = await safeParseJson(res);
        throw new Error((errData.error as string) || "Failed to load database state from full-stack server");
      }
      const data = await safeParseJson(res) as unknown as AppState & { error?: string };
      if (data.error) throw new Error(data.error);
      
      // Ensure we only update state if this request hasn't been aborted
      if (!controller.signal.aborted) {
        setState(data);
        
        // Load user from localStorage if saved
        const savedUserStr = localStorage.getItem("currentUser");
        if (savedUserStr) {
          try {
            const savedUser = JSON.parse(savedUserStr);
            if (data.users) {
              const synced = data.users.find((u: User) => u.id === savedUser.id);
              if (synced) {
                setCurrentUser(synced);
                localStorage.setItem("currentUser", JSON.stringify(synced));
              } else {
                setCurrentUser(null);
                localStorage.removeItem("currentUser");
              }
            }
          } catch (e) {
            setCurrentUser(null);
            localStorage.removeItem("currentUser");
          }
        } else {
          setCurrentUser(null);
        }
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      if (errorObj.name === "AbortError") {
        console.log("[fetchState] Fetch aborted due to a newer request starting");
        return;
      }
      console.error(errorObj);
      setError(errorObj.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
      if (isCritical) {
        // Allow some time for state propagation before turning off the critical flag
        setTimeout(() => {
          isCriticalFetchRunningRef.current = false;
        }, 500);
      }
    }
  };

  // Debounced wrapper for fetching state from real-time events to allow server-side operations to settle.
  // It is specified as non-critical (isCritical = false) so it won't interrupt ongoing critical fetches.
  const triggerRealtimeStateFetch = () => {
    if (realtimeTimeoutRef.current) {
      clearTimeout(realtimeTimeoutRef.current);
    }
    realtimeTimeoutRef.current = setTimeout(() => {
      fetchState(false);
    }, 600); // 600ms debounce to allow the database and APIs to settle
  };

  useEffect(() => {
    fetchState();

    let isUnmounted = false;
    let supabaseChannel: RealtimeChannel | null = null;
    let eventSource: EventSource | null = null;

    // 1. Set up Supabase Realtime Connection
    fetch("/api/supabase-config")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load config");
        return res.json();
      })
      .then((config) => {
        if (isUnmounted) return;
        const { supabaseUrl, supabaseKey } = config;
        if (!supabaseUrl || !supabaseKey) {
          console.warn("[Realtime] Supabase configuration missing from server");
          return;
        }

        try {
          const clientSupabase = createClient(supabaseUrl, supabaseKey);
          
          // Connect to the app-updates broadcast channel & listen to wildcard DB modifications
          supabaseChannel = clientSupabase.channel("app-updates")
            .on(
              "broadcast",
              { event: "state_changed" },
              (payload) => {
                console.log("[Supabase Realtime] Received update via broadcast:", payload);
                triggerRealtimeStateFetch();
              }
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public" },
              (payload) => {
                console.log("[Supabase Realtime] Received update via DB change:", payload);
                triggerRealtimeStateFetch();
              }
            )
            .subscribe((status) => {
              console.log(`[Supabase Realtime] Client connection status: ${status}`);
            });
        } catch (err) {
          console.error("[Supabase Realtime] Initialization error:", err);
        }
      })
      .catch((err) => {
        console.warn("[Supabase Realtime] Failed to configure:", err);
      });

    // 2. Fallback EventSource SSE Connection
    try {
      eventSource = new EventSource("/api/realtime-stream");
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "state_changed") {
            console.log("[SSE Fallback] State change received, fetching state");
            triggerRealtimeStateFetch();
          }
        } catch (err) {
          console.error("[SSE Fallback] Message parse failed:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("[SSE Fallback] Status event:", err);
      };
    } catch (err) {
      console.error("[SSE Fallback] Setup failed:", err);
    }

    return () => {
      isUnmounted = true;
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
      }
      if (supabaseChannel) {
        try {
          supabaseChannel.unsubscribe();
        } catch (e) {
          console.error("Unsubscribe error:", e);
        }
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const handleLogin = async (studentId: string, passwordStr: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, password: passwordStr })
      });
      if (!res.ok) {
        const errData = await safeParseJson(res);
        throw new Error((errData.error as string) || "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง");
      }
      const data = await safeParseJson(res);
      if (data.error) throw new Error(data.error as string);
      setCurrentUser(data.user as User);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      setActiveTab("dashboard");
      return data.user as User;
    } catch (err: unknown) {
      throw err as Error;
    }
  };

  const handleDirectLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("currentUser", JSON.stringify(user));
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    setActiveTab("dashboard");
  };

  // Post Actions
  const handleUpdateSettings = async (fundName: string, monthlyFee: number, promptpayNumber: string, promptpayName: string, promptpayQrUrl?: string, bankName?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundName, monthlyFee, promptpayNumber, promptpayName, promptpayQrUrl, bankName, userId: currentUser.id })
      });
      if (!res.ok) throw new Error("Settings update failed");
      await fetchState();
      return await res.json();
    }, "กำลังบันทึกการตั้งค่า...");
  };

  const handleCreateMonthlyBills = async (month: number, year: number, dueDate: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/bills/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, dueDate, userId: currentUser.id })
      });
      if (!res.ok) throw new Error("Billing trigger failed");
      await fetchState();
      return await res.json();
    }, "กำลังสร้างรอบบิลใหม่...");
  };

  const handleDeleteMonthlyBills = async (month: number, year: number) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/bills/delete-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, userId: currentUser.id })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "ลบรอบบิลล้มเหลว");
      }
      await fetchState();
      return await res.json();
    }, "กำลังลบรอบบิล...");
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/transactions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, userId: currentUser.id })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "ลบรายการล้มเหลว");
      }
      await fetchState();
      return await res.json();
    }, "กำลังลบรายการ...");
  };

  const handleResetSystemData = async (keepUsers: boolean, keepSettings: boolean) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/system/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, keepUsers, keepSettings })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "รีเซ็ตระบบล้มเหลว");
      }
      await fetchState();
      return await res.json();
    }, "กำลังรีเซ็ตระบบ...");
  };

  const handleSubmitSlip = async (billId: string, amount: number, slipUrl: string, note: string, targetUserId?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const actualUserId = targetUserId || currentUser.id;
      const res = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, userId: actualUserId, amount, slipUrl, note })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "เกิดข้อผิดพลาดในการส่งข้อมูลสลิป");
      }
      await fetchState();
      return await res.json();
    }, "กำลังส่งหลักฐานการชำระเงิน...");
  };

  const handleCancelSlip = async (billId: string, targetUserId?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const actualUserId = targetUserId || currentUser.id;
      const res = await fetch("/api/payments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, userId: actualUserId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "ยกเลิกคำขอชำระเงินล้มเหลว");
      }
      await fetchState();
      return await res.json();
    }, "กำลังยกเลิกคำขอชำระเงิน...");
  };

  const handleApprovePayment = async (paymentId: string, treasurerId: string, note?: string) => {
    return withLoading(async () => {
      const res = await fetch("/api/payments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, treasurerId, note })
      });
      if (!res.ok) throw new Error("Approve payment failed");
      await fetchState();
      return await res.json();
    }, "กำลังอนุมัติการชำระเงิน...");
  };

  const handleRejectPayment = async (paymentId: string, treasurerId: string, rejectReason: string) => {
    return withLoading(async () => {
      const res = await fetch("/api/payments/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, treasurerId, rejectReason })
      });
      if (!res.ok) throw new Error("Reject payment failed");
      await fetchState();
      return await res.json();
    }, "กำลังปฏิเสธการชำระเงิน...");
  };

  const handleRecordCashPayment = async (billId: string, userId: string, amount: number, note?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/payments/record-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, userId, amount, treasurerId: currentUser.id, note })
      });
      if (!res.ok) throw new Error("Recording cash payment failed");
      await fetchState();
      return await res.json();
    }, "กำลังบันทึกการชำระเงินสด...");
  };

  const handleUploadSlipAdmin = async (billId: string, userId: string, base64Image: string, note?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/payments/upload-slip-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, userId, base64Image, treasurerId: currentUser.id, note })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Uploading slip failed");
      }
      await fetchState();
      return await res.json();
    }, "กำลังอัปโหลดรูปภาพสลิปขึ้น Google Drive...");
  };

  const handleCreateMarketWeek = async (weekDate: string, note: string, teamName?: string, leaderId?: string, memberIds?: string[]) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/market/week/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekDate, note, teamName, leaderId, memberIds, userId: currentUser.id })
      });
      if (!res.ok) throw new Error("Market week creation failed");
      await fetchState();
      return await res.json();
    }, "กำลังสร้างสัปดาห์ตลาดใหม่...");
  };

  const handleUpdateWeekTeam = async (marketWeekId: string, teamName?: string, leaderId?: string, memberIds?: string[], note?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/market/week/update-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, teamName, leaderId, memberIds, note, userId: currentUser.id })
      });
      if (!res.ok) throw new Error("Update market week team failed");
      await fetchState();
      return await res.json();
    }, "กำลังอัปเดตทีมตลาด...");
  };

  const handleAddItemToMarket = async (marketWeekId: string, itemName: string, type: "cost" | "revenue", amount: number, quantity: number, note?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/market/item/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, itemName, type, amount, quantity, note, userId: currentUser.id })
      });
      const parsed = await safeParseJson(res);
      if (!res.ok || parsed.error) {
        throw new Error(String(parsed.error || "Item add failed"));
      }
      await fetchState(true);
      return parsed;
    }, "กำลังเพิ่มรายการ...");
  };

  const handleDeleteItemFromMarket = async (itemId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/market/item/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, userId: currentUser.id })
      });
      const parsed = await safeParseJson(res);
      if (!res.ok || parsed.error) {
        throw new Error(String(parsed.error || "Item delete failed"));
      }
      await fetchState(true);
      return parsed;
    }, "กำลังลบรายการ...");
  };

  const handleCompleteMarketWeek = async (marketWeekId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/market/week/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, userId: currentUser.id })
      });
      const parsed = await safeParseJson(res);
      if (!res.ok || parsed.error) {
        throw new Error(String(parsed.error || "Market complete failed"));
      }
      await fetchState(true);
      return parsed;
    }, "กำลังสรุปตลาดประจำสัปดาห์...");
  };

  const handleApproveMarketWeek = async (marketWeekId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/market/week/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, treasurerId: currentUser.id })
      });
      const parsed = await safeParseJson(res);
      if (!res.ok || parsed.error) {
        throw new Error(String(parsed.error || "Market approve failed"));
      }
      await fetchState(true);
      return parsed;
    }, "กำลังอนุมัติตลาด...");
  };

  const handleDeleteMarketWeek = async (marketWeekId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/market/week/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, userId: currentUser.id })
      });
      const parsed = await safeParseJson(res);
      if (!res.ok || parsed.error) {
        throw new Error(String(parsed.error || "Delete market week failed"));
      }
      await fetchState(true);
      return parsed;
    }, "กำลังลบสัปดาห์ตลาด...");
  };

  const handleProposeMarketAdvance = async (marketWeekId: string, amount: number, reason: string) => {
    return withLoading(async () => {
      const res = await fetch("/api/market/week/advance/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, amount, reason, requesterId: currentUser?.id })
      });
      if (!res.ok) {
        const err = await safeParseJson(res);
        throw new Error(String(err.error || "Failed to propose market advance capital"));
      }
      await fetchState();
      return await safeParseJson(res);
    }, "กำลังส่งคำขอเบิกทุนล่วงหน้า...");
  };

  const handleApproveMarketAdvance = async (marketWeekId: string, action: "approve" | "reject", rejectReason?: string, receiptUrl?: string) => {
    return withLoading(async () => {
      const res = await fetch("/api/market/week/advance/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, treasurerId: currentUser?.id, action, rejectReason, receiptUrl })
      });
      if (!res.ok) {
        const err = await safeParseJson(res);
        throw new Error(String(err.error || "Failed to review market advance capital"));
      }
      await fetchState();
      return await safeParseJson(res);
    }, "กำลังพิจารณาคำขอเบิกทุน...");
  };

  const handleProposeMarketAdditionalAdvance = async (marketWeekId: string, amount: number, reason: string) => {
    return withLoading(async () => {
      const res = await fetch("/api/market/week/advance-additional/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, amount, reason, requesterId: currentUser?.id })
      });
      if (!res.ok) {
        const err = await safeParseJson(res);
        throw new Error(String(err.error || "Failed to propose additional market advance capital"));
      }
      await fetchState();
      return await safeParseJson(res);
    }, "กำลังส่งคำขอเบิกทุนเพิ่มเติม...");
  };

  const handleApproveMarketAdditionalAdvance = async (marketWeekId: string, action: "approve" | "reject", rejectReason?: string, receiptUrl?: string) => {
    return withLoading(async () => {
      const res = await fetch("/api/market/week/advance-additional/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketWeekId, treasurerId: currentUser?.id, action, rejectReason, receiptUrl })
      });
      if (!res.ok) {
        const err = await safeParseJson(res);
        throw new Error(String(err.error || "Failed to review additional market advance capital"));
      }
      await fetchState();
      return await safeParseJson(res);
    }, "กำลังพิจารณาคำขอเบิกทุนเพิ่มเติม...");
  };

  const handleProposeActivity = async (title: string, description: string, eventDate: string, location: string, budgetEstimated: number) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, eventDate, location, budgetEstimated, userId: currentUser.id })
      });
      if (!res.ok) throw new Error("Propose activity failed");
      await fetchState();
      return await res.json();
    }, "กำลังส่งคำเสนอโครงการ...");
  };

  const handleApproveActivity = async (activityId: string, action: "approve" | "reject", rejectReason?: string, budgetApproved?: number) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, treasurerId: currentUser.id, action, rejectReason, budgetApproved })
      });
      if (!res.ok) throw new Error("Activity action failed");
      await fetchState();
      return await res.json();
    }, "กำลังพิจารณาโครงการ...");
  };

  const handleProposeBudgetExpansion = async (activityId: string, originalRequestId: string, amount: number, reason: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/budget-expansion/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, originalRequestId, amount, reason, userId: currentUser.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to propose budget expansion");
      }
      await fetchState();
      return await res.json();
    }, "กำลังส่งคำขอขยายงบ...");
  };

  const handleApproveBudgetExpansion = async (requestId: string, action: "approve" | "reject", rejectReason?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/budget-expansion/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, treasurerId: currentUser.id, action, rejectReason })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve budget expansion");
      }
      await fetchState();
      return await res.json();
    }, "กำลังพิจารณาการขยายงบ...");
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, userId: currentUser.id })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Delete activity failed");
      }
      await fetchState();
      return await res.json();
    }, "กำลังลบโครงการ...");
  };

  const handleUpdateActivity = async (activityId: string, updatedData: any) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, userId: currentUser.id, ...updatedData })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Update activity failed");
      }
      await fetchState();
      return await res.json();
    }, "กำลังอัปเดตโครงการ...");
  };

  const handleProposeBudget = async (activityId: string, title: string, amount: number, reason: string, details?: string, documentUrls?: string[]) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/budget/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, title, amount, reason, details, documentUrls, userId: currentUser.id })
      });
      if (!res.ok) throw new Error("Budget proposal failed");
      await fetchState();
      return await res.json();
    }, "กำลังส่งคำขอเบิกงบ...");
  };

  const handleApproveBudget = async (requestId: string, action: "approve" | "reject", rejectReason?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/budget/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, treasurerId: currentUser.id, action, rejectReason })
      });
      if (!res.ok) throw new Error("Budget approval action failed");
      await fetchState();
      return await res.json();
    }, "กำลังพิจารณาคำขอเบิกงบ...");
  };

  const handleProposeSettlement = async (activityId: string, actualExpense: number, refundAmount: number, refundSlipUrl?: string, expenseReceipts?: string[]) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/settle/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, actualExpense, refundAmount, refundSlipUrl, expenseReceipts, userId: currentUser.id })
      });
      if (!res.ok) {
        const errData = await safeParseJson(res);
        throw new Error(String(errData.error || "Propose settlement failed"));
      }
      await fetchState();
      return await res.json();
    }, "กำลังส่งคำขอสรุปโครงการ...");
  };

  const handleApproveSettlement = async (activityId: string, action: "approve" | "reject", rejectReason?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/settle/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, treasurerId: currentUser.id, action, rejectReason })
      });
      if (!res.ok) {
        const errData = await safeParseJson(res);
        throw new Error(String(errData.error || "Approve settlement failed"));
      }
      await fetchState();
      return await res.json();
    }, "กำลังพิจารณาการสรุป...");
  };

  const handleProposeExternalIncome = async (activityId: string, amount: number, source: string, slipUrl?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/external-income/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, amount, source, slipUrl, userId: currentUser.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to propose external income");
      }
      await fetchState();
      return await res.json();
    }, "กำลังบันทึกเงินสนับสนุน...");
  };

  const handleApproveExternalIncome = async (activityId: string, incomeId: string, action: "approve" | "reject", rejectReason?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/activities/external-income/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, incomeId, treasurerId: currentUser.id, action, rejectReason })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to respond to external income");
      }
      await fetchState();
      return await res.json();
    }, "กำลังพิจารณาเงินสนับสนุน...");
  };




  const handleUpdateMember = async (
    targetUserId: string, 
    role?: string, 
    position?: string, 
    isActive?: boolean,
    fullName?: string,
    nickname?: string,
    email?: string,
    phone?: string,
    classroom?: string
  ) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/members/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          targetUserId, 
          role, 
          position, 
          isActive, 
          fullName,
          nickname,
          email,
          phone,
          classroom,
          userId: currentUser.id 
        })
      });
      if (!res.ok) throw new Error("Member update failed");
      await fetchState();
      return await res.json();
    }, "กำลังอัปเดตข้อมูลสมาชิก...");
  };

  const handleChangePassword = async (oldPasswordStr: string, newPasswordStr: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          oldPassword: oldPasswordStr,
          newPassword: newPasswordStr
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
      }
      await fetchState();
      return await res.json();
    }, "กำลังเปลี่ยนรหัสผ่าน...");
  };

  const handleResolveResetPassword = async (resetId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/treasurer/resolve-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetId, treasurerId: currentUser.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "ไม่สามารถรีเซ็ตรหัสผ่านได้");
      }
      await fetchState();
      return await res.json();
    }, "กำลังรีเซ็ตรหัสผ่าน...");
  };

  const handleAddMember = async (studentId: string, fullName: string, nickname: string, email: string, phone: string, role: string, position: string, classroom: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/members/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, fullName, nickname, email, phone, role, position, classroom, userId: currentUser.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "เกิดข้อผิดพลาดในการเพิ่มสมาชิก");
      }
      await fetchState();
      return await res.json();
    }, "กำลังเพิ่มสมาชิกใหม่...");
  };

  const handleDeleteMember = async (targetUserId: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/members/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, userId: currentUser.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "เกิดข้อผิดพลาดในการลบสมาชิก");
      }
      await fetchState();
      return await res.json();
    }, "กำลังลบสมาชิก...");
  };

  const handleSubmitPetition = async (title: string, category: string, content: string, isAnonymous: boolean) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/petitions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, content, isAnonymous, userId: currentUser.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "ยื่นคำร้องไม่สำเร็จ");
      }
      await fetchState();
      return await res.json();
    }, "กำลังส่งคำร้อง...");
  };

  const handleRespondPetition = async (petitionId: string, status: string, response: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/petitions/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petitionId, status, response, adminId: currentUser.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "บันทึกคำชี้แจงไม่สำเร็จ");
      }
      await fetchState();
      return await res.json();
    }, "กำลังบันทึกคำชี้แจง...");
  };

  const handleSendReminder = async (targetUserId: string, message: string, title?: string) => {
    if (!currentUser) return;
    return withLoading(async () => {
      const res = await fetch("/api/notifications/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, senderId: currentUser.id, message, title })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "ส่งแจ้งเตือนไม่สำเร็จ");
      }
      await fetchState();
      return await res.json();
    }, "กำลังส่งแจ้งเตือน...");
  };

  const handleMarkNotificationsRead = async (notId?: string) => {
    if (!currentUser) return;
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notId, userId: currentUser.id })
    });
    if (!res.ok) {
      throw new Error("ไม่สามารถอัปเดตสถานะการแจ้งเตือนได้");
    }
    await fetchState();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-sm font-bold text-slate-700 font-sans">กำลังเปิดการใช้งานระบบเงินเก็บTns รุ่น06...</h2>
          <p className="text-xs text-slate-400">นำเข้าข้อมูลสรุปทางการเงิน ทะเบียนรายชื่อ 72 สมาชิก และวิเคราะห์ AI</p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-rose-100 rounded-3xl p-6 max-w-sm text-center shadow-xl space-y-4 text-xs font-sans">
          <h2 className="text-base font-bold text-rose-600">เกิดข้อผิดพลาดในการโหลดระบบ</h2>
          <p className="text-slate-500 leading-relaxed">{error || "ไม่สามารถติดต่อเซิร์ฟเวอร์หลักของระบบเงินเก็บTns รุ่น06 ได้"}</p>
          <button onClick={() => fetchState(true)} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl">ลองเชื่อมต่อใหม่อีกครั้ง</button>
        </div>
      </div>
    );
  }

  // Sidebar navigation menu items
  const sidebarItems = [
    { id: "dashboard", label: "ภาพรวมกองทุน", icon: <TrendingUp size={16} /> },
    { id: "monthly", label: "ชำระเงินรายเดือน", icon: <DollarSign size={16} /> },
    { id: "market", label: "สรุปตลาดวันพุธ", icon: <ShoppingBag size={16} /> },
    { id: "activities", label: "โครงการกิจกรรม", icon: <Award size={16} /> },
    { id: "reports", label: "การเงินโปร่งใส", icon: <FileText size={16} /> },
    { id: "members", label: "รายชื่อสมาชิก 72 คน", icon: <Users size={16} /> },
    { id: "profile", label: "ข้อมูลส่วนตัว", icon: <UserIcon size={16} className="text-blue-500" /> },
  ];

  if (currentUser?.role === "treasurer") {
    sidebarItems.push({ id: "admin", label: "จัดการระบบ (เหรัญญิก)", icon: <Lock size={16} className="text-rose-500" /> });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col justify-center items-center p-6 text-center font-sans">
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto animate-bounce">
            <Database size={24} />
          </div>
          <p className="text-xs text-slate-500 font-bold">กำลังเชื่อมต่อความปลอดภัยและดึงข้อมูลฐานข้อมูลคลาวด์...</p>
        </div>
      </div>
    );
  }

  // Not logged in — show Public Preview (default) or Login Form
  if (!currentUser) {
    if (showLoginForm) {
      return <LoginView users={state?.users || []} onLogin={handleLogin} onDirectLogin={handleDirectLogin} onBackToPreview={() => setShowLoginForm(false)} />;
    }
    return <PublicPreview onGoToLogin={() => setShowLoginForm(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Real-world Header and Nav with Logout */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-30 shadow-sm flex flex-row justify-between items-center">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white border border-slate-200 shadow-md shadow-purple-950/10 shrink-0 flex items-center justify-center p-0.5">
            <img src="/logo.svg" alt="TNS Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight leading-none">เงินเก็บ Tns06</h1>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5 hidden sm:block">ระบบจัดการเงินห้องเรียน</p>
          </div>
        </div>

        {/* User Profile Info & Secure Logout Button */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-150 px-2.5 py-1 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-xs">
          <div className="text-right">
            <div className="flex items-center gap-1 sm:gap-1.5 justify-end">
              <span className="font-extrabold text-slate-800 text-[10px] sm:text-xs">
                {currentUser.nickname || currentUser.fullName.split(" ")[0]}
              </span>
              <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 bg-blue-100 text-blue-700 font-bold rounded-full">
                {currentUser.classroom || "ทั่วไป"}
              </span>
            </div>
            <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold hidden sm:block mt-0.5">
              สิทธิ์: {currentUser.role === "treasurer" ? "🔴 เหรัญญิกรุ่น" : currentUser.role === "leader" ? "🎓 หัวหน้าห้อง" : currentUser.role === "committee" ? "🎓 กรรมการ" : "👥 สมาชิกทั่วไป"}
            </p>
          </div>
          <div className="w-[1px] h-5 sm:h-6 bg-slate-200" />
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-1 sm:p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg sm:rounded-xl transition-all"
            title="ออกจากระบบ"
          >
            <LogOut size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Main workspace layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col md:flex-row p-4 md:p-6 gap-6 pb-28 md:pb-6">
        {/* Sidebar (Hidden on mobile, elegant list on desktop) */}
        <aside className="hidden md:flex w-full md:w-56 lg:w-64 shrink-0 space-y-2 flex-col">
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex-1 space-y-1">
            {sidebarItems.map((item) => (
              <button 
                id={`sidebar_tab_${item.id}`}
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
                  activeTab === item.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* PromptPay Info in sidebar */}
          <div 
            onClick={() => setShowQrModal(true)}
            className="bg-[#002d62] text-white rounded-3xl p-4 space-y-2 text-xs cursor-pointer hover:bg-[#002550] transition-all relative overflow-hidden group shadow-md"
          >
            {/* Soft decorative background pattern */}
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-2 translate-y-2 pointer-events-none group-hover:scale-110 transition-all">
              <QrCode size={100} />
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider text-blue-200">
                <DollarSign size={12} /> ข้อมูลโอนจ่ายส่วนกลาง
              </div>
              <span className="text-[9px] font-bold bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <QrCode size={9} /> ดู QR Code
              </span>
            </div>
            <p className="text-[11px] font-sans text-blue-100 line-clamp-1">{state.settings.promptpayName}</p>
            <p className="font-mono text-xs font-bold bg-white/10 px-2 py-1 rounded-lg inline-block">{state.settings.promptpayNumber}</p>
          </div>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 overflow-hidden">
          {activeTab === "dashboard" && (
            <Dashboard 
              currentUser={currentUser!}
              users={state.users}
              transactions={state.transactions}
              announcements={state.announcements}
              monthlyBills={state.monthlyBills}
              settings={state.settings}
              setTab={setActiveTab}
              notifications={state.notifications}
              onMarkNotificationsRead={handleMarkNotificationsRead}
            />
          )}

          {activeTab === "monthly" && (
            <MonthlyBills 
              currentUser={currentUser!}
              users={state.users}
              monthlyBills={state.monthlyBills}
              payments={state.payments}
              settings={state.settings}
              onSubmitSlip={handleSubmitSlip}
              onCancelSlip={handleCancelSlip}
              onRecordCashPayment={handleRecordCashPayment}
              onDeleteMonthlyBills={handleDeleteMonthlyBills}
            />
          )}

          {activeTab === "market" && (
            <WednesdayMarket 
              currentUser={currentUser!}
              users={state.users}
              marketWeeks={state.marketWeeks}
              marketItems={state.marketItems}
              onCreateWeek={handleCreateMarketWeek}
              onAddItem={handleAddItemToMarket}
              onDeleteItem={handleDeleteItemFromMarket}
              onCompleteWeek={handleCompleteMarketWeek}
              onApproveWeek={handleApproveMarketWeek}
              onUpdateWeekTeam={handleUpdateWeekTeam}
              onDeleteWeek={handleDeleteMarketWeek}
              onProposeMarketAdvance={handleProposeMarketAdvance}
              onApproveMarketAdvance={handleApproveMarketAdvance}
              onProposeMarketAdditionalAdvance={handleProposeMarketAdditionalAdvance}
              onApproveMarketAdditionalAdvance={handleApproveMarketAdditionalAdvance}
            />
          )}

           {activeTab === "activities" && (
            <Activities 
              currentUser={currentUser!}
              users={state.users}
              activities={state.activities}
              budgetRequests={state.budgetRequests}
              settings={state.settings}
              onProposeActivity={handleProposeActivity}
              onApproveActivity={handleApproveActivity}
              onProposeBudget={handleProposeBudget}
              onApproveBudget={handleApproveBudget}
              onDeleteActivity={handleDeleteActivity}
              onProposeSettlement={handleProposeSettlement}
              onApproveSettlement={handleApproveSettlement}
              onProposeBudgetExpansion={handleProposeBudgetExpansion}
              onApproveBudgetExpansion={handleApproveBudgetExpansion}
              onProposeExternalIncome={handleProposeExternalIncome}
              onApproveExternalIncome={handleApproveExternalIncome}
              onUpdateActivity={handleUpdateActivity}
            />
          )}

          {activeTab === "reports" && (
            <FinancialReports 
              transactions={state.transactions}
              users={state.users}
              setTab={setActiveTab}
              monthlyBills={state.monthlyBills}
              settings={state.settings}
            />
          )}

          {activeTab === "members" && (
            <MemberList 
              currentUser={currentUser!}
              users={state.users}
              monthlyBills={state.monthlyBills}
              onUpdateMember={handleUpdateMember}
              onAddMember={handleAddMember}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {activeTab === "profile" && (
            <ProfilePanel 
              currentUser={currentUser!}
              monthlyBills={state.monthlyBills}
              onUpdateMember={handleUpdateMember}
              onChangePassword={handleChangePassword}
            />
          )}

          {activeTab === "admin" && currentUser?.role === "treasurer" && (
            <AdminPanel 
              currentUser={currentUser!}
              users={state.users}
              payments={state.payments}
              monthlyBills={state.monthlyBills}
              transactions={state.transactions}
              settings={state.settings}
              passwordResets={state.passwordResets || []}
              onApprovePayment={handleApprovePayment}
              onRejectPayment={handleRejectPayment}
              onRecordCashPayment={handleRecordCashPayment}
              onUploadSlipAdmin={handleUploadSlipAdmin}
              onCreateMonthlyBills={handleCreateMonthlyBills}
              onDeleteMonthlyBills={handleDeleteMonthlyBills}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateSettings={handleUpdateSettings}
              onSendReminder={handleSendReminder}
              onResolveResetPassword={handleResolveResetPassword}
              onResetSystemData={handleResetSystemData}
            />
          )}
        </main>
      </div>

      {/* PromptPay QR Code Modal */}
      {showQrModal && state?.settings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-5 text-center relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all p-1"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center space-y-3">
              <div className="bg-[#002d62] text-white px-4 py-1.5 rounded-full font-bold flex items-center gap-1.5 text-xs tracking-wider">
                <QrCode size={14} /> {state.settings.bankName || "พร้อมเพย์"}
              </div>
              
              {/* If bankName is PromptPay OR promptpayQrUrl is present, show QR Code. Otherwise, show Bank logo/card */}
              {((!state.settings.bankName || state.settings.bankName.includes("พร้อมเพย์") || state.settings.bankName.toLowerCase().includes("prompt")) || state.settings.promptpayQrUrl) ? (
                <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 mt-2">
                  <img 
                    src={state.settings.promptpayQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=002d62&data=PromptPay:${state.settings.promptpayNumber.replace(/[^0-9]/g, "")}`} 
                    alt="PromptPay QR Code" 
                    className="w-44 h-44 object-contain"
                  />
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 rounded-2xl w-full text-left space-y-4 shadow-md relative overflow-hidden mt-2">
                  {/* Decorative background circle */}
                  <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 pointer-events-none">
                    <DollarSign size={120} />
                  </div>
                  <div>
                    <p className="text-[10px] text-blue-100 uppercase tracking-widest font-bold">ช่องทางโอนผ่านธนาคาร</p>
                    <p className="font-sans font-bold text-lg mt-0.5">{state.settings.bankName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-blue-100 uppercase tracking-widest font-bold">ชื่อบัญชี</p>
                    <p className="font-sans font-medium text-sm">{state.settings.promptpayName}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1 pt-2 w-full">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ชื่อบัญชีรับโอน</p>
                <h4 className="text-sm font-bold text-slate-800">{state.settings.promptpayName}</h4>
                
                <div className="mt-3 flex items-center justify-center gap-2 bg-slate-50 border border-slate-150 p-2.5 rounded-2xl w-full max-w-xs mx-auto">
                  <div className="text-left flex-1 min-w-0 px-1">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">เลขบัญชี / เบอร์พร้อมเพย์</p>
                    <p className="text-sm font-mono font-bold text-slate-800 truncate">{state.settings.promptpayNumber}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(state.settings.promptpayNumber);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      copiedText 
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
                        : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 active:scale-95"
                    }`}
                    title="คัดลอกเลขบัญชี"
                  >
                    {copiedText ? (
                      <>
                        <Check size={14} className="animate-bounce text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-600">คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span className="text-[10px] font-bold">คัดลอก</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowQrModal(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-all"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center h-14 px-2 md:hidden z-30 shadow-lg shadow-slate-300/40 pb-safe">
        <button
          onClick={() => {
            setActiveTab("dashboard");
            setShowMobileMore(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${
            activeTab === "dashboard" ? "text-blue-600 font-extrabold" : "text-slate-400"
          }`}
        >
          <TrendingUp size={20} />
          <span className="text-[9px] font-bold">ภาพรวม</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("monthly");
            setShowMobileMore(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all relative ${
            activeTab === "monthly" ? "text-blue-600 font-extrabold" : "text-slate-400"
          }`}
        >
          <DollarSign size={20} />
          <span className="text-[9px] font-bold">ชำระเงิน</span>
          {/* Highlight billing dot if unpaid exists */}
          {state?.monthlyBills?.some((b: MonthlyBill) => b.userId === currentUser?.id && b.status !== "paid") && (
            <span className="absolute top-2.5 right-[30%] w-2 h-2 bg-rose-500 rounded-full border border-white animate-ping" />
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("market");
            setShowMobileMore(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${
            activeTab === "market" ? "text-blue-600 font-extrabold" : "text-slate-400"
          }`}
        >
          <ShoppingBag size={20} />
          <span className="text-[9px] font-bold">ตลาดพุธ</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("activities");
            setShowMobileMore(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${
            activeTab === "activities" ? "text-blue-600 font-extrabold" : "text-slate-400"
          }`}
        >
          <Award size={20} />
          <span className="text-[9px] font-bold">โครงการ</span>
        </button>

        <button
          onClick={() => {
            setShowMobileMore(!showMobileMore);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${
            showMobileMore || ["reports", "members", "profile", "admin"].includes(activeTab)
              ? "text-blue-600 font-extrabold"
              : "text-slate-400"
          }`}
        >
          <Menu size={20} />
          <span className="text-[9px] font-bold">เมนูอื่น ๆ</span>
        </button>
      </nav>

      {/* Mobile More Menu Bottom Sheet */}
      {showMobileMore && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden flex items-end justify-center"
          onClick={() => setShowMobileMore(false)}
        >
          <div 
            className="bg-white w-full rounded-t-[2.5rem] p-6 pb-8 border-t border-slate-100 shadow-2xl space-y-5 relative max-w-md animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle line indicator */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" onClick={() => setShowMobileMore(false)} />
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-800">เมนูระบบทั้งหมด</h3>
              <button 
                onClick={() => setShowMobileMore(false)}
                className="bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 transition-all p-2 rounded-2xl"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  setActiveTab("reports");
                  setShowMobileMore(false);
                }}
                className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold border transition-all text-left ${
                  activeTab === "reports"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${activeTab === "reports" ? "bg-blue-600 text-white" : "bg-white text-slate-500 shadow-sm"}`}>
                  <FileText size={16} />
                </div>
                <span>การเงินโปร่งใส</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("members");
                  setShowMobileMore(false);
                }}
                className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold border transition-all text-left ${
                  activeTab === "members"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${activeTab === "members" ? "bg-blue-600 text-white" : "bg-white text-slate-500 shadow-sm"}`}>
                  <Users size={16} />
                </div>
                <span>รายชื่อสมาชิก</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("profile");
                  setShowMobileMore(false);
                }}
                className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold border transition-all text-left ${
                  activeTab === "profile"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${activeTab === "profile" ? "bg-blue-600 text-white" : "bg-white text-slate-500 shadow-sm"}`}>
                  <UserIcon size={16} />
                </div>
                <span>ข้อมูลส่วนตัว</span>
              </button>

              {currentUser?.role === "treasurer" && (
                <button
                  onClick={() => {
                    setActiveTab("admin");
                    setShowMobileMore(false);
                  }}
                  className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold border transition-all text-left col-span-2 ${
                    activeTab === "admin"
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${activeTab === "admin" ? "bg-rose-600 text-white" : "bg-white text-rose-500 shadow-sm"}`}>
                    <Lock size={16} />
                  </div>
                  <span>จัดการระบบ (เหรัญญิก)</span>
                </button>
              )}
            </div>

            {/* Quick Promptpay display in Mobile menu */}
            {state?.settings && (
              <div 
                onClick={() => {
                  setShowMobileMore(false);
                  setShowQrModal(true);
                }}
                className="bg-[#002d62] text-white rounded-3xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#002550] transition-all relative overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl shrink-0">
                    <QrCode size={18} className="text-blue-200" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">QR Code โอนเงินกองกลาง</h4>
                    <p className="text-[10px] text-blue-200">{state.settings.promptpayName} - {state.settings.promptpayNumber}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-blue-300" />
              </div>
            )}

            <button 
              onClick={() => {
                handleLogout();
                setShowMobileMore(false);
              }}
              className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm border border-rose-100"
            >
              <LogOut size={14} /> ออกจากระบบอย่างปลอดภัย
            </button>

            <button 
              onClick={() => setShowMobileMore(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-2xl text-xs transition-all text-center"
            >
              ปิดหน้าต่างเมนู
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
