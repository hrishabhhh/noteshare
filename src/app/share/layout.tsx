import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Shared note | NoteShare",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
