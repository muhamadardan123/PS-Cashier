import "./Layout.css";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import Sidebar from "./Sidebar";

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Gagal logout:", error.message);
    }
  };

  return (
    <div className="layout">
      <Sidebar handleLogout={handleLogout} />
      <div className="layout-main">
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}