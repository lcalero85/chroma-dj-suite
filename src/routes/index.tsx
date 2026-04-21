import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp } from "@/state/store";
import { ensureRunning, getEngine } from "@/audio/engine";
import { startPositionPolling } from "@/state/controller";
import { installShortcuts } from "@/lib/shortcuts";
import { bootMidi } from "@/midi/engine";
import { Toaster } from "@/components/ui/sonner";
import { TopBar } from "@/components/console/TopBar";
import { Drawer } from "@/components/console/Drawer";
import { BottomTabs } from "@/components/console/BottomTabs";
import { Deck } from "@/components/deck/Deck";
import { Mixer } from "@/components/mixer/Mixer";
import { VideoStage, VideoStageToggle } from "@/components/video/VideoStage";

export const Route = createFileRoute("/")({
  component: Index,
});

let booted = false;

function Index() {
  const skin = useApp((s) => s.skin);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skin);
  }, [skin]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (booted) return;
    booted = true;
    // Lazy boot of audio engine on first user gesture
    const boot = async () => {
      getEngine();
      await ensureRunning();
      startPositionPolling();
      installShortcuts();
      void bootMidi();
      window.removeEventListener("pointerdown", boot);
      window.removeEventListener("keydown", boot);
    };
    window.addEventListener("pointerdown", boot, { once: true });
    window.addEventListener("keydown", boot, { once: true });
    // also init engine sync but suspended
    getEngine();
    startPositionPolling();
    installShortcuts();
    void bootMidi();
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="vdj-app" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ fontSize: 14, letterSpacing: "0.2em", color: "var(--text-3)" }}>LOADING CONSOLE…</div>
      </div>
    );
  }

  return (
    <div className="vdj-app" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopBar />
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 380px minmax(0,1fr)",
          gridTemplateRows: "minmax(0, 1fr)",
          gap: 10,
          padding: 10,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ minHeight: 0, gridColumn: "1 / 2", gridRow: "1 / 2" }}>
          <Deck id="A" side="left" />
        </div>
        <div style={{ gridColumn: "2 / 3", gridRow: "1 / 2", minHeight: 0, overflow: "hidden" }}>
          <Mixer />
        </div>
        <div style={{ minHeight: 0, gridColumn: "3 / 4", gridRow: "1 / 2" }}>
          <Deck id="B" side="right" />
        </div>
      </div>
      <div style={{ height: "32%", minHeight: 240, padding: "0 10px 10px 10px", overflow: "hidden", flexShrink: 0 }}>
        <BottomTabs />
      </div>
      <Drawer />
      <VideoStage />
      <VideoStageToggle />
      <Toaster />
    </div>
  );
}
