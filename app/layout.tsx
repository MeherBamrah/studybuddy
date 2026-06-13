import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyBuddy — AI Study Assistant powered by Gemini",
  description: "Upload any PDF, image, or notes and chat with Gemini to understand, quiz yourself, and study smarter.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
