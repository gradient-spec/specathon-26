import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/services/supabase";

export interface LiveConfig {
  youtubeVideoId: string;
  youtubeUrl: string;
  eventState: "BEFORE" | "LIVE" | "AFTER";
  activeMode: "auto" | "manual";
  manualActiveEventId: string | null;
  updatedAt?: string;
}

const STORAGE_KEY = "specathon_live_config";

const DEFAULT_CONFIG: LiveConfig = {
  youtubeVideoId: "",
  youtubeUrl: "",
  eventState: "LIVE",
  activeMode: "auto",
  manualActiveEventId: null,
};

// Safe local config loader
function loadLocalConfig(): LiveConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("Failed to parse local live config:", e);
  }
  return DEFAULT_CONFIG;
}

export function useLiveConfig() {
  const [config, setConfig] = useState<LiveConfig>(loadLocalConfig);

  // Sync state when storage changes across tabs or window events
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("specathon_live_channel");
        bc.onmessage = (event) => {
          if (event.data && typeof event.data === "object") {
            setConfig((prev) => ({ ...prev, ...event.data }));
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel not supported:", e);
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setConfig((prev) => ({ ...prev, ...JSON.parse(e.newValue!) }));
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorage);

    // Supabase Realtime Broadcast channel (for cross-client real-time sync)
    let supabaseChannel: any = null;
    if (supabase) {
      try {
        supabaseChannel = supabase.channel("live-stream-sync", {
          config: { broadcast: { self: false } },
        });

        supabaseChannel
          .on("broadcast", { event: "live_config_update" }, (payload: { payload: LiveConfig }) => {
            if (payload.payload) {
              setConfig((prev) => {
                const next = { ...prev, ...payload.payload };
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                } catch {}
                return next;
              });
            }
          })
          .subscribe();
      } catch (e) {
        console.warn("Supabase live channel error:", e);
      }
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      if (bc) bc.close();
      if (supabase && supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  }, []);

  const updateConfig = useCallback((newPartial: Partial<LiveConfig>) => {
    setConfig((prev) => {
      const updated: LiveConfig = {
        ...prev,
        ...newPartial,
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save live config to localStorage:", e);
      }

      // Broadcast to other tabs locally
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("specathon_live_channel");
          bc.postMessage(updated);
          bc.close();
        }
      } catch {}

      // Broadcast to remote clients via Supabase Realtime
      if (supabase) {
        try {
          const room = supabase.channel("live-stream-sync");
          room.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              room.send({
                type: "broadcast",
                event: "live_config_update",
                payload: updated,
              });
            }
          });
        } catch (e) {
          console.warn("Failed to broadcast Supabase config update:", e);
        }
      }

      return updated;
    });
  }, []);

  return {
    config,
    updateConfig,
  };
}
