import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Box,
  AlertTriangle,
  Edit3,
  Trash2,
  X,
  Save,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import toast, { Toaster } from "react-hot-toast";
import "./Stock.css";

export default function Stock() {
  const [stockItems, setStockItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    snack_name: "",
    price: "",
    harga_modal: "",
    quantity: "",
  });

  // State untuk display format Rupiah (dengan titik)
  const [displayPrice, setDisplayPrice] = useState("");
  const [displayCostPrice, setDisplayCostPrice] = useState("");

  // ── Fetch Data ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: stockData, error: stockError } = await supabase
        .from("stocks")
        .select("*, snacks(id, name, price)")
        .order("updated_at", { ascending: false });

      if (stockError) throw stockError;
      setStockItems(stockData || []);
    } catch (error) {
      console.error("Error fetching stock:", error.message);
      toast.error("Gagal memuat data stok: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filter ──
  const filteredStock = stockItems.filter((item) => {
    const snackName = item.snacks?.name?.toLowerCase() || "";
    return snackName.includes(searchQuery.toLowerCase());
  });

  const lowStockCount = stockItems.filter((item) => (item.quantity || 0) <= 5).length;
  const totalItems = stockItems.length;
  const totalStockValue = stockItems.reduce((sum, item) => {
    const price = item.snacks?.price || 0;
    const qty = item.quantity || 0;
    return sum + price * qty;
  }, 0);

  // ── Format Helpers ──
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return Number(num).toLocaleString("id-ID");
  };

  const formatRupiah = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "Rp 0";
    return "Rp " + Number(num).toLocaleString("id-ID");
  };

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Format Rupiah Input Handler ──
  const handlePriceInput = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, ""); // Hanya ambil angka
    const numericValue = rawValue === "" ? "" : parseInt(rawValue, 10);

    setFormData((prev) => ({ ...prev, price: numericValue }));
    setDisplayPrice(rawValue === "" ? "" : formatNumber(numericValue));
  };

  const handleCostPriceInput = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    const numericValue = rawValue === "" ? "" : parseInt(rawValue, 10);

    setFormData((prev) => ({ ...prev, harga_modal: numericValue }));
    setDisplayCostPrice(rawValue === "" ? "" : formatNumber(numericValue));
  };

  // ── Form Handlers ──
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const quantity = parseInt(formData.quantity) || 0;
      const price = parseInt(formData.price) || 0;

      if (editingId) {
        // UPDATE existing stock
        // NOTE: costPrice harus dideklarasikan SEBELUM dipakai di query update,
        // ini yang sebelumnya menyebabkan error "Cannot access before initialization"
        const costPrice = parseInt(formData.harga_modal) || 0;

        const { error: stockError } = await supabase
          .from("stocks")
          .update({
            quantity: quantity,
            harga_modal: costPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (stockError) throw stockError;

        // Update harga snack juga
        const stockItem = stockItems.find((s) => s.id === editingId);
        if (stockItem && stockItem.snacks && price > 0) {
          const { error: snackError } = await supabase
            .from("snacks")
            .update({ price: price })
            .eq("id", stockItem.snack_id);

          if (snackError) throw snackError;
        }
      } else {
        // INSERT new stock
        const { data: existingSnack, error: findError } = await supabase
          .from("snacks")
          .select("id, name")
          .ilike("name", formData.snack_name.trim())
          .single();

        let snackId;

        if (existingSnack) {
          snackId = existingSnack.id;

          const { data: existingStock } = await supabase
            .from("stocks")
            .select("id")
            .eq("snack_id", snackId)
            .single();

          if (existingStock) {
            toast.error(`Snack "${formData.snack_name}" sudah memiliki stok! Silakan edit stok yang ada.`);
            return;
          }
        } else {
          const { data: newSnack, error: insertSnackError } = await supabase
            .from("snacks")
            .insert({
              name: formData.snack_name.trim(),
              price: price,
            })
            .select()
            .single();

          if (insertSnackError) throw insertSnackError;
          snackId = newSnack.id;
        }

        const { error: insertStockError } = await supabase.from("stocks").insert({
          snack_id: snackId,
          quantity: quantity,
          harga_modal: parseInt(formData.harga_modal) || 0,
        });

        if (insertStockError) throw insertStockError;
      }

      toast.success("Data stok berhasil disimpan!");
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving stock:", error.message);
      toast.error("Gagal menyimpan: " + error.message);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    const itemPrice = item.snacks?.price || "";
    const itemCostPrice = item.harga_modal || "";
    setFormData({
      snack_name: item.snacks?.name || "",
      price: itemPrice,
      harga_modal: itemCostPrice,
      quantity: item.quantity || "",
    });
    setDisplayPrice(itemPrice === "" ? "" : formatNumber(itemPrice));
    setDisplayCostPrice(itemCostPrice === "" ? "" : formatNumber(itemCostPrice));
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus item stok ini?")) return;

    try {
      const { error } = await supabase.from("stocks").delete().eq("id", id);
      if (error) throw error;
      toast.success("Stok berhasil dihapus!");
      fetchData();
    } catch (error) {
      console.error("Error deleting stock:", error.message);
      toast.error("Gagal menghapus: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      snack_name: "",
      price: "",
      harga_modal: "",
      quantity: "",
    });
    setDisplayPrice("");
    setDisplayCostPrice("");
    setEditingId(null);
    setShowModal(false);
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="stock-page">
        <div className="stock-loading">Memuat data stok...</div>
      </div>
    );
  }

  return (
    <div className="stock-page">
      <Toaster position="top-right" />
      <div className="stock-header">
        <h1 className="stock-title">STOCK MANAGEMENT</h1>
        <p className="stock-subtitle">Kelola stok snack & minuman rental PS</p>
      </div>

      {/* Stats Cards */}
      <div className="stock-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-bg blue">
            <Box size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatNumber(totalItems)}</span>
            <span className="stat-label">Total Items</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-bg red">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatNumber(lowStockCount)}</span>
            <span className="stat-label">Low Stock Alert</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-bg green">
            <Box size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatRupiah(totalStockValue)}</span>
            <span className="stat-label">Total Stock Value</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="stock-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Cari nama snack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <button className="btn-refresh" onClick={fetchData} title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button className="btn-add-stock" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            <span>Tambah Stok</span>
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="stock-table-container">
        <table className="stock-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Snack</th>
              <th>Harga Modal</th>
              <th>Harga Jual</th>
              <th>Stok</th>
              <th>Status</th>
              <th>Terakhir Update</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  {searchQuery
                    ? "Tidak ada snack yang cocok dengan pencarian"
                    : "Belum ada data stok. Klik 'Tambah Stok' untuk menambahkan."}
                </td>
              </tr>
            ) : (
              filteredStock.map((item, index) => {
                const snack = item.snacks || {};
                const qty = item.quantity || 0;
                const isLow = qty <= 5;

                return (
                  <tr key={item.id} className={isLow ? "row-low-stock" : ""}>
                    <td>{formatNumber(index + 1)}</td>
                    <td>
                      <div className="item-name">{snack.name || "-"}</div>
                    </td>
                    <td>{formatRupiah(item.harga_modal)}</td>
                    <td>{formatRupiah(snack.price)}</td>
                    <td>
                      <span className={`stock-count ${isLow ? "low" : ""}`}>
                        {formatNumber(qty)}
                      </span>
                    </td>
                    <td>
                      {isLow ? (
                        <span className="badge-status warning">
                          <AlertTriangle size={12} />
                          Stok Rendah
                        </span>
                      ) : (
                        <span className="badge-status ok">Tersedia</span>
                      )}
                    </td>
                    <td>{formatDate(item.updated_at)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-action edit"
                          onClick={() => handleEdit(item)}
                          title="Edit"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="btn-action delete"
                          onClick={() => handleDelete(item.id)}
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? "Edit Stok" : "Tambah Stok Baru"}</h2>
              <button className="btn-close" onClick={resetForm}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Nama Snack</label>
                <input
                  type="text"
                  name="snack_name"
                  value={formData.snack_name}
                  onChange={handleInputChange}
                  placeholder="Contoh: Indomie Goreng"
                  required
                  disabled={!!editingId}
                />
                {editingId && (
                  <small className="form-hint">Nama snack tidak dapat diubah saat edit</small>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Harga Modal</label>
                  <div className="input-rupiah">
                    <span className="rupiah-prefix">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={displayCostPrice}
                      onChange={handleCostPriceInput}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Harga Jual</label>
                  <div className="input-rupiah">
                    <span className="rupiah-prefix">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={displayPrice}
                      onChange={handlePriceInput}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Jumlah Stok</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={resetForm}>
                  Batal
                </button>
                <button type="submit" className="btn-save">
                  <Save size={16} />
                  <span>{editingId ? "Simpan Perubahan" : "Tambah Stok"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}