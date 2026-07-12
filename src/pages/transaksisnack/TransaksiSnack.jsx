import { useMemo, useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import {
  ShoppingBag,
  Package2,
  PlusCircle,
  Search,
  Wallet,
  Boxes,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "./TransaksiSnack.css";

const ITEMS_PER_PAGE = 4;

export default function TransaksiSnack() {
  const [sales, setSales] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    itemName: "",
    category: "",
    quantity: 1,
    price: "",
    paymentMethod: "Cash",
    note: "",
  });

  // ── Format Helpers ───────────────────────────────────────────────────
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return Number(num).toLocaleString("id-ID");
  };

  const formatRupiah = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "Rp 0";
    return "Rp " + Number(num).toLocaleString("id-ID");
  };

  // ── Fetch Sales from Supabase ──────────────────────────────────────────
  const fetchSales = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("transactions_snack")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((item) => ({
        id: item.id,
        itemName: item.snack_name,
        category: item.category || "-",
        quantity: item.quantity,
        price: item.price,
        total: item.total_price,
        paymentMethod: item.payment_method || "Cash",
        createdAt: new Date(item.created_at).toLocaleString("id-ID"),
        note: "",
      }));

      setSales(mapped);
    } catch (error) {
      console.error("Error fetching snack sales:", error.message);
    }
  }, []);

  // ── Fetch Stocks with JOIN to snacks table ─────────────────────────────
  const fetchStocks = useCallback(async () => {
    try {
      console.log("[DEBUG] Fetching stocks...");

      // 🔥 JOIN dengan tabel snacks (tanpa category)
      const { data, error } = await supabase
        .from("stocks")
        .select(`
          id,
          quantity,
          min_stock,
          updated_at,
          snacks:snack_id (
            id,
            name,
            price
          )
        `)
        .order("updated_at", { ascending: false });

      console.log("[DEBUG] Stocks with snacks:", data);

      if (error) {
        console.error("[DEBUG] Stock fetch error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log("[DEBUG] No stock data returned");
        setStocks([]);
        return;
      }

      // Mapping data (tanpa category karena tidak ada di tabel snacks)
      const mapped = data.map((item) => {
        const snack = item.snacks;
        return {
          id: item.id,
          snack_id: snack?.id || null,
          item_name: snack?.name || "-",
          price: Number(snack?.price || 0),
          category: "", // Category diisi manual oleh user
          quantity: Number(item.quantity || 0),
          min_stock: Number(item.min_stock || 5),
          updated_at: item.updated_at || new Date().toISOString(),
        };
      });

      console.log("[DEBUG] Mapped stocks:", mapped);
      setStocks(mapped);
    } catch (error) {
      console.error("Error fetching stocks:", error.message);
      setStocks([]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSales(), fetchStocks()]);
    setLoading(false);
  }, [fetchSales, fetchStocks]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Calculations ─────────────────────────────────────────────────────
  const totalSales = useMemo(
    () => sales.reduce((sum, item) => sum + (item.total || 0), 0),
    [sales]
  );

  const totalItems = useMemo(
    () => sales.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [sales]
  );

  const totalStockValue = useMemo(
    () => stocks.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0),
    [stocks]
  );

  const lowStockCount = useMemo(
    () => stocks.filter((item) => (item.quantity || 0) <= (item.min_stock || 5) && (item.quantity || 0) > 0).length,
    [stocks]
  );

  const filteredSales = useMemo(() => {
    const keyword = search.toLowerCase();
    return sales.filter(
      (item) =>
        (item.itemName || "").toLowerCase().includes(keyword) ||
        (item.category || "").toLowerCase().includes(keyword) ||
        (item.paymentMethod || "").toLowerCase().includes(keyword)
    );
  }, [sales, search]);

  // ── Pagination ───────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedSales = useMemo(
    () =>
      filteredSales.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [filteredSales, currentPage]
  );

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 3;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const computedTotal = useMemo(() => {
    const quantity = Number(form.quantity) || 0;
    const price = Number(form.price) || 0;
    return quantity * price;
  }, [form.quantity, form.price]);

  // ── Stock Helpers ────────────────────────────────────────────────────
  const getStockByName = useCallback(
    (name) => {
      if (!name) return null;
      return stocks.find(
        (s) => (s.item_name || "").toLowerCase().trim() === (name || "").toLowerCase().trim()
      );
    },
    [stocks]
  );

  const getStockStatus = useCallback(
    (name) => {
      if (!name || !name.trim()) return { exists: false, qty: 0, minStock: 5, status: "no_stock" };
      const stock = getStockByName(name);
      if (!stock) return { exists: false, qty: 0, minStock: 5, status: "no_stock" };
      const qty = stock.quantity || 0;
      const min = stock.min_stock || 5;
      if (qty <= 0) return { exists: true, qty: 0, minStock: min, status: "out" };
      if (qty <= min) return { exists: true, qty, minStock: min, status: "low" };
      return { exists: true, qty, minStock: min, status: "ok" };
    },
    [getStockByName]
  );

  // ── Form Handlers ──────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "itemName") {
      const stock = getStockByName(value);
      if (stock) {
        setForm((prev) => ({
          ...prev,
          [name]: value,
          price: stock.price || "",
          // Category tetap dipertahankan, tidak diisi otomatis dari stock
        }));
        return;
      }
    }
    
    setForm((prev) => ({
      ...prev,
      [name]: name === "quantity" ? Number(value) : value,
    }));
  };

  // ── Transaksi Snack (Jual) ────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.itemName.trim() || !form.price) {
      toast.error("Nama item dan harga wajib diisi!");
      return;
    }

    // Refresh stok terbaru sebelum validasi
    await fetchStocks();
    
    const stockStatus = getStockStatus(form.itemName);

    // Cek stok habis
    if (!stockStatus.exists || stockStatus.qty <= 0) {
      toast.error(`Stok "${form.itemName}" habis! Tidak bisa melakukan transaksi.\n\nSilakan tambah stok di halaman Stock Management.`);
      return;
    }

    // Cek stok cukup
    if (stockStatus.qty < form.quantity) {
      toast.error(`Stok tidak cukup!\nTersedia: ${stockStatus.qty} item\nDibutuhkan: ${form.quantity} item\n\nSilakan tambah stok.`);
      return;
    }

    try {
      // 1. Insert ke transactions_snack
      const { error: transError } = await supabase
        .from("transactions_snack")
        .insert({
          snack_name: form.itemName.trim(),
          category: form.category.trim() || "-",
          quantity: Number(form.quantity),
          price: Number(form.price),
          total_price: computedTotal,
          payment_method: form.paymentMethod,
          created_at: new Date().toISOString(),
        });

      if (transError) throw transError;

      // 2. Kurangi stok di table stocks
      const stock = getStockByName(form.itemName);
      if (stock) {
        const newQty = Math.max(0, (stock.quantity || 0) - (Number(form.quantity) || 0));
        
        console.log(`[DEBUG] Update stok: ${stock.item_name} dari ${stock.quantity} ke ${newQty}`);
        
        const { error: stockError } = await supabase
          .from("stocks")
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", stock.id);

        if (stockError) {
          console.error("Error updating stock:", stockError);
          toast.error("⚠️ Transaksi tersimpan, tetapi gagal mengurangi stok. Silakan update stok manual.");
        } else {
          console.log("[DEBUG] Stock updated successfully");
        }
      }

      // Reset form
      setForm({
        itemName: "",
        category: "",
        quantity: 1,
        price: "",
        paymentMethod: "Cash",
        note: "",
      });

      // Refresh data
      await fetchAll();
      
      // Trigger refresh dashboard
      localStorage.setItem('dashboardNeedRefresh', 'true');
      window.dispatchEvent(new CustomEvent('refreshDashboard'));
      
      toast.success("Penjualan berhasil disimpan! Stok telah dikurangi.");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Gagal menyimpan penjualan: " + error.message);
    }
  };

  const isSubmitDisabled = useMemo(() => {
    const status = getStockStatus(form.itemName).status;
    return (
      !form.itemName.trim() ||
      !form.price ||
      status === "out" ||
      status === "no_stock"
    );
  }, [form.itemName, form.price, getStockStatus]);

  if (loading) {
    return (
      <div className="snack-transaction-page">
        <div className="snack-transaction-content">
          <div className="analytics-loading">Memuat data penjualan...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="snack-transaction-page">
      <div className="snack-glow snack-glow-cyan"></div>
      <div className="snack-glow snack-glow-purple"></div>

      <div className="snack-transaction-content">
        <header className="snack-page-header">
          <div>
            <h1>Transaksi Snack</h1>
            <p>Input penjualan snack, minuman, dan lihat total penjualan harian.</p>
          </div>

          <div className="snack-header-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari item / kategori / metode bayar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        {/* Low Stock Alert Banner */}
        {stocks.some((s) => (s.quantity || 0) <= (s.min_stock || 5) && (s.quantity || 0) > 0) && (
          <div className="low-stock-alert-banner">
            <AlertTriangle size={20} />
            <div className="low-stock-content">
              <strong>Perhatian:</strong> Beberapa item stok menipis!
              <div className="low-stock-items">
                {stocks
                  .filter((s) => (s.quantity || 0) <= (s.min_stock || 5) && (s.quantity || 0) > 0)
                  .map((s) => (
                    <span key={s.id} className="low-stock-tag">
                      {s.item_name} ({s.quantity} tersisa)
                    </span>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Stock Out Alert Banner */}
        {stocks.some((s) => (s.quantity || 0) <= 0) && (
          <div className="low-stock-alert-banner" style={{ background: 'rgba(255,75,92,0.12)', borderColor: 'rgba(255,75,92,0.35)' }}>
            <AlertTriangle size={20} />
            <div className="low-stock-content">
              <strong>Stok Habis:</strong> Item berikut tidak bisa ditransaksikan!
              <div className="low-stock-items">
                {stocks
                  .filter((s) => (s.quantity || 0) <= 0)
                  .map((s) => (
                    <span key={s.id} className="low-stock-tag" style={{ background: 'rgba(255,75,92,0.2)' }}>
                      {s.item_name}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        )}

        <section className="snack-summary-grid">
          <div className="snack-summary-card">
            <div className="snack-summary-icon cyan">
              <Wallet size={20} />
            </div>
            <div>
              <span>Total Penjualan</span>
              <h3>{formatRupiah(totalSales)}</h3>
            </div>
          </div>

          <div className="snack-summary-card">
            <div className="snack-summary-icon blue">
              <Boxes size={20} />
            </div>
            <div>
              <span>Total Qty Terjual</span>
              <h3>{totalItems} item</h3>
            </div>
          </div>

          <div className="snack-summary-card">
            <div className="snack-summary-icon purple">
              <ShoppingBag size={20} />
            </div>
            <div>
              <span>Total Transaksi</span>
              <h3>{sales.length} transaksi</h3>
            </div>
          </div>

          <div className="snack-summary-card">
            <div className="snack-summary-icon green">
              <Package2 size={20} />
            </div>
            <div>
              <span>Nilai Stok</span>
              <h3>{formatRupiah(totalStockValue)}</h3>
            </div>
          </div>

          <div className="snack-summary-card">
            <div className="snack-summary-icon red">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span>Stok Menipis</span>
              <h3>{lowStockCount} item</h3>
            </div>
          </div>

          <div className="snack-summary-card">
            <div className="snack-summary-icon blue">
              <Boxes size={20} />
            </div>
            <div>
              <span>Total Jenis Stok</span>
              <h3>{stocks.length} item</h3>
            </div>
          </div>
        </section>

        <section className="snack-grid-layout">
          <div className="snack-glass-panel form-panel">
            <div className="snack-panel-title-row">
              <h2>Input Snack</h2>
              <span className="snack-panel-badge">Point of Sale</span>
            </div>

            <form className="snack-form" onSubmit={handleSubmit}>
              <div className="snack-form-group">
                <label>Nama Item</label>
                <input
                  type="text"
                  name="itemName"
                  value={form.itemName}
                  onChange={handleChange}
                  placeholder="Contoh: Pop Mie, Teh Botol"
                  list="stock-items"
                  autoComplete="off"
                />
                <datalist id="stock-items">
                  {stocks.map((s) => (
                    <option key={s.id} value={s.item_name} />
                  ))}
                </datalist>
              </div>

              {/* Stock Status Indicator */}
              {form.itemName.trim() && (
                <div className="snack-stock-indicator">
                  {(() => {
                    const status = getStockStatus(form.itemName);
                    if (status.status === "out") {
                      return (
                        <span className="stock-badge stock-out">
                          <AlertTriangle size={14} /> Stok Habis — Tidak bisa transaksi
                        </span>
                      );
                    }
                    if (status.status === "low") {
                      return (
                        <span className="stock-badge stock-low">
                          <AlertTriangle size={14} /> Stok Menipis: {status.qty} tersisa
                        </span>
                      );
                    }
                    if (status.status === "ok") {
                      return (
                        <span className="stock-badge stock-ok">
                          <Package2 size={14} /> Stok Tersedia: {status.qty} item
                        </span>
                      );
                    }
                    return (
                      <span className="stock-badge stock-none">
                        <AlertTriangle size={14} /> Belum ada data stok — tambah di halaman Stock
                      </span>
                    );
                  })()}
                </div>
              )}

              <div className="snack-form-row">
                <div className="snack-form-group">
                  <label>Kategori</label>
                  <input
                    type="text"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="Ketik kategori (opsional)..."
                  />
                </div>
                <div className="snack-form-group">
                  <label>Qty</label>
                  <input
                    type="number"
                    min="1"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="snack-form-row">
                <div className="snack-form-group">
                  <label>Harga Satuan</label>
                  <div className="snack-amount-input">
                    <span>Rp</span>
                    <input
                      type="number"
                      min="0"
                      name="price"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="Masukkan harga"
                    />
                  </div>
                </div>

                <div className="snack-form-group">
                  <label>Metode Bayar</label>
                  <select
                    name="paymentMethod"
                    value={form.paymentMethod}
                    onChange={handleChange}
                  >
                    <option value="Cash">Cash</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>
              </div>

              <div className="snack-total-box">
                <span>Total Transaksi</span>
                <strong>Rp {computedTotal.toLocaleString("id-ID")}</strong>
              </div>

              <div className="snack-form-group">
                <label>Catatan</label>
                <textarea
                  name="note"
                  rows="4"
                  value={form.note}
                  onChange={handleChange}
                  placeholder="Catatan tambahan jika diperlukan"
                />
              </div>

              <button
                type="submit"
                className="snack-submit-btn"
                disabled={isSubmitDisabled}
              >
                <PlusCircle size={18} />
                Simpan Penjualan
              </button>
            </form>
          </div>

          <div className="snack-glass-panel list-panel">
            <div className="snack-panel-title-row">
              <h2>Riwayat Snack</h2>
              <span className="snack-panel-badge">{filteredSales.length} data</span>
            </div>

            <div className="snack-list">
              {paginatedSales.length === 0 ? (
                <div className="snack-empty-state">
                  <Package2 size={34} />
                  <p>Belum ada data penjualan yang cocok dengan pencarian.</p>
                </div>
              ) : (
                paginatedSales.map((item) => (
                  <div key={item.id} className="snack-card">
                    <div className="snack-card-top">
                      <div>
                        <h3>{item.itemName}</h3>
                        <p>{item.category}</p>
                      </div>
                      <span className="snack-method-badge">{item.paymentMethod}</span>
                    </div>

                    <div className="snack-meta">
                      <span>Qty {item.quantity}</span>
                      <span>Rp {(item.price || 0).toLocaleString("id-ID")}</span>
                      <span>{item.createdAt}</span>
                    </div>

                    <div className="snack-card-bottom">
                      <strong>Rp {(item.total || 0).toLocaleString("id-ID")}</strong>
                      <button type="button">Detail</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {filteredSales.length > 0 && (
              <div className="pagination-wrapper">
                <span className="pagination-info">
                  Total {formatNumber(filteredSales.length)} data
                </span>

                <div className="pagination-controls">
                  <button
                    type="button"
                    className="page-btn page-nav"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {getPageNumbers()[0] > 1 && (
                    <>
                      <button
                        type="button"
                        className="page-btn"
                        onClick={() => goToPage(1)}
                      >
                        1
                      </button>
                      {getPageNumbers()[0] > 2 && (
                        <span className="page-ellipsis">...</span>
                      )}
                    </>
                  )}

                  {getPageNumbers().map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={`page-btn ${page === currentPage ? "page-active" : ""}`}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  ))}

                  {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
                    <>
                      {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && (
                        <span className="page-ellipsis">...</span>
                      )}
                      <button
                        type="button"
                        className="page-btn"
                        onClick={() => goToPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="page-btn page-nav"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight size={16} />
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