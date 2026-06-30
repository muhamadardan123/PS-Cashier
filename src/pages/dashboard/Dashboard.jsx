import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import {
  Bell,
  DollarSign,
  FileText,
  Play,
  Timer,
  User,
  Clock,
  AlertTriangle,
  X,
  FlaskConical,
} from "lucide-react";
import "./Dashboard.css";
import bgRental from "../../assets/dashboard.png";

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════
const PLAYSTATION_LIMIT = 6;
const ONE_HOUR_IN_SECONDS = 3600;
const ONE_MINUTE_IN_SECONDS = 60;
const ALERT_DURATION_MS = 10000;
const PRICE_PER_HOUR = 15000;
const WARNING_THRESHOLD_SECONDS = 300;
const NOTIFICATION_SOUND_INTERVAL = 5000;
const EXPIRED_CHECK_INTERVAL = 15000;

const INITIAL_STATS = {
  activeRentals: 0,
  totalIncome: 0,
  pendingPayments: 0,
};

const INITIAL_FORM_STATE = {
  customerName: "",
  billingType: "per-jam",
  duration: "1",
  paymentMethod: "Cash",
};

const INITIAL_ADD_TIME_STATE = {
  psId: null,
  value: "",
  unit: "jam",
};

// ═════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════
const formatTime = (seconds) => {
  const absoluteSecs = Math.abs(seconds);
  const h = Math.floor(absoluteSecs / 3600).toString().padStart(2, "0");
  const m = Math.floor((absoluteSecs % 3600) / 60).toString().padStart(2, "0");
  const s = (absoluteSecs % 60).toString().padStart(2, "0");
  return `${seconds < 0 ? "-" : ""}${h}:${m}:${s}`;
};

const getStatusText = (status) => {
  const statusMap = {
    rented: "Status: Sedang Bermain",
    paused: "Status: DIJEDA (Waktu Beku)",
    available: "Status: Standby",
  };
  return statusMap[status] || "";
};

const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

