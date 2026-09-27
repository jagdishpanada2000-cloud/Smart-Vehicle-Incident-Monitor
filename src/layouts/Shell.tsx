import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ScanLine,
  CarFront,
  ListFilter,
  ChartNoAxesCombined,
  Settings2,
  LogOut,
  ChevronRight,
  Radio,
  Menu,
  X,
} from "lucide-react";
import { Brand, useToast } from "../components/ui";
import { db } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
const links = [
  { to: "/dashboard", name: "Overview", icon: LayoutDashboard },
  { to: "/scanner", name: "Vehicle scanner", icon: ScanLine },
  { to: "/vehicles", name: "Vehicle registry", icon: CarFront },
  { to: "/incidents", name: "Incident log", icon: ListFilter },
  { to: "/analytics", name: "Analytics", icon: ChartNoAxesCombined },
  { to: "/system", name: "System settings", icon: Settings2 },
];
export function Shell() {
  const { session } = useAuth();
  const toast = useToast();
  const [menu, setMenu] = useState(false),
    [clock, setClock] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function logout() {
    const { error } = await db().auth.signOut();
    if (error) toast("Sign out failed. Please retry.", true);
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand-link" to="/">
          <Brand />
        </Link>
        <div className="workspace-tag">
          <span className="live-dot" /> SECURITY OPERATIONS <span>01</span>
        </div>
        <div className="nav-label">COMMAND CENTER</div>
        <nav>
          {links.map(({ to, name, icon: Icon }, i) => (
            <NavLink onClick={() => setMenu(false)} key={to} to={to}>
              <Icon size={19} />
              <span>{name}</span>
              <small>0{i + 1}</small>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="protected-label">
            <Radio size={18} />
            <div>
              Intelligence, connected.<small>Tesseract + Gemini Vision</small>
            </div>
          </div>
          <Link to="/architecture" className="architecture-link">
            Explore architecture <ChevronRight size={16} />
          </Link>
          <div className="operator">
            <div className="avatar">
              {session?.user.email?.slice(0, 2).toUpperCase() || "OP"}
            </div>
            <div>
              <strong>Security operator</strong>
              <small title={session?.user.email}>{session?.user.email}</small>
            </div>
            <button
              title="Sign out"
              aria-label="Sign out"
              className="icon-button"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <span className="breadcrumb">
            Workspace <ChevronRight size={13} /> <b>Security operations</b>
          </span>
          <div className="topbar-right">
            <span className="session-indicator">
              <span className="live-dot" /> SESSION ACTIVE
            </span>
            <time>
              {clock.toLocaleTimeString("en-GB")} <span>LOCAL</span>
            </time>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>SENTINEL / VEHICLE SECURITY INTELLIGENCE</span>
          <span>RULE-BASED DECISIONS · AI-ASSISTED INSIGHTS</span>
        </footer>
      </div>
      {menu && (
        <button
          aria-label="Close navigation"
          className="menu-overlay"
          onClick={() => setMenu(false)}
        />
      )}
    </div>
  );
}
