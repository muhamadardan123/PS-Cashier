import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { FileSpreadsheet, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import ExcelJS from "exceljs";
import "./Analytics.css";

// ═════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const formatDateExcel = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatDateShort = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
};

const formatRupiah = (num) => {
  if (num === null || num === undefined) return "Rp 0";
  return `Rp ${Number(num).toLocaleString("id-ID")}`;
};

const getMonthRange = (yearMonth) => {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

const getMonthLabel = (yearMonth) => {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" }).toUpperCase();
};

const groupByWeek = (transactions, yearMonth) => {
  const [year, month] = yearMonth.split("-").map(Number);
  const weeks = [
    { name: "Minggu 1", start: 1, end: 7 },
    { name: "Minggu 2", start: 8, end: 14 },
    { name: "Minggu 3", start: 15, end: 21 },
    { name: "Minggu 4", start: 22, end: 31 },
  ];

  return weeks.map((week) => {
    const weekTotal = transactions.reduce((sum, t) => {
      const tDate = new Date(t.created_at);
      const tDay = tDate.getDate();
      const tMonth = tDate.getMonth() + 1;
      const tYear = tDate.getFullYear();

      if (
        tYear === year &&
        tMonth === month &&
        tDay >= week.start &&
        tDay <= week.end
      ) {
        return sum + (t.total_price || 0);
      }
      return sum;
    }, 0);

    return { name: week.name, value: weekTotal };
  });
};

const groupByDay = (transactions, yearMonth) => {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  const monthName = MONTH_NAMES[month - 1];

  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ name: `${i} ${monthName}`, value: 0 });
  }

  transactions.forEach((t) => {
    const tDate = new Date(t.created_at);
    const tDay = tDate.getDate();
    const tMonth = tDate.getMonth() + 1;
    const tYear = tDate.getFullYear();

    if (tYear === year && tMonth === month) {
      days[tDay - 1].value += (t.total_price || 0);
    }
  });

  return days;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">
          {Number(payload[0].value).toLocaleString("id-ID")} IDR
        </p>
      </div>
    );
  }
  return null;
};

