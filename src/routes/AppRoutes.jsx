import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

// 🔥 PERHATIKAN PERBEDAAN HURUF BESAR/KECILNYA!
const Login = lazy(() => import("../pages/login/Login"));          // ✅ login (huruf kecil)
const Dashboard = lazy(() => import("../pages/dashboard/Dashboard")); // ✅ dashboard (huruf kecil)
const Analytics = lazy(() => import("../pages/analytics/Analytics"));
const Layout = lazy(() => import("../components/layout/Layout"));
const TransaksiPs = lazy(() => import("../pages/transaksiPS/TransaksiPS")); // ✅ TransaksiPS (S besar)
const TransaksiSnack = lazy(() => import("../pages/transaksisnack/TransaksiSnack"));
const Stock = lazy(() => import("../pages/stock/Stock"));

// 🔥 Komponen Loading
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      color: '#00f2fe',
      background: '#0b0c1e',
      fontSize: '18px',
      fontFamily: 'Inter, sans-serif',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(0, 242, 254, 0.1)',
        borderTop: '3px solid #00f2fe',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span>Memuat...</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// 🔥 Komponen 404
function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      color: 'white',
      background: '#0b0c1e',
      fontFamily: 'Inter, sans-serif',
      gap: '12px'
    }}>
      <div style={{
        fontSize: '72px',
        fontWeight: '700',
        color: '#00f2fe',
        textShadow: '0 0 40px rgba(0, 242, 254, 0.3)'
      }}>
        404
      </div>
      <div style={{
        fontSize: '24px',
        color: 'rgba(255, 255, 255, 0.6)'
      }}>
        Halaman Tidak Ditemukan
      </div>
      <a href="/dashboard" style={{
        marginTop: '20px',
        padding: '12px 32px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
        color: '#0a0a0a',
        textDecoration: 'none',
        fontWeight: '600',
        transition: 'all 0.3s ease'
      }}>
        Kembali ke Dashboard
      </a>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/transaksi-ps" element={<TransaksiPs />} />
            <Route path="/transaksi-snack" element={<TransaksiSnack />} />
            <Route path="/stock" element={<Stock />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}