import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login/Login";
import Dashboard from "../pages/Dashboard/Dashboard";
import Analytics from "../pages/analytics/Analytics";
import Layout from "../components/layout/Layout"; 
import TransaksiPs from "../pages/transaksiPS/TransaksiPs";
import TransaksiSnack from "../pages/transaksisnack/TransaksiSnack";
import Stock from "../pages/stock/Stock"; // <-- TAMBAHKAN INI

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect awal */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Auth (Halaman login berdiri sendiri, tanpa sidebar) */}
        <Route path="/login" element={<Login />} />

        {/* Rute Utama yang dibungkus oleh Layout (Akan memiliki Sidebar & Topbar) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/transaksi-ps" element={<TransaksiPs />} />
          <Route path="/transaksi-snack" element={<TransaksiSnack />} />
          <Route path="/stock" element={<Stock />} /> {/* <-- TAMBAHKAN INI */}
          
          {/* Tambahkan rute lainnya di sini saat file sudah dibuat */}
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}