import { useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Gamepad2, User, Lock, Eye, EyeOff } from "lucide-react"; // Mengganti Mail dengan User icon
import "./Login.css";

export default function Login() {
  const [username, setUsername] = useState(""); // Mengubah email menjadi username
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cari email berdasarkan username di tabel profiles secara otomatis
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name") // Kita kemarin menyimpan email di kolom full_name
        .eq("username", username.trim())
        .single();

      if (profileError || !profileData) {
        throw new Error("Username tidak ditemukan!");
      }

      const email = profileData.full_name; // Mengambil email asli milik username tersebut

      // 2. Lakukan login ke Supabase Auth menggunakan email tersembunyi tadi
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error("Password salah atau akun tidak valid!");
      }

      // Jika sukses, arahkan ke dashboard
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Elemen pendaran cahaya di background */}
      <div className="glow-bg glow-1"></div>
      <div className="glow-bg glow-2"></div>
      <div className="glow-bg glow-3"></div>

      {/* Kartu Utama Transparan */}
      <div className="glass-card">
        <div className="icon-wrapper">
          <Gamepad2 className="game-icon" size={42} />
        </div>

        <h2>Welcome Back</h2>
        <p className="subtitle">Silahkan login untuk melanjutkan</p>

        <form onSubmit={handleLogin}>
          {/* Kolom Input USERNAME (Bukan Email) */}
          <div className="input-group">
            <User className="input-icon" size={18} /> {/* Ikon diganti jadi User */}
            <input
              type="text"
              placeholder="Username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Kolom Input Password */}
          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="eye-icon-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Tombol Login */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}