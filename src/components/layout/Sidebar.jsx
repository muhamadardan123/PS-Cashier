import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  Gamepad2,
  Cookie,
  Package,
  LogOut,
} from "lucide-react";
import "./Sidebar.css";

export default function Sidebar({ handleLogout }) {
  return (
    <aside className="sidebar-glass">
      <div className="sidebar-brand">
        <Gamepad2 size={26} className="brand-icon-neon" />
      </div>

      <nav className="sidebar-menu">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
        >
          <LayoutDashboard size={22} />
          <span>DASHBOARD</span>
        </NavLink>

        <NavLink
          to="/transaksi-ps"
          className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
        >
          <Gamepad2 size={22} />
          <span>TRANS. PS</span>
        </NavLink>

        <NavLink
          to="/transaksi-snack"
          className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
        >
          <Cookie size={22} />
          <span>TRANS. SNACK</span>
        </NavLink>

        <NavLink
          to="/stock"
          className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
        >
          <Package size={22} />
          <span>STOCK</span>
        </NavLink>

        <NavLink
          to="/analytics"
          className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
        >
          <TrendingUp size={22} />
          <span>ANALYTICS</span>
        </NavLink>

        {/* Menu Settings telah dihapus */}
      </nav>

      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          className="sidebar-logout-btn"
          title="Logout"
          type="button"
        >
          <LogOut size={22} />
        </button>
        <span className="version-text">v1.0.3</span>
      </div>
    </aside>
  );
}