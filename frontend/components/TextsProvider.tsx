"use client";

import { createContext, useContext, useState, useCallback, useTransition } from "react";
import { RefreshCw } from "lucide-react";

type Texts = Record<string, string>;

const TextsCtx = createContext<{ texts: Texts; refresh: () => void }>({
  texts: {},
  refresh: () => {},
});

export function TextsProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Texts;
}) {
  const [texts, setTexts] = useState<Texts>(initial);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/texts", { cache: "no-store" });
        if (res.ok) setTexts(await res.json());
      } catch {}
    });
  }, []);

  return (
    <TextsCtx.Provider value={{ texts, refresh }}>
      {children}
      <RefreshFloatButton spinning={isPending} onRefresh={refresh} />
    </TextsCtx.Provider>
  );
}

export function useTexts() {
  return useContext(TextsCtx);
}

function RefreshFloatButton({
  spinning,
  onRefresh,
}: {
  spinning: boolean;
  onRefresh: () => void;
}) {
  return (
    <button
      onClick={onRefresh}
      title="텍스트 새로고침"
      className="neo-button"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 100,
        width: 36,
        height: 36,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: "#FFFFFF",
      }}
    >
      <RefreshCw size={14} style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }} />
    </button>
  );
}
