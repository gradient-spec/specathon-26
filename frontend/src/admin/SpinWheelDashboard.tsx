import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Settings, Trophy, RefreshCcw } from "lucide-react";
import { getWheelConfig, updateWheelConfig, listSpinAttempts, type WheelConfig, type SpinAttempt } from "@/services/admin";

export default function SpinWheelDashboard() {
  const [config, setConfig] = useState<WheelConfig | null>(null);
  const [attempts, setAttempts] = useState<SpinAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cfg, att] = await Promise.all([getWheelConfig(), listSpinAttempts()]);
      setConfig(cfg);
      setAttempts(att);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load wheel data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdateConfig = async (updates: Partial<WheelConfig>) => {
    if (!config) return;
    setUpdating(true);
    try {
      await updateWheelConfig(updates);
      setConfig({ ...config, ...updates });
      toast.success("Wheel configuration updated");
    } catch (e) {
      toast.error("Failed to update config");
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    );
  }

  const testPrize1 = attempts.find((a) => a.mode === "TEST" && a.result === "PRIZE_1");
  const testPrize2 = attempts.find((a) => a.mode === "TEST" && a.result === "PRIZE_2");
  const livePrize1 = attempts.find((a) => a.mode === "LIVE" && a.result === "PRIZE_1");
  const livePrize2 = attempts.find((a) => a.mode === "LIVE" && a.result === "PRIZE_2");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-medium text-fg">Spin Wheel Control</h2>
          <p className="text-sm text-muted">Manage global state and view outcomes</p>
        </div>
        <button onClick={load} className="btn-secondary px-3 py-2 text-xs" disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-xl p-6 border border-line">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="text-muted" size={18} />
              <h3 className="font-medium">Global Configuration</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-surface/50 rounded-lg border border-line">
                <div>
                  <div className="text-sm font-medium">Wheel Status</div>
                  <div className="text-xs text-muted">Allow teams to spin</div>
                </div>
                <button
                  disabled={updating}
                  onClick={() => handleUpdateConfig({ is_enabled: !config.is_enabled })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    config.is_enabled ? "bg-emerald/20 text-emerald" : "bg-surface border border-line text-muted"
                  }`}
                >
                  {config.is_enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface/50 rounded-lg border border-line">
                <div>
                  <div className="text-sm font-medium">Global Mode</div>
                  <div className="text-xs text-muted">Isolates TEST vs LIVE state</div>
                </div>
                <div className="flex bg-surface rounded-lg p-1 border border-line">
                  <button
                    disabled={updating}
                    onClick={() => handleUpdateConfig({ current_mode: "TEST" })}
                    className={`px-3 py-1 rounded-md text-xs font-medium ${
                      config.current_mode === "TEST" ? "bg-ember/20 text-ember" : "text-muted hover:text-fg"
                    }`}
                  >
                    TEST
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => handleUpdateConfig({ current_mode: "LIVE" })}
                    className={`px-3 py-1 rounded-md text-xs font-medium ${
                      config.current_mode === "LIVE" ? "bg-blue-500/20 text-blue-400" : "text-muted hover:text-fg"
                    }`}
                  >
                    LIVE
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  { key: 'prize_1_name', label: 'Prize 1 Display Name' },
                  { key: 'prize_2_name', label: 'Prize 2 Display Name' },
                  { key: 'better_luck_a_name', label: 'Better Luck A Display Name' },
                  { key: 'better_luck_b_name', label: 'Better Luck B Display Name' },
                  { key: 'dummy_1_name', label: 'Dummy 1 Display Name' },
                  { key: 'dummy_2_name', label: 'Dummy 2 Display Name' },
                  { key: 'dummy_3_name', label: 'Dummy 3 Display Name' },
                  { key: 'dummy_4_name', label: 'Dummy 4 Display Name' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-muted mb-1 block">{field.label}</label>
                    <input
                      type="text"
                      disabled={updating}
                      defaultValue={config[field.key as keyof typeof config] as string}
                      onBlur={(e) => {
                        if (e.target.value !== config[field.key as keyof typeof config]) {
                          handleUpdateConfig({ [field.key]: e.target.value });
                        }
                      }}
                      className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lumen transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-line">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="text-muted" size={18} />
              <h3 className="font-medium">Prize Winners ({config.current_mode})</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-surface/50 rounded-lg border border-line">
                <div className="text-xs font-medium text-muted mb-1">PRIZE 1: {config.prize_1_name}</div>
                {config.current_mode === "TEST" ? (
                  testPrize1 ? (
                    <div className="text-sm font-medium text-emerald">{testPrize1.team?.team_name || "Unknown"} ({testPrize1.team?.team_id})</div>
                  ) : (
                    <div className="text-sm text-muted italic">Not won yet</div>
                  )
                ) : (
                  livePrize1 ? (
                    <div className="text-sm font-medium text-emerald">{livePrize1.team?.team_name || "Unknown"} ({livePrize1.team?.team_id})</div>
                  ) : (
                    <div className="text-sm text-muted italic">Not won yet</div>
                  )
                )}
              </div>

              <div className="p-4 bg-surface/50 rounded-lg border border-line">
                <div className="text-xs font-medium text-muted mb-1">PRIZE 2: {config.prize_2_name}</div>
                {config.current_mode === "TEST" ? (
                  testPrize2 ? (
                    <div className="text-sm font-medium text-emerald">{testPrize2.team?.team_name || "Unknown"} ({testPrize2.team?.team_id})</div>
                  ) : (
                    <div className="text-sm text-muted italic">Not won yet</div>
                  )
                ) : (
                  livePrize2 ? (
                    <div className="text-sm font-medium text-emerald">{livePrize2.team?.team_name || "Unknown"} ({livePrize2.team?.team_id})</div>
                  ) : (
                    <div className="text-sm text-muted italic">Not won yet</div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass rounded-xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h3 className="font-medium">Spin Attempts History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface/50 text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-6 py-3 font-medium">Team</th>
                <th className="px-6 py-3 font-medium">Mode</th>
                <th className="px-6 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted italic">
                    No spin attempts recorded yet.
                  </td>
                </tr>
              ) : (
                attempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-surface/30">
                    <td className="px-6 py-3">{new Date(attempt.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <span className="font-medium text-fg">{attempt.team?.team_name || "Unknown"}</span>
                      <span className="text-muted ml-2">({attempt.team?.team_id || "Unknown"})</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${attempt.mode === "TEST" ? "bg-ember/10 text-ember" : "bg-blue-500/10 text-blue-400"}`}>
                        {attempt.mode}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`font-medium ${attempt.result.startsWith("PRIZE") ? "text-emerald" : "text-muted"}`}>
                        {attempt.result.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