const formatRupiah = (num) => {
  if (!num && num !== 0) return "Rp 0";
  return "Rp " + Number(num).toLocaleString("id-ID");
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [playstations, setPlaystations] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [timers, setTimers] = useState({});
  const [timeOutAlerts, setTimeOutAlerts] = useState({});
  const [warningAlerts, setWarningAlerts] = useState({});
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const audioRef = useRef(null);

  // State untuk toggle testing mode
  const [isTestMode, setIsTestMode] = useState(false);

  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedPs, setSelectedPs] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  const [isAddTimeModalOpen, setIsAddTimeModalOpen] = useState(false);
  const [addTimeData, setAddTimeData] = useState(INITIAL_ADD_TIME_STATE);

  // ── Load audio on mount ──────────────────────────────────────────────
  useEffect(() => {
    audioRef.current = new Audio('/src/assets/sounds/notification.mp3');
    if (!audioRef.current) {
      console.warn('Sound file not found, using fallback');
    }
  }, []);

  // ── Play notification sound ──────────────────────────────────────────
  const playNotificationSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.warn('Error playing sound:', error);
    }
  }, []);

  // ── Data Fetching ──────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: psData, error: psError } = await supabase
        .from("playstations")
        .select("*")
        .order("name", { ascending: true })
        .limit(PLAYSTATION_LIMIT);

      if (psError) throw psError;

      const stations = psData || [];
      setPlaystations(stations);

      // Initialize timers
      const nextTimers = {};
      stations.forEach((ps) => {
        if (
          (ps.status === "rented" || ps.status === "paused") &&
          ps.start_time
        ) {
          const startTime = new Date(ps.start_time).getTime();
          const now = Date.now();
          const secondsElapsed = Math.floor((now - startTime) / 1000);

          if (ps.current_session_type === "per-jam" && ps.current_duration_hours > 0) {
            const totalSeconds = ps.current_duration_hours * ONE_HOUR_IN_SECONDS;
            const calculatedLeft = totalSeconds - secondsElapsed;
            nextTimers[ps.id] = {
              type: "per-jam",
              secondsLeft: Math.max(calculatedLeft, 0),
              durationHours: ps.current_duration_hours,
            };
          } else {
            nextTimers[ps.id] = {
              type: "open-play",
              secondsLeft: secondsElapsed,
            };
          }
        }
      });
      setTimers(nextTimers);

      // Update stats
      const activeRentals = stations.filter(
        (ps) => ps.status === "rented"
      ).length;

      const { startISO, endISO } = getTodayRange();

      const { data: psTrans, error: psTransError } = await supabase
        .from("transactions_ps")
        .select("total_price")
        .gte("created_at", startISO)
        .lt("created_at", endISO);

      const { data: snackTrans, error: snackTransError } = await supabase
        .from("transactions_snack")
        .select("total_price")
        .gte("created_at", startISO)
        .lt("created_at", endISO);

      const { data: pendingTrans, error: pendingError } = await supabase
        .from("transactions_ps")
        .select("total_price")
        .eq("payment_status", "pending");

      if (psTransError) console.error(psTransError);
      if (snackTransError) console.error(snackTransError);
      if (pendingError) console.error(pendingError);

      const psRevenue = psTrans?.reduce((sum, t) => sum + (t.total_price || 0), 0) || 0;
      const snackRevenue = snackTrans?.reduce((sum, t) => sum + (t.total_price || 0), 0) || 0;
      const totalIncome = psRevenue + snackRevenue;

      const pendingTotal = pendingTrans?.reduce(
        (sum, t) => sum + (t.total_price || 0), 0
      ) || 0;

      setStats({
        activeRentals,
        totalIncome,
        pendingPayments: pendingTotal,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Cek transaksi expired ─────────────────────────────────────────────
  const checkExpiredTransactions = useCallback(async () => {
    try {
      const { data: expiredRentals, error: rentalError } = await supabase
        .from("playstations")
        .select("id, name, customer_name, total_duration, start_time, current_price_per_hour, current_payment_method, current_customer")
        .eq("status", "rented")
        .not("total_duration", "is", null)
        .not("start_time", "is", null);

      if (rentalError) {
        console.error("Error fetching expired rentals:", rentalError);
        return;
      }

      const nowTime = Date.now();
      const expiredPs = expiredRentals?.filter((ps) => {
        if (!ps.start_time || !ps.total_duration) return false;
        const startTime = new Date(ps.start_time).getTime();
        const elapsedSeconds = (nowTime - startTime) / 1000;
        return elapsedSeconds >= ps.total_duration;
      }) || [];

      if (expiredPs.length === 0) return;

      console.log(`🔔 Found ${expiredPs.length} expired rentals`);

      for (const ps of expiredPs) {
        const durationHours = Math.ceil(ps.total_duration / 3600);
        const totalPrice = durationHours * (ps.current_price_per_hour || PRICE_PER_HOUR);

        const { error: insertError } = await supabase
          .from("transactions_ps")
          .insert({
            playstation_id: ps.id,
            customer_name: ps.current_customer || ps.customer_name || "Pelanggan",
            duration_hours: durationHours,
            price_per_hour: ps.current_price_per_hour || PRICE_PER_HOUR,
            total_price: totalPrice,
            session_type: "Per Jam",
            payment_method: ps.current_payment_method || "Cash",
            payment_status: "pending",
          });

        if (insertError) {
          console.error(`Error inserting transaction for ${ps.name}:`, insertError);
          continue;
        }

        await supabase
          .from("playstations")
          .update({
            status: "available",
            start_time: null,
            total_duration: null,
            customer_name: null,
            current_customer: null,
            current_session_type: null,
            current_duration_hours: null,
            current_start_time: null,
            current_price_per_hour: null,
            current_payment_method: null,
          })
          .eq("id", ps.id);

        setNotifications(prev => {
          const newNotif = {
            id: Date.now() + Math.random(),
            message: `⏰ ${ps.name}: Waktu Habis - Masuk Pending (${formatRupiah(totalPrice)})`,
            type: 'expired',
            psId: ps.id,
            timeLeft: 0
          };
          return [newNotif, ...prev.filter(n => n.psId !== ps.id || n.type !== 'expired')].slice(0, 5);
        });

        playNotificationSound();
      }

      if (expiredPs.length > 0) {
        fetchDashboardData();
        localStorage.setItem('dashboardNeedRefresh', 'true');
        window.dispatchEvent(new CustomEvent('refreshDashboard'));
      }

    } catch (error) {
      console.error("Error checking expired transactions:", error.message);
    }
  }, [playNotificationSound, fetchDashboardData]);

  // ── Fetch data pertama kali ──────────────────────────────────────────
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Jalankan check expired periodik ──────────────────────────────────
  useEffect(() => {
    checkExpiredTransactions();

    const expiredInterval = setInterval(() => {
      checkExpiredTransactions();
    }, EXPIRED_CHECK_INTERVAL);

    return () => {
      clearInterval(expiredInterval);
    };
  }, [checkExpiredTransactions]);

  // ── Event listener untuk refresh ─────────────────────────────────────
  useEffect(() => {
    const handleRefresh = () => {
      fetchDashboardData();
    };

    window.addEventListener('refreshDashboard', handleRefresh);

    return () => {
      window.removeEventListener('refreshDashboard', handleRefresh);
    };
  }, [fetchDashboardData]);

  // ── Timer Logic dengan Notifikasi ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        const updatedTimers = { ...prevTimers };
        let hasChanges = false;

        playstations.forEach((ps) => {
          if (
            ps.status !== "rented" ||
            updatedTimers[ps.id] === undefined
          )
            return;

          const timer = updatedTimers[ps.id];

          if (timer.type === "per-jam") {
            if (timer.secondsLeft > 0) {
              const newSecondsLeft = timer.secondsLeft - 1;
              updatedTimers[ps.id] = {
                ...timer,
                secondsLeft: newSecondsLeft,
              };
              hasChanges = true;

              if (
                newSecondsLeft <= WARNING_THRESHOLD_SECONDS &&
                newSecondsLeft > 0 &&
                !warningAlerts[ps.id]
              ) {
                setWarningAlerts(prev => ({
                  ...prev,
                  [ps.id]: { 
                    active: true, 
                    lastPlayed: Date.now(),
                    name: ps.name,
                    secondsLeft: newSecondsLeft
                  }
                }));
                
                const notifMessage = `${ps.name}: 5 Menit Terakhir (${formatTime(newSecondsLeft)})`;
                setNotifications(prev => {
                  const existing = prev.find(n => n.psId === ps.id && n.type === 'warning');
                  if (existing) return prev;
                  
                  const newNotif = { 
                    id: Date.now(), 
                    message: notifMessage, 
                    type: 'warning', 
                    psId: ps.id,
                    timeLeft: newSecondsLeft
                  };
                  
                  const result = [newNotif, ...prev].slice(0, 5);
                  return result;
                });
                
                playNotificationSound();
              }

              if (warningAlerts[ps.id]?.active && newSecondsLeft > 0) {
                setNotifications(prev => 
                  prev.map(n => 
                    n.psId === ps.id && n.type === 'warning'
                      ? { ...n, message: `${ps.name}: 5 Menit Terakhir (${formatTime(newSecondsLeft)})`, timeLeft: newSecondsLeft }
                      : n
                  )
                );

                const timeSinceLastSound = Date.now() - (warningAlerts[ps.id]?.lastPlayed || 0);
                if (timeSinceLastSound > NOTIFICATION_SOUND_INTERVAL) {
                  playNotificationSound();
                  setWarningAlerts(prev => ({
                    ...prev,
                    [ps.id]: { 
                      ...prev[ps.id], 
                      lastPlayed: Date.now(),
                      secondsLeft: newSecondsLeft
                    }
                  }));
                }
              }

            } else {
              setWarningAlerts(prev => {
                const newAlerts = { ...prev };
                delete newAlerts[ps.id];
                return newAlerts;
              });

              setNotifications(prev => {
                const newNotif = { 
                  id: Date.now(), 
                  message: `${ps.name}: Waktu Selesai (00:00)`, 
                  type: 'error', 
                  psId: ps.id,
                  timeLeft: 0
                };
                const result = [newNotif, ...prev.filter(n => n.psId !== ps.id || n.type !== 'error')].slice(0, 5);
                return result;
              });

              setNotifications(prev => prev.filter(n => n.psId !== ps.id || n.type !== 'warning'));

              handleTimeOut(ps.id, ps.name);
            }
          } else if (timer.type === "open-play") {
            updatedTimers[ps.id] = {
              ...timer,
              secondsLeft: timer.secondsLeft + 1,
            };
            hasChanges = true;
          }
        });

        return hasChanges ? updatedTimers : prevTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [playstations, warningAlerts, playNotificationSound]);

  // ── Remove notification setelah 10 detik ─────────────────────────────
  useEffect(() => {
    const timeouts = notifications.map(n => {
      return setTimeout(() => {
        setNotifications(prev => prev.filter(item => item.id !== n.id));
      }, 10000);
    });

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [notifications]);

  // ── Fungsi untuk menghitung durasi (dengan Test Mode) ────────────────
  const calculateDuration = useCallback((selectedHours) => {
    if (isTestMode) {
      const durationInSeconds = selectedHours * 60;
      console.log(`🧪 TEST MODE: ${selectedHours} jam = ${durationInSeconds} detik (${durationInSeconds/60} menit)`);
      return durationInSeconds;
    } else {
      return selectedHours * ONE_HOUR_IN_SECONDS;
    }
  }, [isTestMode]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleTimeOut = useCallback(
    async (psId, psName) => {
      setWarningAlerts(prev => {
        const newAlerts = { ...prev };
        delete newAlerts[psId];
        return newAlerts;
      });

      setTimeOutAlerts((prev) => ({ ...prev, [psId]: true }));

      playNotificationSound();

      setTimeout(() => {
        setTimeOutAlerts((prev) => ({ ...prev, [psId]: false }));
      }, ALERT_DURATION_MS);

      try {
        const { data: psData, error: fetchError } = await supabase
          .from("playstations")
          .select("*")
          .eq("id", psId)
          .single();

        if (fetchError) throw fetchError;

        let durationHours = 0;
        let totalPrice = 0;
        let sessionType = "Per Jam";

        if (psData.current_session_type === "per-jam" && psData.current_duration_hours > 0) {
          durationHours = psData.current_duration_hours;
          totalPrice = durationHours * (psData.current_price_per_hour || PRICE_PER_HOUR);
        } else {
          const startTime = new Date(psData.start_time).getTime();
          const now = Date.now();
          const secondsElapsed = Math.floor((now - startTime) / 1000);
          durationHours = Math.ceil(secondsElapsed / ONE_HOUR_IN_SECONDS);
          totalPrice = durationHours * (psData.current_price_per_hour || PRICE_PER_HOUR);
          sessionType = "Open Play";
        }

        const { error: transError } = await supabase
          .from("transactions_ps")
          .insert({
            playstation_id: psId,
            customer_name: psData.current_customer || psData.customer_name || "Pelanggan",
            duration_hours: durationHours,
            price_per_hour: psData.current_price_per_hour || PRICE_PER_HOUR,
            total_price: totalPrice,
            session_type: sessionType,
            payment_method: psData.current_payment_method || "Cash",
            payment_status: "pending",
          });

        if (transError) throw transError;

        await supabase
          .from("playstations")
          .update({
            status: "available",
            start_time: null,
            total_duration: null,
            customer_name: null,
            current_customer: null,
            current_session_type: null,
            current_duration_hours: null,
            current_start_time: null,
            current_price_per_hour: null,
            current_payment_method: null,
          })
          .eq("id", psId);

        setNotifications(prev => {
          const newNotif = {
            id: Date.now() + Math.random(),
            message: `📝 ${psName}: Transaksi masuk Pending (${formatRupiah(totalPrice)})`,
            type: 'expired',
            psId: psId,
            timeLeft: 0
          };
          return [newNotif, ...prev.filter(n => n.psId !== psId || n.type !== 'expired')].slice(0, 5);
        });

        fetchDashboardData();
        localStorage.setItem('dashboardNeedRefresh', 'true');
        window.dispatchEvent(new CustomEvent('refreshDashboard'));

      } catch (err) {
        console.error("Error handling timeout:", err);
      }
    },
    [fetchDashboardData, playNotificationSound]
  );

  const dismissAlert = (psId) => {
    setTimeOutAlerts((prev) => ({ ...prev, [psId]: false }));
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // ── Billing Modal ──────────────────────────────────────────────────────
  const openBillingModal = (ps) => {
    setSelectedPs(ps);
    setFormData(INITIAL_FORM_STATE);
    setIsBillingModalOpen(true);
  };

  const closeBillingModal = () => {
    setIsBillingModalOpen(false);
    setSelectedPs(null);
  };

  const handleStartBilling = async (e) => {
    e.preventDefault();

    try {
      const nowISO = new Date().toISOString();
      const customerName = formData.customerName.trim() || "Pelanggan Umum";
      const isPerJam = formData.billingType === "per-jam";
      const durationHours = isPerJam ? parseInt(formData.duration) : 0;
      const totalSeconds = isPerJam ? calculateDuration(durationHours) : 0;

      const { error } = await supabase
        .from("playstations")
        .update({
          status: "rented",
          start_time: nowISO,
          total_duration: totalSeconds,
          customer_name: customerName,
          current_customer: customerName,
          current_session_type: formData.billingType,
          current_duration_hours: durationHours,
          current_start_time: nowISO,
          current_price_per_hour: PRICE_PER_HOUR,
          current_payment_method: formData.paymentMethod,
        })
        .eq("id", selectedPs.id);

      if (error) throw error;

      closeBillingModal();
      fetchDashboardData();
    } catch (error) {
      alert("Gagal membuka billing: " + error.message);
    }
  };

  const handleStopBilling = async (psId) => {
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin menghentikan billing untuk TV ini?"
    );
    if (!confirmed) return;

    try {
      const { data: psData, error: fetchError } = await supabase
        .from("playstations")
        .select("*")
        .eq("id", psId)
        .single();

      if (fetchError) throw fetchError;

      let durationHours = 0;
      let totalPrice = 0;
      let sessionType = "Open Play";
      let paymentMethod = psData.current_payment_method || "Cash";

      if (psData.current_session_type === "per-jam" && psData.current_duration_hours > 0) {
        durationHours = psData.current_duration_hours;
        totalPrice = durationHours * (psData.current_price_per_hour || PRICE_PER_HOUR);
        sessionType = "Per Jam";
      } else {
        const startTime = new Date(psData.start_time).getTime();
        const now = Date.now();
        const secondsElapsed = Math.floor((now - startTime) / 1000);
        durationHours = Math.ceil(secondsElapsed / ONE_HOUR_IN_SECONDS);
        totalPrice = durationHours * (psData.current_price_per_hour || PRICE_PER_HOUR);
      }

      const { error: transError } = await supabase
        .from("transactions_ps")
        .insert({
          playstation_id: psId,
          customer_name: psData.current_customer || psData.customer_name || "Pelanggan Umum",
          duration_hours: durationHours,
          price_per_hour: psData.current_price_per_hour || PRICE_PER_HOUR,
          total_price: totalPrice,
          session_type: sessionType,
          payment_method: paymentMethod,
          payment_status: "pending",
        });

      if (transError) throw transError;

      const { error } = await supabase
        .from("playstations")
        .update({
          status: "available",
          start_time: null,
          total_duration: null,
          customer_name: null,
          current_customer: null,
          current_session_type: null,
          current_duration_hours: null,
          current_start_time: null,
          current_price_per_hour: null,
          current_payment_method: null,
        })
        .eq("id", psId);

      if (error) throw error;

      fetchDashboardData();
    } catch (error) {
      alert("Gagal menghentikan billing: " + error.message);
    }
  };

  const handleTogglePause = async (psId, currentStatus, psName) => {
    const nextStatus = currentStatus === "rented" ? "paused" : "rented";

    try {
      const { error } = await supabase
        .from("playstations")
        .update({ status: nextStatus })
        .eq("id", psId);

      if (error) throw error;

      alert(
        nextStatus === "paused"
          ? `Billing ${psName} BERHASIL DIJEDA!`
          : `Billing ${psName} DILANJUTKAN KEMBALI!`
      );

      fetchDashboardData();
    } catch (error) {
      alert("Gagal merubah status jeda: " + error.message);
    }
  };

  const openAddTimeModal = (ps) => {
    setAddTimeData({
      psId: ps.id,
      value: "",
      unit: "jam",
    });
    setIsAddTimeModalOpen(true);
  };

  const closeAddTimeModal = () => {
    setIsAddTimeModalOpen(false);
    setAddTimeData(INITIAL_ADD_TIME_STATE);
  };

  const handleAddTimeManual = async (e) => {
    e.preventDefault();

    const { psId, value, unit } = addTimeData;
    const numericValue = parseFloat(value);

    if (!numericValue || numericValue <= 0) {
      alert("Masukkan jumlah waktu yang valid!");
      return;
    }

    const ps = playstations.find((p) => p.id === psId);
    if (!ps) {
      alert("Data PlayStation tidak ditemukan!");
      return;
    }

    const currentTotalDuration = ps.total_duration || 0;
    const multiplier =
      unit === "jam" ? ONE_HOUR_IN_SECONDS : ONE_MINUTE_IN_SECONDS;
    const additionalSeconds = Math.floor(numericValue * multiplier);
    const newTotalDuration = currentTotalDuration + additionalSeconds;

    try {
      const { error } = await supabase
        .from("playstations")
        .update({ total_duration: newTotalDuration })
        .eq("id", psId);

      if (error) throw error;

      closeAddTimeModal();
      fetchDashboardData();
    } catch (err) {
      alert("Gagal menambah waktu: " + err.message);
    }
  };

  const updateFormField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateAddTimeField = (field, value) => {
    setAddTimeData((prev) => ({ ...prev, [field]: value }));
  };

  // ── Render Playstation Card ──────────────────────────────────────────
  const renderPlaystationCard = (ps) => {
    const timerData = timers[ps.id];
    const hasAlert = timeOutAlerts[ps.id];
    const hasWarning = warningAlerts[ps.id]?.active;

    return (
      <div key={ps.id} className={`ps-card-glass ${ps.status} ${hasWarning ? 'warning' : ''}`}>
        <div className="ps-card-header">
          <span className="ps-type-badge">
            {ps.type?.toUpperCase() || "PS3"}
          </span>
          <div className="header-right-icons">
            {hasWarning && (
              <div className="notification-bell warning-bell">
                <Clock size={16} color="#eab308" />
                <span className="notification-dot warning-dot" />
              </div>
            )}
            {hasAlert && (
              <div className="notification-bell">
                <Bell size={16} />
                <span className="notification-dot" />
              </div>
            )}
            <span className={`status-dot ${ps.status}`} />
          </div>
        </div>

        <div className="ps-card-body">
          <h3>{ps.name}</h3>

          {(ps.status === "rented" || ps.status === "paused") &&
            ps.customer_name && (
              <div className="customer-name-tag">
                <User size={14} />
                {ps.customer_name}
              </div>
            )}

          {timerData ? (
            <div className="timer-row">
              <div className={`timer-badge-display ${ps.status} ${hasWarning ? 'warning-timer' : ''}`}>
                <Timer size={14} />
                <span>{formatTime(timerData.secondsLeft)}</span>
                <small className="timer-label">
                  ({timerData.type === "per-jam" ? "Paket" : "Open"})
                </small>
              </div>
              {timerData.type === "per-jam" && (
                <button
                  className="btn-add-time"
                  onClick={() => openAddTimeModal(ps)}
                  title="Tambah waktu manual"
                >
                  + Waktu
                </button>
              )}
            </div>
          ) : (
            <p className="ps-status-text">Kosong / Siap Main</p>
          )}

          <p className="ps-status-meta-text">
            {getStatusText(ps.status)}
          </p>

          {hasWarning && timerData && (
            <div className="warning-label-text">
              ⚠️ {Math.ceil(timerData.secondsLeft / 60)} menit tersisa
            </div>
          )}
        </div>

        <div className="ps-card-footer">
          {ps.status === "available" && (
            <button
              onClick={() => openBillingModal(ps)}
              className="action-btn btn-start"
            >
              Buka Billing
            </button>
          )}

          {(ps.status === "rented" || ps.status === "paused") && (
            <div className="action-btn-group">
              <button
                onClick={() =>
                  handleTogglePause(ps.id, ps.status, ps.name)
                }
                className={`action-btn ${
                  ps.status === "paused"
                    ? "btn-resume-active"
                    : "btn-pause"
                }`}
              >
                {ps.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => handleStopBilling(ps.id)}
                className="action-btn btn-stop"
              >
                Stop
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Loading State ──────────────────────────────────────────────────────
  if (loading) {
    return <div className="loading-screen">Memuat Data Kasir...</div>;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div
      className="dashboard-layout-wrapper"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 11, 30, 0.75), rgba(10, 11, 30, 0.85)), url(${bgRental})`,
      }}
    >
      <div className="glow-bg glow-1" />
      <div className="glow-bg glow-2" />

      <div className="main-content-container">
        <header className="dashboard-center-header">
          <div className="header-top">
            <div className="header-title-center">
              <h1>PS CASHIER</h1>
              <p>ADMIN DASHBOARD</p>
            </div>
            
            <div className="test-mode-toggle">
              <FlaskConical size={16} className={`test-mode-icon ${isTestMode ? 'active' : ''}`} />
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isTestMode}
                  onChange={() => setIsTestMode(!isTestMode)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">
                {isTestMode ? '🧪 Testing' : 'Production'}
              </span>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          {/* Notification Bar */}
          {notifications.length > 0 && (
            <div className="notification-bar">
              <div className="notification-bar-content">
                <Bell size={16} className="notification-bar-icon" />
                <div className="notification-messages">
                  {notifications.map((notif) => (
                    <span key={notif.id} className={`notification-item ${notif.type}`}>
                      {notif.message}
                      <button 
                        className="notification-close" 
                        onClick={() => dismissNotification(notif.id)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="stats-grid">
            <StatCard
              icon={<Play size={24} />}
              iconClass="rental-active"
              value={`${stats.activeRentals} / ${PLAYSTATION_LIMIT} TV`}
              label="Active Rentals"
            />
            <StatCard
              icon={<DollarSign size={24} />}
              iconClass="income"
              value={formatRupiah(stats.totalIncome)}
              label="Total Revenue Today"
            />
            <StatCard
              icon={<FileText size={24} />}
              iconClass="pending-warn"
              value={formatRupiah(stats.pendingPayments)}
              label="Total Pending Payments"
            />
          </div>

          <div className="main-station-box-glass">
            <div className="section-header">
              <h2>CURRENT STATION STATUS</h2>
              <button onClick={fetchDashboardData} className="refresh-btn">
                Refresh Status
              </button>
            </div>

            <div className="ps-monitor-grid-6pt">
              {playstations.map((ps) => renderPlaystationCard(ps))}
            </div>
          </div>
        </main>
      </div>

      {/* Billing Modal */}
      {isBillingModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content-glass">
            <div className="modal-header">
              <h3>Buka Billing - {selectedPs?.name}</h3>
              <button
                onClick={closeBillingModal}
                className="close-modal-btn"
              >
                X
              </button>
            </div>

            <form onSubmit={handleStartBilling}>
              <div className="form-group">
                <label>Nama Pelanggan</label>
                <input
                  type="text"
                  placeholder="Masukkan nama..."
                  value={formData.customerName}
                  onChange={(e) =>
                    updateFormField("customerName", e.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label>Jenis Paket</label>
                <div className="radio-group">
                  <RadioOption
                    label="Paket Per Jam"
                    name="billingType"
                    value="per-jam"
                    checked={formData.billingType === "per-jam"}
                    onChange={() =>
                      updateFormField("billingType", "per-jam")
                    }
                  />
                  <RadioOption
                    label="Open Play"
                    name="billingType"
                    value="open-play"
                    checked={formData.billingType === "open-play"}
                    onChange={() =>
                      updateFormField("billingType", "open-play")
                    }
                  />
                </div>
              </div>

              {formData.billingType === "per-jam" && (
                <div className="form-group">
                  <label>Durasi Bermain</label>
                  <select
                    value={formData.duration}
                    onChange={(e) =>
                      updateFormField("duration", e.target.value)
                    }
                  >
                    <option value="1">1 Jam</option>
                    <option value="2">2 Jam</option>
                    <option value="3">3 Jam</option>
                    <option value="4">4 Jam</option>
                    <option value="5">5 Jam</option>
                  </select>
                  {isTestMode && (
                    <small className="test-mode-hint">
                      🧪 Testing Mode: 1 Jam = 1 Menit
                    </small>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Metode Bayar</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    updateFormField("paymentMethod", e.target.value)
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>

              <button
                type="submit"
                className="action-btn btn-start submit-billing-btn"
              >
                Mulai Bermain
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Time Modal */}
      {isAddTimeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content-glass">
            <div className="modal-header">
              <h3>Tambah Waktu Manual</h3>
              <button
                onClick={closeAddTimeModal}
                className="close-modal-btn"
              >
                X
              </button>
            </div>

            <form onSubmit={handleAddTimeManual}>
              <div className="form-group">
                <label>Jumlah Waktu</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Contoh: 30"
                  value={addTimeData.value}
                  onChange={(e) =>
                    updateAddTimeField("value", e.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Satuan</label>
                <div className="radio-group">
                  <RadioOption
                    label="Jam"
                    name="timeUnit"
                    value="jam"
                    checked={addTimeData.unit === "jam"}
                    onChange={() => updateAddTimeField("unit", "jam")}
                  />
                  <RadioOption
                    label="Menit"
                    name="timeUnit"
                    value="menit"
                    checked={addTimeData.unit === "menit"}
                    onChange={() =>
                      updateAddTimeField("unit", "menit")
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                className="action-btn btn-start submit-billing-btn"
              >
                Tambah Waktu
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════
function StatCard({ icon, iconClass, value, label }) {
  return (
    <div className="stat-card-glass">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div className="stat-info">
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
    </div>
  );
}

function RadioOption({ label, name, value, checked, onChange }) {
  return (
    <label className={`radio-label ${checked ? "active" : ""}`}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  );
}