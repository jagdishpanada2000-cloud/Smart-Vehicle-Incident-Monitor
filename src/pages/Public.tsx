import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Fingerprint,
  Radar,
  LockKeyhole,
  CarFront,
  GitBranch,
  Database,
  Cpu,
} from "lucide-react";
import { Brand, Badge, ErrorBox } from "../components/ui";
import { configured, db } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
function PublicNav() {
  return (
    <nav className="public-nav">
      <Link to="/">
        <Brand />
      </Link>
      <div>
        <Link to="/architecture">
          How it works <ArrowUpRight size={14} />
        </Link>
        <Link className="button small secondary" to="/dashboard">
          Open console <ArrowRight size={15} />
        </Link>
      </div>
    </nav>
  );
}
export function Landing() {
  return (
    <div className="landing">
      <PublicNav />
      <main className="public-wrap">
        <div className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> VEHICLE SECURITY. REIMAGINED.
            </div>
            <h1>
              Every vehicle.
              <br />
              Every incident.
              <br />
              <span>In focus.</span>
            </h1>
            <p className="hero-description">
              Smart vehicle security & incident intelligence.
              <br />
              AI-assisted identification, fuzzy plate matching, and a clearer
              view of every entry.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/dashboard">
                Enter security dashboard <ArrowRight size={18} />
              </Link>
              <Link className="text-button" to="/architecture">
                View system architecture <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="hero-trust">
              <ShieldCheck size={17} /> Deterministic decisions. Explainable
              intelligence.
            </div>
          </div>
          <div className="scan-visual">
            <div className="scan-visual-top">
              <span>
                <span className="live-dot" /> SENTINEL VISION
              </span>
              <span>ILLUSTRATIVE SCAN</span>
            </div>
            <div className="scan-grid">
              <div className="radar-circle circle-one" />
              <div className="radar-circle circle-two" />
              <div className="car-illustration">
                <svg
                  viewBox="0 0 500 290"
                  fill="none"
                  aria-label="Vehicle scanning illustration"
                >
                  <path
                    d="m95 143 44-76q8-14 26-14h170q18 0 26 14l44 76 33 25v73H62v-73l33-25Z"
                    fill="#17232d"
                    stroke="#66828c"
                    strokeWidth="2"
                  />
                  <path
                    d="m131 137 33-61h172l33 61H131Z"
                    fill="#0c161d"
                    stroke="#678791"
                    strokeWidth="2"
                  />
                  <path
                    d="M250 76v59M83 167h334M98 191h53m198 0h53"
                    stroke="#b4eeec"
                    strokeWidth="5"
                  />
                  <path
                    d="M72 207h74l14 23h180l14-23h74"
                    stroke="#5d777e"
                    strokeWidth="2"
                  />
                  <rect
                    x="85"
                    y="241"
                    width="53"
                    height="26"
                    rx="6"
                    fill="#203037"
                  />
                  <rect
                    x="362"
                    y="241"
                    width="53"
                    height="26"
                    rx="6"
                    fill="#203037"
                  />
                  <rect
                    x="190"
                    y="189"
                    width="120"
                    height="31"
                    rx="3"
                    fill="#d9e5d8"
                  />
                  <text
                    x="250"
                    y="211"
                    textAnchor="middle"
                    fill="#16201b"
                    fontSize="17"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    MH12AB1234
                  </text>
                  <path
                    d="M175 180v-9h19m112 0h19v9m0 40v12h-19m-112 0h-19v-12"
                    stroke="#a6ff73"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="scan-line" />
              <div className="coordinate c1">
                X 192.04
                <br />Y 084.12
              </div>
              <div className="coordinate c2">
                OPTICAL RECOGNITION
                <br />
                PLATE REGION
              </div>
            </div>
            <div className="visual-result">
              <div>
                <span className="mono muted">DETECTION PIPELINE</span>
                <strong>
                  Tesseract <ArrowRight size={17} /> Intelligence
                </strong>
              </div>
              <span className="visual-check">
                <ScanLine size={25} />
              </span>
            </div>
            <div className="visual-foot">
              <span>01 / READ</span>
              <span>02 / MATCH</span>
              <span>03 / UNDERSTAND</span>
            </div>
          </div>
        </div>
        <div className="capabilities">
          {[
            [ScanLine, "OCR detection"],
            [Fingerprint, "Fuzzy matching"],
            [Radar, "Live monitoring"],
            [Sparkles, "AI analysis"],
            [ShieldCheck, "Incident intelligence"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof ScanLine;
            return (
              <div key={String(label)}>
                <I size={20} />
                {String(label)}
              </div>
            );
          })}
        </div>
        <section className="how-section">
          <div>
            <div className="eyebrow">FROM PIXELS TO A CLEAR DECISION</div>
            <h2>One image. A complete picture.</h2>
            <p>A transparent pipeline built for the security desk.</p>
          </div>
          <div className="how-grid">
            {[
              [
                "01",
                "Read the plate",
                "Tesseract.js reads your image. Uncertain results are sent securely to Gemini Vision.",
              ],
              [
                "02",
                "Find the match",
                "Levenshtein distance compares the plate with registered vehicles using your configured threshold.",
              ],
              [
                "03",
                "Understand the incident",
                "Backend rules determine access and risk. Gemini explains the saved result.",
              ],
            ].map(([n, t, d]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <footer className="landing-footer">
          <Brand />
          <div>
            <span className="eyebrow">DESIGNED & ENGINEERED BY</span>
            <p>Subodh Sharma · Varad Shimpi · Jagdish Panada · Anish Sawant</p>
          </div>
          <span className="mono muted">MINI PROJECT / 2026</span>
        </footer>
      </main>
    </div>
  );
}
export function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(() =>
      new URLSearchParams(window.location.hash.slice(1)).has("error")
        ? "Google sign-in was cancelled or could not be completed. Please try again."
        : "",
    );
  if (session) return <Navigate to="/dashboard" replace />;
  async function googleLogin() {
    setBusy(true);
    setError("");
    try {
      const { error } = await db().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setError(
          "Google sign-in could not start. Verify the Google provider is enabled in Supabase.",
        );
        setBusy(false);
      }
    } catch {
      setError("Unable to connect to Google sign-in. Please try again.");
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await db().auth.signInWithPassword({ email, password });
      if (error)
        setError(
          "Unable to sign in. Check your email and password, then try again.",
        );
    } catch {
      setError(
        "Unable to connect. Check your connection and system configuration.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <PublicNav />
      <main className="login-layout">
        <div className="login-intro">
          <div className="eyebrow">AUTHORIZED PERSONNEL ONLY</div>
          <h1>
            Your command
            <br />
            center awaits.
          </h1>
          <p>
            One secure workspace for vehicle identification,
            <br />
            incident monitoring, and explainable intelligence.
          </p>
          <div className="login-orbit">
            <ShieldCheck size={86} />
            <div className="orbit" />
          </div>
          <div className="mono muted">
            SENTINEL / SECURITY OPERATIONS PLATFORM
          </div>
        </div>
        <section className="login-card">
          <span className="login-icon">
            <LockKeyhole />
          </span>
          <h2>Operator sign in</h2>
          <p>Enter your credentials to access the console.</p>
          {!configured && (
            <ErrorBox message="Setup required: configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in." />
          )}
          {error && <ErrorBox message={error} />}
          <button
            type="button"
            className="button secondary full google-button"
            disabled={busy || !configured}
            onClick={googleLogin}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.5Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17a6 6 0 0 1-9-3.1H3.1v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"
              />
              <path
                fill="#EA4335"
                d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z"
              />
            </svg>
            Continue with Google
          </button>
          <div className="auth-divider">
            <span>or use your email</span>
          </div>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@college.edu"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>
            <button className="button full" disabled={busy || !configured}>
              {busy ? "Authenticating…" : "Access command center"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-note">
            <LockKeyhole size={14} /> Access is managed by your system
            administrator.
          </div>
        </section>
      </main>
    </div>
  );
}
export function Architecture() {
  return (
    <div className="landing">
      <PublicNav />
      <main className="public-wrap architecture-page">
        <div className="eyebrow">BUILT TO BE UNDERSTOOD</div>
        <h1>Inside the intelligence.</h1>
        <p className="lead">OCR reads. Algorithms decide. AI explains.</p>
        <div className="architecture-diagram">
          <div className="arch-node">
            <CarFront />
            Image upload <small>React · Vite</small>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-node">
            <ScanLine />
            Tesseract.js{" "}
            <small>Browser WebAssembly · real OCR confidence</small>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-branches">
            <div className="arch-node">
              <Badge tone="granted">Reliable</Badge>
              <small>One candidate + confidence ≥ configured limit</small>
            </div>
            <div className="arch-node">
              <Badge tone="medium">Uncertain</Badge>
              <small>Gemini Vision via authenticated Edge Function</small>
            </div>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-node">
            <GitBranch />
            Levenshtein + deterministic rules{" "}
            <small>
              Similarity threshold · vehicle status · recent history
            </small>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-branches">
            <div className="arch-node">
              <Database />
              Supabase PostgreSQL
              <small>Access result + incident audit trail</small>
            </div>
            <div className="arch-node">
              <ShieldCheck />
              Cloudinary
              <small>Authenticated images · temporary signed access</small>
            </div>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-node">
            <Sparkles />
            AI Incident Analyst
            <small>
              Gemini summarizes the stored facts; it cannot change access.
            </small>
          </div>
        </div>
        <div className="info-grid">
          <article className="panel padded">
            <Cpu />
            <h3>The matching mathematics</h3>
            <code>(1 − edit distance / longest plate length) × 100</code>
            <p>
              MH12AB1294 vs MH12AB1234: one substitution in ten characters =
              90%. An active vehicle passes the default 60% threshold. Blocked,
              expired, or tied best matches are denied.
            </p>
          </article>
          <article className="panel padded">
            <ShieldCheck />
            <h3>Transparent by design</h3>
            <p>
              Tesseract confidence is an OCR estimate, not proof of identity.
              The 60% match threshold is suitable for demonstrating fuzzy
              matching; it is not a physical security guarantee. Unreadable
              plates require another image or an operator’s manual entry.
            </p>
            <Link className="text-button" to="/dashboard">
              Explore the console <ArrowRight size={16} />
            </Link>
          </article>
        </div>
      </main>
    </div>
  );
}
