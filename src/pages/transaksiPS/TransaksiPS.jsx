import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import {
  Gamepad2,
  Wallet,
  Clock3,
  PlusCircle,
  Search,
  ReceiptText,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "./TransaksiPS.css";

const PRICE_PER_HOUR = 15000;
const ITEMS_PER_PAGE = 5;

// 🔥 UPDATE: Semua 6 TV
const stationOptions = [
  "TV 01 - PlayStation 3",
  "TV 02 - PlayStation 3",
  "TV 03 - PlayStation 3",
  "TV 04 - PlayStation 3",
  "TV 05 - PlayStation 3",
  "TV 06 - PlayStation 3",
];

const formatRupiah = (value) => {
  const amount = Number(value || 0);
  const formatted = amount.toLocaleString("id-ID").replace(/,/g, ".");
  return `Rp.${formatted},00`;
};

const formatNumberWithDots = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("id-ID").replace(/,/g, ".");
};

const isValidTimeFormat = (value) => {
  const regex = /^\d{2}\.\d{2}\.\d{2}$/;
  if (!regex.test(value)) return false;
  const [hh, mm, ss] = value.split(".").map(Number);
  return hh >= 0 && mm >= 0 && mm < 60 && ss >= 0 && ss < 60;
};

const formatManualTimeInput = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 6));
  return parts.join(".");
};

const parseManualTimeToHours = (timeStr) => {
  if (!timeStr) return 0;
  const [hh, mm, ss] = timeStr.split(".").map(Number);
  return hh + mm / 60 + ss / 3600;
};

