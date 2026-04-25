"use client";
import { createContext, useContext } from "react";
import type { Texts } from "@/lib/types";

const TextsContext = createContext<Texts>({});

export function TextsProvider({ texts, children }: { texts: Texts; children: React.ReactNode }) {
  return <TextsContext.Provider value={texts}>{children}</TextsContext.Provider>;
}

export function useTexts(): Texts {
  return useContext(TextsContext);
}

export function t(texts: Texts, key: string, fallback = ""): string {
  return texts[key] ?? fallback;
}
