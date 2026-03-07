// FitForge — shared inline styles
// All glassmorphism design tokens live here.
//
// Most entries are plain objects.
// Function entries accept dynamic props:
//   navBtn(active), exPickerItem(isSelected), streakBadge(count)

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0a0a0f",
    color: "#e8e4dc",
    fontFamily: "'Barlow Condensed', 'Noto Sans TC', sans-serif",
    position: "relative",
    overflowX: "clip",
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "#0a0a0f",
  },
  bg: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
    background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,90,0,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 90% 90%, rgba(255,180,0,0.07) 0%, transparent 60%)",
  },
  header: {
    position: "relative", zIndex: 10,
    padding: "24px 20px 0",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  logo: {
    fontSize: "28px", fontWeight: 900, letterSpacing: "0.05em",
    background: "linear-gradient(90deg, #ff6a00, #ffd700)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    textTransform: "uppercase",
  },
  streakBadge: (count) => ({
    background: count > 0 ? "linear-gradient(135deg, #ff6a00, #ff2d00)" : "#1a1a22",
    padding: "6px 14px", borderRadius: "20px",
    fontSize: "14px", fontWeight: 700, letterSpacing: "0.05em",
    border: "1px solid rgba(255,106,0,0.3)",
    display: "flex", alignItems: "center", gap: "6px",
  }),
  nav: {
    position: "relative", zIndex: 10,
    display: "flex", gap: "4px",
    padding: "16px 16px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  navBtn: (active) => ({
    flex: 1, padding: "10px 4px", border: "none", cursor: "pointer",
    background: active ? "rgba(255,106,0,0.15)" : "transparent",
    color: active ? "#ff6a00" : "#888",
    borderBottom: active ? "2px solid #ff6a00" : "2px solid transparent",
    fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em",
    transition: "all 0.2s",
  }),
  content: {
    position: "relative", zIndex: 10,
    padding: "20px 16px 100px",
    maxWidth: "480px", margin: "0 auto",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px", padding: "20px",
    marginBottom: "16px",
    backdropFilter: "blur(10px)",
  },
  statRow: {
    display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "16px",
  },
  stat: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "12px", padding: "16px 12px", textAlign: "center",
  },
  statNum: { fontSize: "28px", fontWeight: 900, color: "#ff6a00", lineHeight: 1 },
  statLabel: { fontSize: "11px", color: "#888", marginTop: "4px", letterSpacing: "0.05em" },
  sectionTitle: {
    fontSize: "13px", fontWeight: 700, color: "#888",
    letterSpacing: "0.1em", textTransform: "uppercase",
    marginBottom: "12px",
  },
  label: { fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" },
  input: {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  },
  exPickerTrigger: {
    width: "100%", background: "#12121a",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
    outline: "none", boxSizing: "border-box", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    textAlign: "left", fontFamily: "inherit",
  },
  exPickerOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
    zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  exPickerSheet: {
    width: "100%", maxWidth: "480px", height: "70vh", background: "#13131c",
    borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.1)",
    borderBottom: "none", display: "flex", flexDirection: "column", overflow: "hidden",
  },
  exPickerHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
    flexShrink: 0,
  },
  exPickerTitle: { fontSize: "16px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.05em" },
  exPickerClose: {
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px", padding: "6px 14px", color: "#e8e4dc",
    fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  exPickerBody: {
    flex: 1, overflowY: "auto", overflowX: "hidden",
    WebkitOverflowScrolling: "touch", padding: "8px 0 24px",
  },
  exPickerCategoryLabel: {
    fontSize: "11px", fontWeight: 700, color: "#666",
    letterSpacing: "0.12em", textTransform: "uppercase", padding: "14px 20px 6px",
  },
  exPickerItem: (isSelected) => ({
    display: "block", width: "100%", padding: "12px 20px",
    background: isSelected ? "rgba(255,106,0,0.12)" : "transparent",
    border: "none", borderLeft: isSelected ? "3px solid #ff6a00" : "3px solid transparent",
    color: isSelected ? "#ff9500" : "#e8e4dc",
    fontSize: "15px", fontWeight: isSelected ? 700 : 400,
    textAlign: "left", cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box",
  }),
  btn: {
    width: "100%", padding: "14px", border: "none", borderRadius: "12px",
    background: "linear-gradient(135deg, #ff6a00, #ff9500)",
    color: "#fff", fontSize: "16px", fontWeight: 800,
    cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
    marginTop: "8px", transition: "transform 0.1s, opacity 0.1s",
  },
  btnSecondary: {
    padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
    background: "transparent", color: "#888", fontSize: "13px",
    cursor: "pointer", fontFamily: "inherit",
  },
  setRow: {
    display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px",
  },
  setInput: {
    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
    padding: "7px 10px", color: "#e8e4dc", fontSize: "15px",
    outline: "none", textAlign: "center", fontFamily: "inherit",
  },
  setLabel: { fontSize: "11px", color: "#666", textAlign: "center", marginTop: "2px" },
  deleteBtn: {
    background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.2)",
    borderRadius: "8px", padding: "8px 10px", color: "#ff5555",
    cursor: "pointer", fontSize: "14px", flexShrink: 0,
  },
  workoutItem: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px", padding: "14px 16px", marginBottom: "8px",
  },
  bodyGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
  },
  bmiBar: {
    height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.08)",
    marginTop: "8px", overflow: "hidden",
  },
  historyDate: {
    fontSize: "11px", color: "#666", letterSpacing: "0.06em",
    textTransform: "uppercase", marginBottom: "6px",
  },
  tag: {
    display: "inline-block", padding: "3px 10px",
    background: "rgba(255,106,0,0.15)", border: "1px solid rgba(255,106,0,0.25)",
    borderRadius: "20px", fontSize: "12px", color: "#ff9500", marginRight: "6px",
  },
  historyActionBtn: {
    padding: "3px 10px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "6px", color: "#ccc",
    cursor: "pointer", fontSize: "12px",
    fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
  },
  historyDeleteBtn: {
    padding: "3px 10px",
    background: "rgba(255,50,50,0.12)",
    border: "1px solid rgba(255,50,50,0.2)",
    borderRadius: "6px", color: "#ff5555",
    cursor: "pointer", fontSize: "12px",
    fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
  },
  confirmCancelBtn: {
    flex: 1, padding: "13px", cursor: "pointer", fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px",
    background: "transparent", color: "#888", fontSize: "15px",
    fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
  },
  confirmDeleteBtn: {
    flex: 1, padding: "13px", cursor: "pointer", fontWeight: 800,
    border: "none", borderRadius: "12px",
    background: "linear-gradient(135deg, #ff3030, #ff5555)",
    color: "#fff", fontSize: "15px",
    fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
  },
};

export default styles;
