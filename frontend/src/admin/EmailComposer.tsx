import { useState, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Mail, RefreshCcw, Eye, Edit3, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_SUBJECT = "Congratulations! {{team_name}} has been shortlisted for SPECATHON 2026";
const DEFAULT_BODY = `<p>Hello {{team_lead_name}},</p>
<p><br></p>
<p>Congratulations!</p>
<p><br></p>
<p>Your team, <strong>{{team_name}}</strong>, has been shortlisted for SPECATHON 2026.</p>
<p><br></p>
<p>Team ID: <strong>{{team_id}}</strong></p>
<p><br></p>
<p>Your team credentials are:</p>
<p><br></p>
<p>Username: <strong>{{username}}</strong><br>
Password: <strong>{{password}}</strong></p>
<p><br></p>
<p>Please keep these credentials safe. They will be required for the next stage of the SPECATHON process.</p>
<p><br></p>
<p>We look forward to seeing your team at SPECATHON 2026.</p>
<p><br></p>
<p>Regards,<br>
SPECATHON 2026<br>
Gradient Technical Club</p>`;

const VARIABLES = [
  { label: "Team Lead Name", token: "{{team_lead_name}}", preview: "Alex Kumar" },
  { label: "Team Name", token: "{{team_name}}", preview: "Team Alpha" },
  { label: "Team ID", token: "{{team_id}}", preview: "SPC2026-001" },
  { label: "Username", token: "{{username}}", preview: "SPC2026-001" },
  { label: "Password", token: "{{password}}", preview: "••••••••" },
];

export default function EmailComposer() {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const quillRef = useRef<ReactQuill>(null);

  const insertVariable = (token: string) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection(true); // forces focus
    const index = range ? range.index : editor.getLength();
    editor.insertText(index, token);
    editor.setSelection(index + token.length, 0);
  };

  const handleReset = () => {
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    toast.success("Template reset to default");
  };

  const handleSaveDraft = () => {
    // Local state is sufficient for this step.
    toast.success("Draft saved locally");
  };

  const renderPreview = (text: string) => {
    let result = text;
    VARIABLES.forEach((v) => {
      // Replace globally (case-insensitive if needed, but exact matches are fine here)
      const regex = new RegExp(v.token, "g");
      result = result.replace(regex, v.preview);
    });
    return result;
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["link"],
      ["clean"],
    ],
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="eyebrow flex items-center gap-2">
          <Mail size={14} className="text-plasma" /> V2 · Email Automation
        </div>
        <div className="flex items-center justify-between mt-2">
          <h2 className="font-display text-2xl md:text-3xl tracking-tightest">
            Shortlist Email Template
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted hover:text-fg hover:bg-panel/40 transition-colors"
            >
              <RefreshCcw size={12} /> Reset
            </button>
            <button
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-plasma text-void hover:bg-plasma/90 transition-colors"
            >
              <Save size={12} /> Save Draft
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted leading-relaxed max-w-2xl">
          Design the email sent to teams when they are shortlisted. Use variables
          to dynamically insert team details.
        </p>

        <div className="mt-4 p-3 rounded-xl border border-gold/30 bg-gold/10 flex gap-3 max-w-2xl">
          <AlertCircle size={16} className="text-gold shrink-0 mt-0.5" />
          <div className="text-sm text-gold/90">
            <p className="font-medium">Preview Only (Step 3B)</p>
            <p className="mt-1 opacity-90">The Email Composer remains a preview/local-draft in Step 3B. Actual template persistence and server-side retrieval will be implemented in a later Email Template Persistence step. Emails sent now will use the safe default template.</p>
          </div>
        </div>
      </div>

      {/* Editor / Preview Toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-line bg-panel/40 p-1 w-fit">
        <button
          onClick={() => setView("edit")}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            view === "edit"
              ? "bg-plasma/20 border border-plasma/30 text-fg"
              : "text-muted hover:text-fg"
          }`}
        >
          <Edit3 size={14} /> Compose
        </button>
        <button
          onClick={() => setView("preview")}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            view === "preview"
              ? "bg-plasma/20 border border-plasma/30 text-fg"
              : "text-muted hover:text-fg"
          }`}
        >
          <Eye size={14} /> Preview
        </button>
      </div>

      {view === "edit" ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-line bg-panel/40 px-4 py-3 text-sm text-fg focus:border-lumen/60 focus:outline-none"
              placeholder="Email subject..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-end justify-between">
              <label className="text-xs uppercase tracking-wider text-muted">Body HTML</label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted mr-1">Insert:</span>
                {VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVariable(v.token)}
                    className="px-2 py-1 text-[11px] font-mono text-plasma bg-plasma/10 border border-plasma/20 rounded hover:bg-plasma/20 transition-colors"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/*
              We use a wrapper with styling overrides because react-quill's default snow theme
              assumes a light background and light borders.
            */}
            <div className="rounded-xl border border-line bg-white text-black overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-line [&_.ql-container]:border-none [&_.ql-editor]:min-h-[300px] [&_.ql-editor]:text-sm">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={body}
                onChange={setBody}
                modules={modules}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-panel/40 overflow-hidden flex flex-col">
          {/* Mock Email Header */}
          <div className="border-b border-line bg-void/50 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted w-12">From:</div>
              <div className="text-sm font-medium">SPECATHON &lt;noreply@gradientclub.in&gt;</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted w-12">To:</div>
              <div className="text-sm text-fg/80">alex.kumar@example.com <span className="text-[10px] text-muted ml-2">(Sample Data)</span></div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div className="text-xs text-muted w-12">Subject:</div>
              <div className="text-sm font-medium">{renderPreview(subject)}</div>
            </div>
          </div>
          {/* Mock Email Body */}
          <div className="p-8 bg-white text-black">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview(body) }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