// ═════════════════════════════════════════════════════════════════════════════
// MONTH PICKER COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
function MonthPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const [y] = value.split("-").map(Number);
    return y;
  });
  const containerRef = useRef(null);

  const [selectedYear, selectedMonth] = value.split("-").map(Number);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Sync viewYear when value changes from outside
  useEffect(() => {
    const [y] = value.split("-").map(Number);
    setViewYear(y);
  }, [value]);

  const handleSelect = (monthIndex) => {
    const monthStr = String(monthIndex + 1).padStart(2, "0");
    onChange(`${viewYear}-${monthStr}`);
    setOpen(false);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    onChange(`${y}-${m}`);
    setViewYear(y);
    setOpen(false);
  };

  const handleClear = () => {
    // Reset ke bulan ini
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    onChange(`${y}-${m}`);
    setViewYear(y);
    setOpen(false);
  };

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    yearOptions.push(y);
  }

  const displayLabel = getMonthLabel(value);

  return (
    <div className="month-picker" ref={containerRef}>
      <button
        className="month-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <Calendar size={16} />
        <span>{displayLabel}</span>
      </button>

      {open && (
        <div className="month-picker-dropdown">
          {/* Year selector */}
          <div className="month-picker-header">
            <button
              className="month-picker-nav"
              onClick={() => setViewYear((y) => y - 1)}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              className="month-picker-year-select"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              className="month-picker-nav"
              onClick={() => setViewYear((y) => y + 1)}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month grid */}
          <div className="month-picker-grid">
            {MONTH_NAMES.map((name, idx) => {
              const isSelected =
                idx + 1 === selectedMonth && viewYear === selectedYear;
              return (
                <button
                  key={name}
                  className={`month-picker-cell${isSelected ? " active" : ""}`}
                  onClick={() => handleSelect(idx)}
                  type="button"
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="month-picker-footer">
            <button className="month-picker-btn text" onClick={handleClear} type="button">
              Hapus
            </button>
            <button className="month-picker-btn primary" onClick={handleThisMonth} type="button">
              Bulan ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function Analytics() {
  // Default ke bulan & tahun saat ini
  const getCurrentYearMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const [month, setMonth] = useState(getCurrentYearMonth);
  const [psTransactions, setPsTransactions] = useState([]);
  const [snackTransactions, setSnackTransactions] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { startISO, endISO } = getMonthRange(month);

      // ── Fetch PS & Snack (utama) ──
      const { data: psData, error: psError } = await supabase
        .from("transactions_ps")
        .select("*, playstations(name)")
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .order("created_at", { ascending: true });

      if (psError) throw psError;

      const { data: snackData, error: snackError } = await supabase
        .from("transactions_snack")
        .select("*")
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .order("created_at", { ascending: true });

      if (snackError) throw snackError;

      setPsTransactions(psData || []);
      setSnackTransactions(snackData || []);

      // ── Fetch Stock (terpisah, jika gagal tidak mengganggu PS & Snack) ──
      try {
        const { data: stockData, error: stockError } = await supabase
          .from("stocks")
          .select("*, snacks(id, name, price)")
          .order("updated_at", { ascending: false });

        if (stockError) throw stockError;
        setStockItems(stockData || []);
      } catch (stockErr) {
        console.warn("Stock fetch failed:", stockErr.message);
        setStockItems([]);
      }

    } catch (error) {
      console.error("Error fetching analytics:", error.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const psChartData = useMemo(
    () => groupByWeek(psTransactions, month),
    [psTransactions, month]
  );

  const psDailyChartData = useMemo(
    () => groupByDay(psTransactions, month),
    [psTransactions, month]
  );

  const snackChartData = useMemo(
    () => groupByWeek(snackTransactions, month),
    [snackTransactions, month]
  );

  const snackDailyChartData = useMemo(
    () => groupByDay(snackTransactions, month),
    [snackTransactions, month]
  );

  const totalPS = useMemo(
    () => psTransactions.reduce((sum, t) => sum + (t.total_price || 0), 0),
    [psTransactions]
  );

  const totalSnack = useMemo(
    () => snackTransactions.reduce((sum, t) => sum + (t.total_price || 0), 0),
    [snackTransactions]
  );

  const totalAll = totalPS + totalSnack;
  const monthLabel = getMonthLabel(month);

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORT EXCEL WITH STYLING (exceljs) - 3 SHEETS
  // ═══════════════════════════════════════════════════════════════════════
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PS Cashier";
    workbook.created = new Date();

    // ── Styles ──────────────────────────────────────────────────────────
    const headerStyle = {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } },
      font: { color: { argb: "FFFFFFFF" }, bold: true, size: 11 },
      alignment: { horizontal: "center", vertical: "middle" },
      border: {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      },
    };

    const totalStyle = {
      font: { bold: true, size: 11 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } },
      border: {
        top: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "double", color: { argb: "FF000000" } },
      },
    };

    const normalStyle = {
      border: {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      },
    };

    // ═══ Sheet 1: TransaksiPS ═══
    const wsPS = workbook.addWorksheet("TransaksiPS");

    const psHeaders = [
      "No",
      "Tanggal",
      "Nama TV",
      "Nama Pelanggan",
      "Durasi (Jam)",
      "Harga/Jam",
      "Total Harga",
    ];
    wsPS.addRow(psHeaders);
    wsPS.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    psTransactions.forEach((t, index) => {
      const row = wsPS.addRow([
        String(index + 1),
        formatDateExcel(t.created_at),
        t.playstations?.name || "-",
        t.customer_name || "-",
        String(t.duration_hours || 0),
        t.price_per_hour || 0,
        t.total_price || 0,
      ]);
      row.eachCell((cell) => {
        cell.style = normalStyle;
      });
      row.getCell(6).numFmt = '"Rp"#,##0';
      row.getCell(7).numFmt = '"Rp"#,##0';
    });

    if (psTransactions.length > 0) {
      const totalRow = wsPS.addRow([
        "",
        "",
        "",
        "",
        "TOTAL",
        "",
        totalPS,
      ]);
      totalRow.eachCell((cell) => {
        cell.style = totalStyle;
      });
      totalRow.getCell(5).numFmt = "@";
      totalRow.getCell(7).numFmt = '"Rp"#,##0';
    }

    wsPS.columns = [
      { width: 6 },
      { width: 14 },
      { width: 22 },
      { width: 20 },
      { width: 16 },
      { width: 14 },
      { width: 16 },
    ];

    // ═══ Sheet 2: TransaksiSnack ═══
    const wsSnack = workbook.addWorksheet("TransaksiSnack");

    const snackHeaders = [
      "No",
      "Tanggal",
      "Nama Item",
      "Jumlah",
      "Harga Modal (Sat)",
      "Harga Jual (Sat)",
      "Total Harga",
      "Keuntungan",
    ];
    wsSnack.addRow(snackHeaders);
    wsSnack.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    let totalSnackProfit = 0;

    snackTransactions.forEach((t, index) => {
      const stockItem = stockItems.find((s) => s.snacks?.name === t.snack_name);
      const modalSatuan = Number(stockItem?.harga_modal || 0);
      const qty = Number(t.quantity || 0);
      const jualSatuan = Number(t.price || 0);
      const totalJual = Number(t.total_price || 0);
      const totalModal = modalSatuan * qty;
      const profit = totalJual - totalModal;

      totalSnackProfit += profit;

      const row = wsSnack.addRow([
        String(index + 1),
        formatDateExcel(t.created_at),
        t.snack_name || "-",
        qty,
        modalSatuan,
        jualSatuan,
        totalJual,
        profit,
      ]);
      row.eachCell((cell) => {
        cell.style = normalStyle;
      });
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).numFmt = '"Rp"#,##0';
      row.getCell(6).numFmt = '"Rp"#,##0';
      row.getCell(7).numFmt = '"Rp"#,##0';
      row.getCell(8).numFmt = '"Rp"#,##0';
    });

    if (snackTransactions.length > 0) {
      const totalRow = wsSnack.addRow([
        "",
        "",
        "",
        "",
        "",
        "TOTAL",
        totalSnack,
        totalSnackProfit,
      ]);
      totalRow.eachCell((cell) => {
        cell.style = totalStyle;
      });
      totalRow.getCell(6).numFmt = "@";
      totalRow.getCell(7).numFmt = '"Rp"#,##0';
      totalRow.getCell(8).numFmt = '"Rp"#,##0';
    }

    wsSnack.columns = [
      { width: 6 },
      { width: 14 },
      { width: 22 },
      { width: 10 },
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
    ];

    // ═════════════════════════════════════════════════════════════════
    // ═══ Sheet 3: Stock Items (DIPERBAIKI) ═══
    // ═════════════════════════════════════════════════════════════════
    const wsStock = workbook.addWorksheet("Stock");

    const stockHeaders = [
      "No",
      "Snack ID",
      "Nama Snack",
      "Harga Modal",
      "Harga Jual",
      "Stok Tersedia",
      "Total Nilai Stok",
      "Terakhir Update",
    ];
    wsStock.addRow(stockHeaders);
    wsStock.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    let totalStockValue = 0;

    stockItems.forEach((item, index) => {
      const snack = item.snacks || {};
      const snackName = snack.name || "-";
      const hargaModal = Number(item.harga_modal || 0);
      const price = Number(snack.price || 0);
      const quantity = Number(item.quantity || 0);
      const totalValue = price * quantity;
      totalStockValue += totalValue;

      const row = wsStock.addRow([
        String(index + 1),
        item.snack_id || "-",
        snackName,
        hargaModal,
        price,
        quantity,
        totalValue,
        formatDateExcel(item.updated_at),
      ]);

      row.eachCell((cell) => {
        cell.style = normalStyle;
      });

      row.getCell(4).numFmt = '"Rp"#,##0';
      row.getCell(5).numFmt = '"Rp"#,##0';
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '"Rp"#,##0';
      row.getCell(6).value = quantity;
    });

    if (stockItems.length > 0) {
      const totalRow = wsStock.addRow([
        "",
        "",
        "",
        "",
        "TOTAL",
        stockItems.length,
        totalStockValue,
        "",
      ]);
      totalRow.eachCell((cell) => {
        cell.style = totalStyle;
      });
      totalRow.getCell(6).numFmt = '#,##0';
      totalRow.getCell(7).numFmt = '"Rp"#,##0';
    }

    wsStock.columns = [
      { width: 6 },
      { width: 38 },
      { width: 24 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
    ];

    // ── Download ──────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan_PS_Cashier_${month.replace("-", "_")}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-loading">Memuat data analytics...</div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header-row">
        <div className="analytics-left">
          <div className="analytics-title">
            <h1>Financial Analytics</h1>
            <p>Laporan pendapatan bulanan PS &amp; Snack</p>
          </div>

          <div className="analytics-actions">
            <MonthPicker value={month} onChange={setMonth} />

            <button className="export-btn" onClick={exportToExcel}>
              <FileSpreadsheet size={16} />
              Export Excel
            </button>
          </div>
        </div>

        <div className="summary-card">
          <h3 className="summary-title">RINGKASAN {monthLabel}</h3>
          <span className="summary-label">TOTAL PENDAPATAN</span>
          <h2 className="income-total">
            {totalAll.toLocaleString("id-ID")} IDR{" "}
            <span className="arrow-up">↗</span>
          </h2>

          <div className="summary-bottom">
            <div>
              <span className="summary-label">TOTAL PS RENTAL</span>
              <h4 className="color-pink">
                {totalPS.toLocaleString("id-ID")} IDR
              </h4>
              <small style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>
                {psTransactions.length} transaksi
              </small>
            </div>
            <div>
              <span className="summary-label">TOTAL SNACK</span>
              <h4 className="color-purple">
                {totalSnack.toLocaleString("id-ID")} IDR
              </h4>
              <small style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>
                {snackTransactions.length} transaksi
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="transactions-section">
        <div className="transaction-table-card">
          <div className="table-header">
            <h3>Transaksi PlayStation</h3>
            <span className="transaction-count">
              {psTransactions.length} transaksi
            </span>
          </div>
          <div className="table-scroll">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>TV</th>
                  <th>Pelanggan</th>
                  <th>Durasi</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {psTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-cell">
                      Tidak ada data transaksi PS
                    </td>
                  </tr>
                ) : (
                  psTransactions.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDateShort(t.created_at)}</td>
                      <td>{t.playstations?.name || "-"}</td>
                      <td>{t.customer_name || "-"}</td>
                      <td>{t.duration_hours} Jam</td>
                      <td className="price-cell">
                        {formatRupiah(t.total_price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="transaction-table-card">
          <div className="table-header">
            <h3>Transaksi Snack</h3>
            <span className="transaction-count">
              {snackTransactions.length} transaksi
            </span>
          </div>
          <div className="table-scroll">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Item</th>
                  <th>Jumlah</th>
                  <th>Harga</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {snackTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-cell">
                      Tidak ada data transaksi Snack
                    </td>
                  </tr>
                ) : (
                  snackTransactions.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDateShort(t.created_at)}</td>
                      <td>{t.snack_name}</td>
                      <td>{t.quantity}</td>
                      <td>{formatRupiah(t.price)}</td>
                      <td className="price-cell">
                        {formatRupiah(t.total_price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card cyan-border">
          <h2 className="chart-title">INCOME RENTAL PS</h2>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={psChartData}
                margin={{ top: 35, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="psGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#88e7ff" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0b53ff" stopOpacity={0.9} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="rgba(255,255,255,0.07)"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#8ab4cc", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#8ab4cc", fontSize: 11 }}
                  tickFormatter={(v) => `${v / 1000}k`}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(136,231,255,0.06)" }}
                />

                <Bar
                  dataKey="value"
                  fill="url(#psGradient)"
                  radius={[8, 8, 0, 0]}
                  barSize={52}
                  label={{
                    position: "top",
                    formatter: (v) => `${(v / 1000).toFixed(0)}k IDR`,
                    fill: "#88e7ff",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card purple-border">
          <h2 className="chart-title">INCOME SNACK</h2>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={snackChartData}
                margin={{ top: 35, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="snackGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0b6ff" stopOpacity={1} />
                    <stop offset="100%" stopColor="#7d2cff" stopOpacity={0.9} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="rgba(255,255,255,0.07)"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#b99acc", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#b99acc", fontSize: 11 }}
                  tickFormatter={(v) => `${v / 1000}k`}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(167,139,250,0.06)" }}
                />

                <Bar
                  dataKey="value"
                  fill="url(#snackGradient)"
                  radius={[8, 8, 0, 0]}
                  barSize={52}
                  label={{
                    position: "top",
                    formatter: (v) => `${(v / 1000).toFixed(0)}k IDR`,
                    fill: "#f0b6ff",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: "24px" }}>
        <div className="chart-card cyan-border">
          <h2 className="chart-title">DAILY RENTAL PS</h2>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={psDailyChartData}
                margin={{ top: 35, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#8ab4cc", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#8ab4cc", fontSize: 11 }}
                  tickFormatter={(v) => `${v / 1000}k`}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#00f2fe"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#00f2fe", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "#fff", stroke: "#00f2fe", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card purple-border">
          <h2 className="chart-title">DAILY SNACK</h2>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={snackDailyChartData}
                margin={{ top: 35, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#b99acc", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "#b99acc", fontSize: 11 }}
                  tickFormatter={(v) => `${v / 1000}k`}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f0b6ff"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#f0b6ff", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "#fff", stroke: "#f0b6ff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}