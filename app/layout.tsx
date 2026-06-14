import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIrtist — learn to draw any image, stroke by stroke",
  description:
    "Upload an image and AIrtist breaks it into an ordered sequence of strokes you can follow along with — big forms first, then contours, then detail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
