/**
 * State Loader Service
 * Loads full application state from Supabase for frontend consumption
 */

import { supabase } from "../config/supabase";
import { convertKeysToCamel } from "../utils/camelCase";
import { REAL_STUDENTS } from "../data/seedStudents";
import { User, MonthlyBill, Payment, Transaction, MarketWeek, Activity, AppState, SystemSettings } from "../../src/types";

export async function loadFullState(): Promise<AppState> {
  let users: any[] | null = null;
  let settingsArr: any[] | null = null;
  let monthlyBills: any[] | null = null;
  let payments: any[] | null = null;
  let transactions: any[] | null = null;
  let marketWeeks: any[] | null = null;
  let marketItems: any[] | null = null;
  let marketTeams: any[] | null = null;
  let activities: any[] | null = null;
  let budgetRequests: any[] | null = null;
  let announcements: any[] | null = null;
  let notifications: any[] | null = null;
  let logs: any[] | null = null;
  let petitions: any[] | null = null;
  let passwordResets: any[] | null = null;

  try {
    const queries = [
      supabase.from("users").select("*").order("student_id"),
      supabase.from("settings").select("*"),
      supabase.from("monthly_bills").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("market_weeks").select("*").order("created_at", { ascending: false }),
      supabase.from("market_items").select("*"),
      supabase.from("market_teams").select("*"),
      supabase.from("activities").select("*").order("created_at", { ascending: false }),
      supabase.from("budget_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("petitions").select("*").order("created_at", { ascending: false }),
      supabase.from("password_resets").select("*").order("requested_at", { ascending: false }),
    ];
    const results = await Promise.allSettled(queries);
    const getData = (res: PromiseSettledResult<any>) => (res.status === "fulfilled" && !res.value.error ? res.value.data : null);

    users = getData(results[0]);
    settingsArr = getData(results[1]);
    monthlyBills = getData(results[2]);
    payments = getData(results[3]);
    transactions = getData(results[4]);
    marketWeeks = getData(results[5]);
    marketItems = getData(results[6]);
    marketTeams = getData(results[7]);
    activities = getData(results[8]);
    budgetRequests = getData(results[9]);
    announcements = getData(results[10]);
    notifications = getData(results[11]);
    logs = getData(results[12]);
    petitions = getData(results[13]);
    passwordResets = getData(results[14]);
  } catch (err: any) {
    console.warn("[StateLoader] Supabase query notice:", err?.message || err);
  }

  // Fallback users if empty or not reachable
  let finalUsers: User[] = [];
  if (users && users.length > 0) {
    finalUsers = convertKeysToCamel(users) as User[];
  } else {
    finalUsers = REAL_STUDENTS.map(item => {
      const studentId = `169214210${item.idSuffix}`;
      return {
        id: `usr_${studentId}`,
        studentId,
        fullName: item.name,
        nickname: item.nickname,
        email: studentId === "169214210002" ? "kritsana.khw@rmutsvmail.com" : `${studentId}@student.university.ac.th`,
        role: item.role as any,
        position: item.pos,
        phone: "",
        password: "123456",
        isActive: true,
        classroom: item.classroom,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  }

  const settings = (settingsArr && settingsArr.length > 0 
    ? convertKeysToCamel(settingsArr[0])
    : { fundName: "เงินเก็บTns รุ่น06", monthlyFee: 150, promptpayNumber: "081-234-5678", promptpayName: "นภาวรรณ แก้วดี (เหรัญญิกกองทุน)", promptpayQrUrl: "", bankName: "พร้อมเพย์" }) as unknown as SystemSettings & { id?: unknown };

  // Remove the singleton ID from settings
  if (settings.id) delete settings.id;

  return {
    users: finalUsers,
    settings: settings as SystemSettings,
    monthlyBills: convertKeysToCamel(monthlyBills || []) as MonthlyBill[],
    payments: convertKeysToCamel(payments || []) as Payment[],
    transactions: convertKeysToCamel(transactions || []) as Transaction[],
    marketWeeks: convertKeysToCamel(marketWeeks || []) as MarketWeek[],
    marketItems: convertKeysToCamel(marketItems || []) as any[],
    marketTeams: convertKeysToCamel(marketTeams || []) as any[],
    activities: convertKeysToCamel(activities || []) as Activity[],
    budgetRequests: convertKeysToCamel(budgetRequests || []) as any[],
    announcements: convertKeysToCamel(announcements || []) as any[],
    notifications: convertKeysToCamel(notifications || []) as any[],
    logs: convertKeysToCamel(logs || []) as any[],
    petitions: convertKeysToCamel(petitions || []) as any[],
    passwordResets: convertKeysToCamel(passwordResets || []) as any[],
  };
}