export default function TransaksiPs() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [stationList, setStationList] = useState(stationOptions); // 🔥 NEW

  const [form, setForm] = useState({
    station: stationOptions[0],
    customer: "",
    sessionType: "Per Jam",
    duration: 1,
    openPlayMode: "Aktif",
    manualTime: "",
    amount: "",
    paymentMethod: "Cash",
    note: "",
  });

  // ── Fetch Playstations dari Supabase ──────────────────────────────────
  const fetchPlaystations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("playstations")
        .select("name")
        .order("name", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const names = data.map(item => item.name);
        setStationList(names);
        // Set default ke yang pertama jika form masih kosong
        if (names.length > 0 && !form.station) {
          setForm(prev => ({ ...prev, station: names[0] }));
        }
      }
    } catch (error) {
      console.error("Error fetching playstations:", error.message);
      // Fallback ke static options
      setStationList(stationOptions);
    }
  }, []);

  // ── Fetch transactions from Supabase ───────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions_ps")
        .select("*, playstations(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((t) => ({
        id: t.id,
        station: t.playstations?.name || "Unknown",
        customer: t.customer_name || "-",
        sessionType: t.session_type || "Per Jam",
        duration: t.duration_hours || null,
        openPlayMode: t.session_type === "Open Play" ? "Aktif" : null,
        manualTime: null,
        amount: t.total_price || 0,
        paymentMethod: t.payment_method || "Cash",
        paymentStatus: t.payment_status || "paid",
        createdAt: new Date(t.created_at).toLocaleString("id-ID"),
        note: "",
      }));

      setTransactions(mapped);
    } catch (error) {
      console.error("Error fetching transactions:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load data awal ─────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      await fetchPlaystations();
      await fetchTransactions();
    };
    loadData();
  }, [fetchPlaystations, fetchTransactions]);

  // ── Reset page ke 1 saat search berubah ───────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // ── Tandai Lunas ───────────────────────────────────────────────────────
  const handleMarkAsPaid = async (transactionId) => {
    const confirmed = window.confirm("Tandai transaksi ini sebagai LUNAS?");
    if (!confirmed) return;

    try {
      setMarkingPaid(transactionId);

      const { error } = await supabase
        .from("transactions_ps")
        .update({ payment_status: "paid" })
        .eq("id", transactionId);

      if (error) throw error;

      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, paymentStatus: "paid" } : t
        )
      );

      // Trigger refresh dashboard
      localStorage.setItem('dashboardNeedRefresh', 'true');
      window.dispatchEvent(new CustomEvent('refreshDashboard'));
      
      alert("✅ Transaksi berhasil ditandai lunas!");

    } catch (error) {
      alert("❌ Gagal mengubah status: " + error.message);
    } finally {
      setMarkingPaid(null);
    }
  };

  // ── Filtered & Paginated ───────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    const keyword = search.toLowerCase();
    return transactions.filter(
      (item) =>
        item.station.toLowerCase().includes(keyword) ||
        item.customer.toLowerCase().includes(keyword) ||
        item.paymentMethod.toLowerCase().includes(keyword) ||
        item.sessionType.toLowerCase().includes(keyword)
    );
  }, [transactions, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  // ── Page numbers dengan ellipsis ──────────────────────────────────────
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  // ── Summary stats ──────────────────────────────────────────────────────
  const totalToday = useMemo(
    () => transactions.reduce((sum, item) => sum + item.amount, 0),
    [transactions]
  );

  const pendingCount = useMemo(
    () => transactions.filter((item) => item.paymentStatus === "pending").length,
    [transactions]
  );

  const pendingTotal = useMemo(
    () =>
      transactions
        .filter((item) => item.paymentStatus === "pending")
        .reduce((sum, item) => sum + item.amount, 0),
    [transactions]
  );

  // ── Form Handlers ──────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "sessionType") {
      setForm((prev) => ({
        ...prev,
        sessionType: value,
        duration: value === "Per Jam" ? prev.duration || 1 : 1,
        openPlayMode: "Aktif",
        manualTime: "",
      }));
      return;
    }

    if (name === "openPlayMode") {
      setForm((prev) => ({
        ...prev,
        openPlayMode: value,
        manualTime: value === "Masuk Manual" ? prev.manualTime : "",
      }));
      return;
    }

    if (name === "manualTime") {
      setForm((prev) => ({
        ...prev,
        manualTime: formatManualTimeInput(value),
      }));
      return;
    }

    if (name === "amount") {
      const numericValue = value.replace(/\D/g, "");
      setForm((prev) => ({ ...prev, amount: numericValue }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: name === "duration" ? Number(value) : value,
    }));
  };

  // ── Submit to Supabase ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customer.trim()) {
      alert("Nama pelanggan wajib diisi.");
      return;
    }

    if (form.amount === "" || Number(form.amount) <= 0) {
      alert("Amount wajib diisi.");
      return;
    }

    if (
      form.sessionType === "Open Play" &&
      form.openPlayMode === "Masuk Manual"
    ) {
      if (!form.manualTime || !isValidTimeFormat(form.manualTime)) {
        alert("Format jam manual harus hh.mm.ss, contoh 02.30.00");
        return;
      }
    }

    try {
      let durationHours = 0;
      let sessionType = form.sessionType;

      if (form.sessionType === "Per Jam") {
        durationHours = Number(form.duration);
      } else if (form.openPlayMode === "Masuk Manual") {
        durationHours = parseManualTimeToHours(form.manualTime);
        sessionType = "Open Play";
      } else {
        durationHours = 0;
        sessionType = "Open Play";
      }

      const { data: psData } = await supabase
        .from("playstations")
        .select("id")
        .eq("name", form.station)
        .single();

      const playstationId = psData?.id;

      const { error } = await supabase.from("transactions_ps").insert({
        playstation_id: playstationId,
        customer_name: form.customer.trim(),
        duration_hours: Math.ceil(durationHours),
        price_per_hour: PRICE_PER_HOUR,
        total_price: Number(form.amount),
        session_type: sessionType,
        payment_method: form.paymentMethod,
        payment_status: "pending",
      });

      if (error) throw error;

      setForm({
        station: stationList[0] || stationOptions[0],
        customer: "",
        sessionType: "Per Jam",
        duration: 1,
        openPlayMode: "Aktif",
        manualTime: "",
        amount: "",
        paymentMethod: "Cash",
        note: "",
      });

      setIsAmountFocused(false);
      setCurrentPage(1);
      await fetchTransactions();
      
      // Trigger refresh dashboard
      localStorage.setItem('dashboardNeedRefresh', 'true');
      window.dispatchEvent(new CustomEvent('refreshDashboard'));
      
      alert("Transaksi berhasil disimpan!");
    } catch (error) {
      alert("Gagal menyimpan transaksi: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="ps-transaction-page">
        <div className="ps-transaction-content">
          <div className="analytics-loading">Memuat data transaksi...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-transaction-page">
      <div className="page-glow page-glow-cyan"></div>
      <div className="page-glow page-glow-purple"></div>

      <div className="ps-transaction-content">
        <header className="ps-page-header">
          <div>
            <h1>Transaksi PS</h1>
            <p>Input transaksi rental PlayStation dan kelola riwayat pembayaran.</p>
          </div>

          <div className="ps-header-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari pelanggan / unit / metode bayar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        {/* ── Summary Cards ── */}
        <section className="ps-summary-grid">
          <div className="ps-summary-card">
            <div className="summary-icon cyan">
              <Wallet size={20} />
            </div>
            <div>
              <span>Total Hari Ini</span>
              <h3>{formatRupiah(totalToday)}</h3>
            </div>
          </div>

          <div className="ps-summary-card">
            <div className="summary-icon blue">
              <ReceiptText size={20} />
            </div>
            <div>
              <span>Total Transaksi</span>
              <h3>{transactions.length} transaksi</h3>
            </div>
          </div>

          <div className={`ps-summary-card ${pendingCount > 0 ? "summary-card-pending" : ""}`}>
            <div className="summary-icon amber">
              <AlertCircle size={20} />
            </div>
            <div>
              <span>Pending Pembayaran</span>
              <h3>{formatRupiah(pendingTotal)}</h3>
              <small className="pending-count-label">
                {pendingCount} transaksi belum lunas
              </small>
            </div>
          </div>
        </section>

        <section className="ps-grid-layout">
          {/* ── Form Panel ── */}
          <div className="glass-panel form-panel">
            <div className="panel-title-row">
              <h2>Input Transaksi PS</h2>
            </div>

            <form className="transaction-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Unit PS</label>
                <select name="station" value={form.station} onChange={handleChange}>
                  {stationList.map((station) => (
                    <option key={station} value={station}>{station}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Nama Pelanggan</label>
                <input
                  type="text"
                  name="customer"
                  value={form.customer}
                  onChange={handleChange}
                  placeholder="Masukkan nama pelanggan"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Jenis Billing</label>
                  <select name="sessionType" value={form.sessionType} onChange={handleChange}>
                    <option value="Per Jam">Per Jam</option>
                    <option value="Open Play">Open Play</option>
                  </select>
                </div>

                {form.sessionType === "Per Jam" ? (
                  <div className="form-group">
                    <label>Durasi</label>
                    <select name="duration" value={form.duration} onChange={handleChange}>
                      <option value={1}>1 Jam</option>
                      <option value={2}>2 Jam</option>
                      <option value={3}>3 Jam</option>
                      <option value={4}>4 Jam</option>
                      <option value={5}>5 Jam</option>
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Mode Open Play</label>
                    <select name="openPlayMode" value={form.openPlayMode} onChange={handleChange}>
                      <option value="Aktif">Aktif</option>
                      <option value="Masuk Manual">Masuk Manual</option>
                    </select>
                  </div>
                )}
              </div>

              {form.sessionType === "Open Play" &&
                form.openPlayMode === "Masuk Manual" && (
                  <div className="form-group">
                    <label>Jam Main Manual</label>
                    <input
                      type="text"
                      name="manualTime"
                      value={form.manualTime}
                      onChange={handleChange}
                      placeholder="Contoh: 02.30.00"
                      maxLength={8}
                    />
                    <small className="helper-text">
                      Gunakan format `hh.mm.ss`, contoh `01.45.30`
                    </small>
                  </div>
                )}

              <div className="form-group">
                <label>Metode Bayar</label>
                <select name="paymentMethod" value={form.paymentMethod} onChange={handleChange}>
                  <option value="Cash">Cash</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Amount</label>
                <div className="amount-input-container">
                  <span className="amount-prefix">Rp.</span>
                  <input
                    type="text"
                    name="amount"
                    value={form.amount === "" ? "" : formatNumberWithDots(form.amount)}
                    onChange={handleChange}
                    onFocus={() => setIsAmountFocused(true)}
                    onBlur={() => setIsAmountFocused(false)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                  <span className="amount-suffix">,00</span>
                </div>
              </div>

              <div className="form-group">
                <label>Catatan</label>
                <textarea
                  name="note"
                  rows="4"
                  value={form.note}
                  onChange={handleChange}
                  placeholder="Catatan tambahan jika diperlukan"
                />
              </div>

              <button type="submit" className="submit-btn">
                <PlusCircle size={18} />
                Simpan Transaksi
              </button>
            </form>
          </div>

          {/* ── List Panel ── */}
          <div className="glass-panel list-panel">
            <div className="panel-title-row">
              <h2>Riwayat Transaksi PS</h2>
              <span className="panel-badge">
                {filteredTransactions.length} data
              </span>
            </div>

            {/* ── Transaction Cards ── */}
            <div className="transaction-list">
              {paginatedTransactions.length === 0 ? (
                <div className="empty-state">
                  <Gamepad2 size={34} />
                  <p>Belum ada transaksi yang cocok dengan pencarian.</p>
                </div>
              ) : (
                paginatedTransactions.map((item) => (
                  <div
                    key={item.id}
                    className={`transaction-card ${item.paymentStatus === "pending" ? "card-pending" : ""}`}
                  >
                    <div className="transaction-card-top">
                      <div>
                        <h3>{item.station}</h3>
                        <p>{item.customer}</p>
                      </div>
                      <span className={`status-badge ${item.paymentStatus === "pending" ? "badge-pending" : "badge-paid"}`}>
                        {item.paymentStatus === "pending" ? "Pending" : "Lunas"}
                      </span>
                    </div>

                    <div className="transaction-meta">
                      <span>{item.sessionType}</span>
                      {item.sessionType === "Per Jam" ? (
                        <span>{item.duration} jam</span>
                      ) : item.openPlayMode === "Masuk Manual" ? (
                        <span>{item.manualTime}</span>
                      ) : (
                        <span>Open Play Aktif</span>
                      )}
                      <span>{item.paymentMethod}</span>
                      <span>{item.createdAt}</span>
                    </div>

                    <div className="transaction-card-bottom">
                      <strong>{formatRupiah(item.amount)}</strong>
                      <div className="card-actions">
                        {item.paymentStatus === "pending" && (
                          <button
                            type="button"
                            className="btn-mark-paid"
                            onClick={() => handleMarkAsPaid(item.id)}
                            disabled={markingPaid === item.id}
                          >
                            <CheckCircle2 size={14} />
                            {markingPaid === item.id ? "Memproses..." : "Tandai Lunas"}
                          </button>
                        )}
                        <button type="button" className="btn-detail">Detail</button>
                      </div>
                    </div>

                    {item.note && <p className="note-preview">{item.note}</p>}
                  </div>
                ))
              )}
            </div>

            {/* ── Pagination ── */}
            {filteredTransactions.length > 0 && (
              <div className="pagination-wrapper">
                <span className="pagination-info">
                  Total {filteredTransactions.length} data
                </span>

                <div className="pagination-controls">
                  {/* Tombol Prev */}
                  <button
                    className="page-btn page-nav"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {/* Nomor halaman */}
                  {pageNumbers.map((page, idx) =>
                    page === "..." ? (
                      <span key={`ellipsis-${idx}`} className="page-ellipsis">
                        ···
                      </span>
                    ) : (
                      <button
                        key={page}
                        className={`page-btn ${currentPage === page ? "page-active" : ""}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    )
                  )}

                  {/* Tombol Next */}
                  <button
                    className="page-btn page-nav"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}