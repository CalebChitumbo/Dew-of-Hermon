import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./order-theme.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Potter's Shockers Fundraiser — Dew of Hermon Youth Ministry",
  description:
    "Pre-order from the Potter's Shockers fundraising braai. Pick your meal, pay at collection or with mobile money — proceeds support Dew of Hermon Youth Ministry.",
};

export default function FundraisingOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fundraising-order-root ${fraunces.variable} ${manrope.variable}`}
    >
      {children}
    </div>
  );
}
