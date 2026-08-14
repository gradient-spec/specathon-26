import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  CheckCircle2, Loader2, AlertTriangle, User, Users, FileText, Copy, Check, Upload, X, Download, Info, ChevronDown,
} from "lucide-react";
import Reveal from "./Reveal";
import { ASSETS, READY } from "@/utils/assets";
import {
  COLLEGE_OPTIONS,
  DEPARTMENT_OPTIONS,
  DOMAIN_OPTIONS,
  TEAM_SIZE_OPTIONS,
  YEAR_OPTIONS,
} from "@/utils/constants";
import { INDIAN_STATES, INDIA_STATES_AND_CITIES } from "@/utils/indiaData";
import { MemberInput, validateAbstract } from "@/services/supabase";

type EdgeResult = {
  success: true;
  teamId: string;
  r2Key: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; result: EdgeResult }
  | { kind: "err"; msg: string };

const inputCls = "field";
const labelCls = "block eyebrow mb-2";

const emptyMember = (): MemberInput => ({
  name: "",
  phone: "",
  email: "",
  year: "",
  roll_number: "",
  department: "",
});

export default function Registration() {
  // Team-level
  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState<number | "">("");
  const [domain, setDomain] = useState<string>("");
  const [collegeChoice, setCollegeChoice] = useState<string>("");
  const [collegeName, setCollegeName] = useState("");
  const [collegeCity, setCollegeCity] = useState("");
  const [collegeState, setCollegeState] = useState("");

  // Leader
  const [leaderName, setLeaderName] = useState("");
  const [leaderEmail, setLeaderEmail] = useState("");
  const [leaderPhone, setLeaderPhone] = useState("");
  const [leaderYear, setLeaderYear] = useState<string>("");
  const [leaderRoll, setLeaderRoll] = useState("");
  const [leaderDept, setLeaderDept] = useState<string>("");

  // Project
  const [projectTitle, setProjectTitle] = useState("");
  const [abstractFile, setAbstractFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consent
  const [paymentAck, setPaymentAck] = useState(false);
  const [abstractAck, setAbstractAck] = useState(false);

  // Members
  const [members, setMembers] = useState<MemberInput[]>([emptyMember(), emptyMember()]);

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const turnstileRef = useRef<TurnstileInstance>(null);

  const isInternal = collegeChoice === COLLEGE_OPTIONS[0];

  const requiredMembers = teamSize ? (teamSize as number) - 1 : 0;
  const visibleMembers = useMemo(() => {
    const arr = [...members];
    while (arr.length < requiredMembers) arr.push(emptyMember());
    return arr.slice(0, requiredMembers);
  }, [members, requiredMembers]);

  const updateMember = (i: number, patch: Partial<MemberInput>) => {
    setMembers((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push(emptyMember());
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const onFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setAbstractFile(null);
      return;
    }
    const err = validateAbstract(f);
    if (err) {
      setStatus({ kind: "err", msg: err });
      setAbstractFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setStatus({ kind: "idle" });
    setAbstractFile(f);
  };

  const clearFile = () => {
    setAbstractFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    // Client-side file guard (extension + size) before any network call
    const fileErr = validateAbstract(abstractFile);
    if (fileErr) {
      setStatus({ kind: "err", msg: fileErr });
      return;
    }
    if (!abstractAck) {
      setStatus({ kind: "err", msg: "Please confirm you used the provided PPT template for your abstract submission, If not please do submit in the given template itself or else we will not evaluate your abstract strictly." });
      return;
    }
    if (!turnstileToken) {
      setStatus({ kind: "err", msg: "Please complete the security challenge." });
      return;
    }

    // Build FormData — one request to the Edge Function handles upload + DB insert
    const fd = new FormData();
    fd.append("file", abstractFile!);
    fd.append("team_name", teamName);
    fd.append("team_size", String(teamSize));
    fd.append("domain", domain);
    fd.append("project_title", projectTitle);
    fd.append("leader_name", leaderName);
    fd.append("leader_email", leaderEmail);
    fd.append("leader_phone", leaderPhone);
    fd.append("college", isInternal ? COLLEGE_OPTIONS[0] : collegeName);
    fd.append("is_internal", String(isInternal));
    fd.append("payment_ack", "true");
    fd.append("template_confirmed", "true");

    if (isInternal) {
      fd.append("leader_year", leaderYear);
      fd.append("leader_roll", leaderRoll);
      fd.append("leader_dept", leaderDept);
    } else {
      fd.append("college_state", collegeState);
      fd.append("college_city", collegeCity);
    }

    fd.append(
      "members",
      JSON.stringify(
        visibleMembers
          .filter((m) => m.name.trim().length > 0)
          .map((m) => ({
            name: m.name.trim(),
            email: m.email ?? "",
            phone: m.phone ?? "",
            year: m.year ?? "",
            roll_number: m.roll_number ?? "",
            department: m.department ?? "",
          }))
      )
    );

    setStatus({ kind: "submitting" });

    try {
      // Derive the Edge Function URL from the Supabase project URL already in env
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const edgeUrl = `${supabaseUrl}/functions/v1/upload-abstract`;

      const res = await fetch(edgeUrl, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${anonKey}`,
          "x-turnstile-token": turnstileToken,
          "x-idempotency-key": idempotencyKey
        },
        body: fd,
        // Do NOT set Content-Type — the browser sets it automatically
        // with the correct multipart/form-data boundary.
      });

      const body = await res.json().catch(() => ({})) as { success?: boolean; message?: string; teamId?: string; r2Key?: string };

      if (!res.ok || !body.success) {
        let errorMsg = body.message ?? `Server error (${res.status}). Please try again.`;
        if (res.status === 403) errorMsg = "Security verification failed. Please refresh and try again.";
        else if (res.status === 429) errorMsg = "Too many registration attempts. Please try again later.";
        else if (res.status === 413) errorMsg = "Your abstract file is too large. Maximum size is 10 MB.";
        else if (res.status === 503) errorMsg = "Registration is temporarily unavailable. Please try again later.";
        
        throw new Error(errorMsg);
      }

      setStatus({
        kind: "ok",
        result: {
          success: true,
          teamId: body.teamId!,
          r2Key: body.r2Key!,
        },
      });
    } catch (err) {
      setStatus({ kind: "err", msg: err instanceof Error ? err.message : "Unknown error." });
      setTurnstileToken("");
      turnstileRef.current?.reset();
    }
  };

  const copyRegId = async () => {
    if (status.kind !== "ok") return;
    try {
      await navigator.clipboard.writeText(status.result.teamId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available (older browsers). Fallback: select the input.
    }
  };

  const busy = status.kind === "submitting";
  const canSubmit = paymentAck && abstractAck;
  const submitLabel = busy ? "Submitting Registration..." : "Lock it in";

  return (
    <section id="register" className="relative py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        {/* Glassmorphism announcement banner */}
        <Reveal>
          <div className="rounded-2xl glass border-lumen/20 p-5 md:p-6 mb-10 flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-4 md:gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-3 flex-1 text-center md:text-left">
              <span className="h-9 w-9 shrink-0 rounded-lg bg-lumen/10 border border-lumen/30 flex items-center justify-center text-lumen mx-auto md:mx-0">
                <Info size={16} />
              </span>
              <p className="text-sm md:text-[15px] text-fg/85 leading-relaxed">
                Abstract submission in the <span className="text-lumen font-medium">provided PPT template</span> must be strictly followed. If it is not in the format provided, your abstract will not be reviewed.
              </p>
            </div>
            <a
              href={READY.ppt ? ASSETS.pptTemplate : undefined}
              download={READY.ppt || undefined}
              target={READY.ppt ? "_blank" : undefined}
              rel="noopener noreferrer"
              data-cursor
              aria-disabled={!READY.ppt}
              className={`btn-gradient shrink-0 self-center md:self-auto mx-auto md:mx-0 ${READY.ppt ? "" : "opacity-70 cursor-not-allowed"}`}
            >
              <Download size={15} className="text-lumen" />
              {READY.ppt ? "Download PPT Template" : "PPT Template · Soon"}
            </a>
          </div>
        </Reveal>

        <div className="text-center mb-12">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-3">

            </div>
            <h2 className="mt-6 font-display text-3xl md:text-5xl leading-[1.05] tracking-tightest">
              Register your Team for <span className="font-serif italic text-lumen">SPECATHON 2026</span>
            </h2>
            <p className="mt-6 text-muted max-w-xl mx-auto text-sm">
              Teams of 2–4. One entry per team lead email.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="relative rounded-3xl glass p-6 md:p-10">
            <AnimatePresence mode="wait">
              {status.kind === "ok" ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="py-12 md:py-16 max-w-xl mx-auto"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <CheckCircle2 size={32} className="text-lumen shrink-0" />
                    <h3 className="font-display text-2xl md:text-3xl tracking-tightest">
                      Registration Successful
                    </h3>
                  </div>

                  <p className="text-muted text-sm leading-relaxed mb-8">
                    Your registration has been received successfully. Team{" "}
                    <span className="text-fg font-medium">{teamName}</span> is now in our
                    system.
                  </p>

                  {/* Team ID block */}
                  <div className="rounded-2xl border border-plasma/40 bg-plasma/[0.05] p-5 md:p-6">
                    <div className="eyebrow mb-3">Team ID</div>
                    <div className="flex items-stretch rounded-xl border border-plasma/30 bg-plasma/[0.06] overflow-hidden">
                      <div className="flex-1 px-5 py-4 font-mono text-xl md:text-2xl tracking-[0.16em] text-fg select-all">
                        {status.result.teamId}
                      </div>
                      <button
                        type="button"
                        onClick={copyRegId}
                        aria-label="Copy Team ID"
                        className="px-4 border-l border-plasma/30 hover:bg-plasma/[0.14] transition-colors flex items-center gap-2 text-sm text-fg/90 shrink-0"
                      >
                        {copied ? <Check size={15} className="text-lumen" /> : <Copy size={15} />}
                        <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <AnimatePresence>
                      {copied && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-2 text-xs text-lumen font-mono uppercase tracking-[0.24em]"
                        >
                          Copied to clipboard
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Save reminder */}
                  <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-sm text-fg/80 font-medium mb-3">
                      Please save this Team ID. It will be required for:
                    </p>
                    <ul className="space-y-1.5 text-sm text-muted">
                      {[
                        "Shortlist announcements",
                        "Abstract review status",
                        "Future communication",
                        "Final event verification",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-lumen/70 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Footer note */}
                  <p className="mt-6 text-xs text-muted">
                    A confirmation will be sent to{" "}
                    <span className="text-fg">{leaderEmail}</span>.
                    Payment of ₹400 per head is due{" "}
                    <span className="text-fg">only after shortlisting</span>.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-10"
                >
                  {/* Team */}
                  <fieldset className="space-y-6">
                    <legend className="eyebrow mb-4 flex items-center gap-2">
                      <Users size={12} /> Team details
                    </legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field label="Team name" required>
                        <input required className={inputCls} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Segfault Society" />
                      </Field>
                      <Field label="Team size" required>
                        <CustomSelect
                          required
                          value={teamSize}
                          placeholder="Select team size"
                          onChange={(e) => setTeamSize(e.target.value === "" ? "" : Number(e.target.value))}
                          options={TEAM_SIZE_OPTIONS.map((n) => ({ label: `${n} members`, value: n }))}
                        />
                      </Field>
                      <Field label="Domain" required>
                        <CustomSelect
                          required
                          value={domain}
                          placeholder="Select domain"
                          onChange={(e) => setDomain(e.target.value)}
                          options={DOMAIN_OPTIONS}
                        />
                      </Field>
                      <Field label="College" required>
                        <CustomSelect
                          required
                          value={collegeChoice}
                          placeholder="Select college"
                          onChange={(e) => setCollegeChoice(e.target.value)}
                          options={COLLEGE_OPTIONS}
                        />
                      </Field>
                    </div>

                    <AnimatePresence initial={false} mode="wait">
                      {!isInternal && (
                        <motion.div
                          key="external"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                            <Field label="College name" required>
                              <input required className={inputCls} value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="e.g. IIT Delhi" />
                            </Field>
                            <Field label="College state" required>
                              <CustomSelect
                                required
                                value={collegeState}
                                placeholder="Select college state"
                                onChange={(e) => {
                                  setCollegeState(e.target.value);
                                  setCollegeCity("");
                                }}
                                options={INDIAN_STATES}
                              />
                            </Field>
                            <Field label="College city" required>
                              <CustomSelect
                                required
                                value={collegeCity}
                                placeholder={collegeState ? "Select college city" : "Select state first"}
                                disabled={!collegeState}
                                onChange={(e) => setCollegeCity(e.target.value)}
                                options={collegeState ? (INDIA_STATES_AND_CITIES[collegeState] || ["Other"]) : []}
                              />
                            </Field>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </fieldset>

                  {/* Project */}
                  <fieldset className="space-y-6">
                    <legend className="eyebrow mb-4 flex items-center gap-2">
                      <FileText size={12} /> Project
                    </legend>
                    <div className="grid grid-cols-1 gap-5">
                      <Field label="Project title" required>
                        <input required className={inputCls} value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="e.g. Real-time flood risk from satellite imagery" />
                      </Field>
                      <div>
                        <span className={labelCls}>
                          Abstract <span className="text-plasma">*</span>
                          <span className="ml-2 font-mono text-[10px] text-muted normal-case tracking-normal">
                            PPTX only · max 10 MB
                          </span>
                        </span>
                        <FileDrop file={abstractFile} onPick={() => fileInputRef.current?.click()} onClear={clearFile} />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          onChange={onFilePick}
                          className="sr-only"
                        />
                        <p className="mt-2 text-xs text-muted">
                          Note: Ensure your submitting in the same template provided in the website.
                        </p>
                      </div>
                    </div>
                  </fieldset>

                  {/* Leader */}
                  <fieldset className="space-y-6">
                    <legend className="eyebrow mb-4 flex items-center gap-2">
                      <User size={12} /> Team leader
                    </legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field label="Name" required>
                        <input required className={inputCls} value={leaderName} onChange={(e) => setLeaderName(e.target.value)} placeholder="Full name" />
                      </Field>
                      <Field label="Email" required>
                        <input required type="email" autoComplete="email" className={inputCls} value={leaderEmail} onChange={(e) => setLeaderEmail(e.target.value)} placeholder="you@example.com" />
                      </Field>
                      <Field label="Phone number" required>
                        <input required type="tel" className={inputCls} value={leaderPhone} onChange={(e) => setLeaderPhone(e.target.value)} placeholder="10-digit number" />
                      </Field>
                      {isInternal && (
                        <Field label="Year" required>
                          <CustomSelect
                            required
                            value={leaderYear}
                            placeholder="Select year"
                            onChange={(e) => setLeaderYear(e.target.value)}
                            options={YEAR_OPTIONS}
                          />
                        </Field>
                      )}
                      <AnimatePresence initial={false}>
                        {isInternal && (
                          <motion.div
                            key="leader-academic"
                            className="contents"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <Field label="Roll number" required>
                              <input required className={inputCls} value={leaderRoll} onChange={(e) => setLeaderRoll(e.target.value.toUpperCase())} placeholder="e.g. 21A81A0500" />
                            </Field>
                            <Field label="Department" required full>
                              <CustomSelect
                                required
                                value={leaderDept}
                                placeholder="Select department"
                                onChange={(e) => setLeaderDept(e.target.value)}
                                options={DEPARTMENT_OPTIONS}
                              />
                            </Field>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </fieldset>

                  {/* Members */}
                  <fieldset className="space-y-6">
                    <legend className="eyebrow mb-4 flex items-center gap-2">
                      <Users size={12} /> Team members ({requiredMembers})
                    </legend>
                    <div className="space-y-6">
                      <AnimatePresence initial={false}>
                        {visibleMembers.map((m, i) => (
                          <motion.div
                            key={i}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3 }}
                            className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5"
                          >
                            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted mb-4">
                              Member {i + 2}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <Field label="Name" required>
                                <input required className={inputCls} value={m.name} onChange={(e) => updateMember(i, { name: e.target.value })} placeholder="Full name" />
                              </Field>
                              <Field label="Phone number" required>
                                <input required type="tel" className={inputCls} value={m.phone ?? ""} onChange={(e) => updateMember(i, { phone: e.target.value })} placeholder="10-digit number" />
                              </Field>
                              {i === 0 && (
                                <Field label="Email" required full>
                                  <input required type="email" className={inputCls} value={m.email ?? ""} onChange={(e) => updateMember(i, { email: e.target.value })} placeholder="member@example.com" />
                                </Field>
                              )}
                              {isInternal && (
                                <>
                                  <Field label="Year" required>
                                    <CustomSelect
                                      required
                                      value={m.year ?? ""}
                                      placeholder="Select year"
                                      onChange={(e) => updateMember(i, { year: e.target.value })}
                                      options={YEAR_OPTIONS}
                                    />
                                  </Field>
                                  <Field label="Roll number" required>
                                    <input required className={inputCls} value={m.roll_number ?? ""} onChange={(e) => updateMember(i, { roll_number: e.target.value.toUpperCase() })} placeholder="e.g. 21A81A0500" />
                                  </Field>
                                  <Field label="Department" required full>
                                    <CustomSelect
                                      required
                                      value={m.department ?? ""}
                                      placeholder="Select department"
                                      onChange={(e) => updateMember(i, { department: e.target.value })}
                                      options={DEPARTMENT_OPTIONS}
                                    />
                                  </Field>
                                </>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </fieldset>

                  {/* Payment acknowledgement */}
                  <label className="flex items-start gap-3 rounded-xl border border-gold/25 bg-gold/[0.04] p-4 cursor-pointer select-none hover:border-gold/40 transition-colors">
                    <input
                      type="checkbox"
                      required
                      checked={paymentAck}
                      onChange={(e) => setPaymentAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-gold shrink-0"
                    />
                    <span className="text-sm text-fg/90">
                      I acknowledge that <span className="text-gold font-medium">payment of ₹400 per head</span> must be completed <span className="underline decoration-gold/60 underline-offset-2">only after our abstract has been shortlisted / finalized</span>. No payment is due at registration.
                    </span>
                  </label>

                  {/* Abstract-template acknowledgement */}
                  <label className="flex items-start gap-3 rounded-xl border border-lumen/25 bg-lumen/[0.04] p-4 cursor-pointer select-none hover:border-lumen/40 transition-colors">
                    <input
                      type="checkbox"
                      required
                      checked={abstractAck}
                      onChange={(e) => setAbstractAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-lumen shrink-0"
                    />
                    <span className="text-sm text-fg/90">
                      I confirm that our abstract has been prepared and submitted using the <span className="text-lumen font-medium">provided SPECATHON PPT template</span>.
                    </span>
                  </label>

                  {status.kind === "err" && (
                    <div className="flex items-start gap-3 rounded-lg border border-ember/40 bg-ember/[0.08] p-4 text-sm text-ember">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>{status.msg}</span>
                    </div>
                  )}

                  <div className="flex justify-center sm:justify-start">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={(import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || "1x00000000000000000000AA"}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={() => setStatus({ kind: "err", msg: "Security challenge failed. Please refresh." })}
                      onExpire={() => setTurnstileToken("")}
                      options={{ theme: "dark" }}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4 pt-4 border-t border-white/[0.06]">
                    <p className="text-xs text-muted max-w-md mx-auto sm:mx-0">
                      By registering, the leader confirms all members consent to the code of conduct and the on-site schedule.
                    </p>
                    <button
                      type="submit"
                      disabled={busy || !canSubmit}
                      title={!canSubmit ? "Tick both acknowledgements above to continue" : undefined}
                      className={
                        canSubmit
                          ? "btn-primary disabled:opacity-70 mx-auto sm:mx-0"
                          : "inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium bg-panel/60 border border-line text-muted cursor-not-allowed shadow-none mx-auto sm:mx-0"
                      }
                    >
                      {busy ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {submitLabel}
                        </>
                      ) : (
                        <>{submitLabel}</>
                      )}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={full ? "md:col-span-2 block" : "block"}>
      <span className={labelCls}>
        {label} {required && <span className="text-plasma">*</span>}
      </span>
      {children}
    </label>
  );
}

interface CustomSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  value: string | number;
  placeholder: string;
  options: readonly (string | number)[] | { label: string; value: string | number }[];
}

function CustomSelect({ value, placeholder, options, className = "", disabled, ...props }: CustomSelectProps) {
  const isPlaceholder = value === "" || value === undefined || value === null;

  return (
    <div className={`relative group ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      <select
        value={value}
        disabled={disabled}
        className={`w-full rounded-xl px-4 py-3 pr-10 text-sm font-body transition-all duration-300 appearance-none outline-none cursor-pointer bg-panel/40 border border-line hover:border-lumen/40 focus:border-lumen/70 focus:bg-panel/70 focus:shadow-[0_0_0_3px_rgba(74,203,235,0.12),0_0_22px_-6px_rgba(74,203,235,0.5)] ${isPlaceholder ? "text-muted/70" : "text-fg font-medium"
          } ${className}`}
        {...props}
      >
        <option value="" disabled className="bg-[#0B0F17] text-muted/60">
          {placeholder}
        </option>
        {options.map((opt) => {
          const val = typeof opt === "object" ? opt.value : opt;
          const lbl = typeof opt === "object" ? opt.label : opt;
          return (
            <option key={val} value={val} className="bg-[#0B0F17] text-fg py-2">
              {lbl}
            </option>
          );
        })}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted group-hover:text-lumen/80 group-focus-within:text-lumen group-focus-within:rotate-180 transition-all duration-300">
        <ChevronDown size={16} />
      </div>
    </div>
  );
}

function FileDrop({
  file,
  onPick,
  onClear,
}: {
  file: File | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-lumen/30 bg-lumen/[0.05] px-4 py-3 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <FileText size={16} className="text-lumen shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-fg">{file.name}</div>
            <div className="text-[11px] text-muted font-mono">
              {(file.size / 1024).toFixed(0)} KB · {file.type.split("/").pop()?.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onPick} className="text-xs text-fg/80 hover:text-lumen">
            Replace
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove file"
            className="h-7 w-7 rounded-md border border-white/[0.08] flex items-center justify-center hover:text-ember hover:border-ember/40"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full flex items-center gap-3 justify-center rounded-lg border border-dashed border-white/[0.12] bg-white/[0.015] hover:border-lumen/40 hover:bg-lumen/[0.04] px-4 py-5 text-sm text-muted transition-colors"
    >
      <Upload size={16} />
      <span>
        <span className="text-fg">Click to upload</span> your abstract
      </span>
    </button>
  );
}
