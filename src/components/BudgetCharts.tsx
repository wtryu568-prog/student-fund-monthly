/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Transaction } from "../types";
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart, 
  Activity,
  ShoppingBag,
  DollarSign,
  Briefcase,
  HelpCircle,
  Calendar
} from "lucide-react";

interface MonthlyTrendPoint {
  month: number;
  year: number;
  income: number;
  expense: number;
  balance: number;
  label: string;
  fullLabel: string;
  x?: number;
  y?: number;
}

interface DonutChartSegment {
  key: string;
  value: number;
  label: string;
  color: string;
  hoverColor: string;
  icon: React.ReactNode;
  percentage: number;
}

interface BudgetChartsProps {
  transactions: Transaction[];
}

export default function BudgetCharts({ transactions }: BudgetChartsProps) {
  // Tabs for sub-chart types: "distribution" (Slices) or "trend" (Cash Flow Over Time)
  const [activeChartTab, setActiveChartTab] = useState<"distribution" | "trend">("distribution");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [activeMonthTooltip, setActiveMonthTooltip] = useState<MonthlyTrendPoint | null>(null);

  // 1. Process Data for Slices (Incomes & Expenses category breakdowns)
  const stats = useMemo(() => {
    let incomeSum = 0;
    let expenseSum = 0;

    const incomeCategories = {
      monthly_fee: { value: 0, label: "ค่าบำรุงกองทุน", color: "#2563EB", hoverColor: "#3B82F6", icon: <DollarSign size={14} /> },
      market_profit: { value: 0, label: "กำไรตลาดวันพุธ", color: "#10B981", hoverColor: "#34D399", icon: <ShoppingBag size={14} /> },
      other_income: { value: 0, label: "รายรับอื่น", color: "#8B5CF6", hoverColor: "#A78BFA", icon: <ArrowUpRight size={14} /> },
    };

    const expenseCategories = {
      activity_expense: { value: 0, label: "งบกิจกรรม", color: "#EF4444", hoverColor: "#F87171", icon: <Activity size={14} /> },
      other_expense: { value: 0, label: "รายจ่ายอื่น", color: "#F59E0B", hoverColor: "#FBBF24", icon: <ArrowDownRight size={14} /> },
    };

    transactions.forEach(tx => {
      const amount = tx.amount;
      if (tx.type === "income") {
        incomeSum += amount;
        if (tx.category in incomeCategories) {
          incomeCategories[tx.category as keyof typeof incomeCategories].value += amount;
        }
      } else {
        expenseSum += amount;
        if (tx.category in expenseCategories) {
          expenseCategories[tx.category as keyof typeof expenseCategories].value += amount;
        }
      }
    });

    return {
      incomeSum,
      expenseSum,
      incomes: Object.entries(incomeCategories).map(([key, item]) => ({
        key,
        ...item,
        percentage: incomeSum > 0 ? (item.value / incomeSum) * 100 : 0
      })),
      expenses: Object.entries(expenseCategories).map(([key, item]) => ({
        key,
        ...item,
        percentage: expenseSum > 0 ? (item.value / expenseSum) * 100 : 0
      }))
    };
  }, [transactions]);

  // 2. Process Monthly Cash Flow Trend Data
  const trendData = useMemo(() => {
    // Group by month and year
    const monthlyGroups: { [key: string]: { month: number; year: number; income: number; expense: number } } = {};

    transactions.forEach(tx => {
      const key = `${tx.year}-${tx.month}`;
      if (!monthlyGroups[key]) {
        monthlyGroups[key] = {
          month: tx.month,
          year: tx.year,
          income: 0,
          expense: 0
        };
      }
      if (tx.type === "income") {
        monthlyGroups[key].income += tx.amount;
      } else {
        monthlyGroups[key].expense += tx.amount;
      }
    });

    // Sort chronologically
    const sortedKeys = Object.keys(monthlyGroups).sort((a, b) => {
      const [yearA, monthA] = a.split("-").map(Number);
      const [yearB, monthB] = b.split("-").map(Number);
      return yearA !== yearB ? yearA - yearB : monthA - monthB;
    });

    let cumulativeBalance = 0;
    const items = sortedKeys.map(key => {
      const group = monthlyGroups[key];
      cumulativeBalance += (group.income - group.expense);
      return {
        ...group,
        balance: cumulativeBalance,
        label: getThaiMonthAbbr(group.month, group.year),
        fullLabel: `เดือน${getThaiMonthName(group.month)} พ.ศ. ${group.year}`
      };
    });

    return items;
  }, [transactions]);

  // SVG Helper function for Donut Chart
  const renderDonutChart = (data: DonutChartSegment[], title: string, subtitle: string, totalVal: number, prefix: string = "฿") => {
    const radius = 50;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercentage = 0;

    // Filter out zero value segments to avoid layout bugs
    const validSegments = data.filter(s => s.value > 0);

    if (validSegments.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-52 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <HelpCircle className="text-slate-300 mb-2" size={24} />
          <p className="text-xs font-semibold">ยังไม่มีข้อมูลในส่วนนี้</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4">
        {/* SVG Circle Rendering */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />
            {validSegments.map((segment) => {
              const dashArray = `${(segment.percentage / 100) * circumference} ${circumference}`;
              const dashOffset = circumference - (accumulatedPercentage / 100) * circumference;
              accumulatedPercentage += segment.percentage;

              const isHovered = hoveredSlice === segment.key;

              return (
                <circle
                  key={segment.key}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredSlice(segment.key)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  style={{
                    filter: isHovered ? `drop-shadow(0 4px 6px ${segment.color}40)` : "none"
                  }}
                />
              );
            })}
          </svg>

          {/* Center Info Panel */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-white/40 rounded-full">
            {hoveredSlice ? (
              (() => {
                const seg = data.find(s => s.key === hoveredSlice);
                if (!seg) return null;
                return (
                  <div className="animate-fade-in">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">{seg.label}</span>
                    <span className="text-base font-bold font-display text-slate-800 block">
                      {prefix}{seg.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="bg-slate-100 text-slate-600 font-bold rounded-full text-[9px] px-1.5 py-0.5 inline-block mt-0.5">
                      {seg.percentage.toFixed(1)}%
                    </span>
                  </div>
                );
              })()
            ) : (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{title}</span>
                <span className="text-md font-bold font-display text-slate-800 block">
                  {prefix}{totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block mt-0.5">{subtitle}</span>
              </div>
            )}
          </div>
        </div>

        {/* Legend Panel */}
        <div className="flex-1 w-full space-y-2.5">
          {data.map((segment) => {
            const isHovered = hoveredSlice === segment.key;
            return (
              <div
                key={segment.key}
                onMouseEnter={() => setHoveredSlice(segment.key)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isHovered 
                    ? "border-slate-200 bg-slate-50 shadow-sm translate-x-1" 
                    : "border-transparent hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center text-white"
                    style={{ backgroundColor: segment.color }}
                  >
                    {/* Tiny visual representation */}
                  </div>
                  <span className="font-semibold text-slate-700">{segment.label}</span>
                </div>
                <div className="text-right text-xs">
                  <span className="font-bold font-display text-slate-800 block">
                    {prefix}{segment.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {segment.percentage.toFixed(1)}% ของทั้งหมด
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Visual Tab Selection */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-indigo-600" /> วิเคราะห์งบประมาณและสัดส่วนการเงิน
          </h3>
          <p className="text-[11px] text-slate-400">ภาพรวมสถิติกองทุน รายรับประจำหมวด และแนวโน้มกระแสเงินสดห้องเรียน</p>
        </div>
        <div className="bg-slate-100 p-0.5 rounded-xl flex gap-1 text-[11px] font-bold">
          <button
            onClick={() => setActiveChartTab("distribution")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === "distribution" 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📊 สัดส่วนสไลด์ (Pie Breakdown)
          </button>
          <button
            onClick={() => setActiveChartTab("trend")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === "trend" 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📈 แนวโน้มกระแสเงินสด (Cash Flow Trend)
          </button>
        </div>
      </div>

      {activeChartTab === "distribution" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Breakdown */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div>
              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-0.5">
                🟢 รายรับ (Incomes Summary)
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                การเปรียบเทียบแหล่งที่มาของเงินกองทุนห้องเรียนว่ามาจากส่วนใดมากที่สุด
              </p>
            </div>
            {renderDonutChart(stats.incomes, "รายรับรวม", "ยอดสะสมทั้งหมด", stats.incomeSum)}
          </div>

          {/* Expense Breakdown */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div>
              <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-0.5">
                🔴 รายจ่าย (Expenses Summary)
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                การแสดงสัดส่วนงบประมาณกิจกรรม (กีฬาเฟรชชี่, ปัจฉิมนิเทศ) เทียบกับรายจ่ายหมวดอื่น
              </p>
            </div>
            {renderDonutChart(stats.expenses, "รายจ่ายรวม", "ยอดจ่ายสะสมทั้งหมด", stats.expenseSum)}
          </div>
        </div>
      ) : (
        /* Cash Flow Trend (Interactive SVG Line & Bar Chart) */
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-0.5">
                📈 กระแสเงินสดสะสม (Cash Flow Statement Trend)
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                เปรียบเทียบยอดรวมรายรับ (สีเขียว) รายจ่าย (สีแดง) และยอดเงินสำรองคงคลังสะสมจริง (เส้นสีน้ำเงิน) เป็นรายเดือน
              </p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> รายรับรายเดือน</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> รายจ่ายรายเดือน</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-600 inline-block relative -top-0.5"></span> ยอดเงินคงเหลือสะสม</span>
            </div>
          </div>

          {trendData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="text-slate-300 mb-2" size={24} />
              <p className="text-xs font-semibold">ยังไม่มีประวัติบัญชีรายเดือนที่จะนำมาสรุปแนวโน้ม</p>
            </div>
          ) : (
            (() => {
              // Calculate limits for charting scale
              const maxVal = Math.max(
                ...trendData.map(d => Math.max(d.income, d.expense, d.balance, 1000))
              );
              const paddingPercent = 1.15; // Give some margin on top of graph
              const chartMaxY = maxVal * paddingPercent;

              // Dimensions of SVG
              const width = 800;
              const height = 280;
              const paddingX = 60;
              const paddingY = 30;

              const chartWidth = width - paddingX * 2;
              const chartHeight = height - paddingY * 2;

              // Map each month index to X and Y coordinates
              const points = trendData.map((d, index) => {
                const x = paddingX + (index / Math.max(trendData.length - 1, 1)) * chartWidth;
                const yBalance = height - paddingY - (d.balance / chartMaxY) * chartHeight;
                const yIncome = height - paddingY - (d.income / chartMaxY) * chartHeight;
                const yExpense = height - paddingY - (d.expense / chartMaxY) * chartHeight;
                return {
                  x,
                  yBalance,
                  yIncome,
                  yExpense,
                  data: d
                };
              });

              // Generate SVG Path for Balance Line
              let balancePath = "";
              if (points.length > 0) {
                if (points.length === 1) {
                  // For a single point, make a short horizontal line
                  balancePath = `M ${points[0].x - 20} ${points[0].yBalance} L ${points[0].x + 20} ${points[0].yBalance}`;
                } else {
                  balancePath = points.reduce((path, p, idx) => {
                    return path + `${idx === 0 ? "M" : "L"} ${p.x} ${p.yBalance} `;
                  }, "");
                }
              }

              return (
                <div className="relative w-full overflow-x-auto pt-4">
                  {/* The interactive SVG Container */}
                  <div className="min-w-[650px] relative">
                    <svg className="w-full h-auto" viewBox={`0 0 ${width} ${height}`}>
                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = paddingY + ratio * chartHeight;
                        const labelValue = chartMaxY * (1 - ratio);
                        return (
                          <g key={idx} className="opacity-40">
                            <line 
                              x1={paddingX} 
                              y1={y} 
                              x2={width - paddingX} 
                              y2={y} 
                              stroke="#E2E8F0" 
                              strokeWidth={1}
                              strokeDasharray="4 4"
                            />
                            <text 
                              x={paddingX - 10} 
                              y={y + 4} 
                              textAnchor="end" 
                              className="fill-slate-400 font-mono text-[9px] font-bold"
                            >
                              ฿{Math.round(labelValue).toLocaleString()}
                            </text>
                          </g>
                        );
                      })}

                      {/* Bar charts for income & expense */}
                      {points.map((p, idx) => {
                        const barWidth = Math.min(18, chartWidth / (trendData.length * 2.5));
                        const xIncome = p.x - barWidth - 2;
                        const xExpense = p.x + 2;
                        const barHeightIncome = (p.data.income / chartMaxY) * chartHeight;
                        const barHeightExpense = (p.data.expense / chartMaxY) * chartHeight;

                        return (
                          <g key={idx}>
                            {/* Income Bar */}
                            {p.data.income > 0 && (
                              <rect
                                x={xIncome}
                                y={height - paddingY - barHeightIncome}
                                width={barWidth}
                                height={barHeightIncome}
                                fill="#10B981"
                                rx={2}
                                className="opacity-85 hover:opacity-100 transition-all duration-200 cursor-pointer"
                                onMouseEnter={(e) => setActiveMonthTooltip({ ...p.data, x: p.x, y: p.yBalance })}
                                onMouseLeave={() => setActiveMonthTooltip(null)}
                              />
                            )}
                            {/* Expense Bar */}
                            {p.data.expense > 0 && (
                              <rect
                                x={xExpense}
                                y={height - paddingY - barHeightExpense}
                                width={barWidth}
                                height={barHeightExpense}
                                fill="#EF4444"
                                rx={2}
                                className="opacity-85 hover:opacity-100 transition-all duration-200 cursor-pointer"
                                onMouseEnter={(e) => setActiveMonthTooltip({ ...p.data, x: p.x, y: p.yBalance })}
                                onMouseLeave={() => setActiveMonthTooltip(null)}
                              />
                            )}

                            {/* Label for month */}
                            <text
                              x={p.x}
                              y={height - paddingY + 16}
                              textAnchor="middle"
                              className="fill-slate-500 font-semibold text-[10px]"
                            >
                              {p.data.label}
                            </text>
                          </g>
                        );
                      })}

                      {/* Cumulative Balance Trend Line */}
                      {balancePath && (
                        <path
                          d={balancePath}
                          fill="none"
                          stroke="#2563EB"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="drop-shadow-lg"
                        />
                      )}

                      {/* Dots on the line chart for interactivity */}
                      {points.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.yBalance}
                          r={activeMonthTooltip?.month === p.data.month && activeMonthTooltip?.year === p.data.year ? 7 : 4}
                          fill="#FFFFFF"
                          stroke="#2563EB"
                          strokeWidth={3}
                          className="cursor-pointer transition-all duration-150"
                          onMouseEnter={() => setActiveMonthTooltip({ ...p.data, x: p.x, y: p.yBalance })}
                          onMouseLeave={() => setActiveMonthTooltip(null)}
                        />
                      ))}
                    </svg>

                    {/* Beautiful Interactive Tooltip */}
                    {activeMonthTooltip && (
                      <div 
                        className="absolute bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl border border-slate-700/50 text-xs space-y-1.5 z-20 pointer-events-none transition-all duration-150"
                        style={{
                          left: `${(activeMonthTooltip.x / width) * 100}%`,
                          top: `${(activeMonthTooltip.y / height) * 100 - 90}%`,
                          transform: "translateX(-50%)"
                        }}
                      >
                        <p className="font-bold border-b border-slate-700 pb-1 text-slate-200">
                          📌 {activeMonthTooltip.fullLabel}
                        </p>
                        <div className="space-y-1 font-mono text-[11px]">
                          <div className="flex justify-between gap-6 text-emerald-400">
                            <span>🟢 รายรับประจำเดือน:</span>
                            <span>฿{activeMonthTooltip.income.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-6 text-rose-400">
                            <span>🔴 รายจ่ายประจำเดือน:</span>
                            <span>฿{activeMonthTooltip.expense.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-6 text-blue-400 border-t border-slate-800 pt-1 font-bold">
                            <span>📘 ยอดคงคลังสะสม:</span>
                            <span>฿{activeMonthTooltip.balance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-[10px] text-slate-400 mt-2 italic">
                    💡 คำแนะนำ: นำเมาส์ไปชี้หรือจิ้มที่ จุดเชื่อมโยง หรือ แท่งกราฟ เพื่อดูรายละเอียดและเงินหมุนเวียนคงคลังประจำเดือนนั้นๆ ได้เลยค่ะ
                  </p>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

// Helper formatting functions
function getThaiMonthAbbr(month: number, year: number) {
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  return `${months[month - 1]} ${year % 100}`;
}

function getThaiMonthName(month: number) {
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  return months[month - 1];
}
