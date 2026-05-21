// Static URL map for the 12 Tajweed top-symbol SVGs. Vite resolves each
// import to a hashed asset URL at build time.

import s1 from "@/assets/tajweed/1.svg";
import s2 from "@/assets/tajweed/2.svg";
import s3 from "@/assets/tajweed/3.svg";
import s4 from "@/assets/tajweed/4.svg";
import s5 from "@/assets/tajweed/5.svg";
import s6 from "@/assets/tajweed/6.svg";
import s7 from "@/assets/tajweed/7.svg";
import s8 from "@/assets/tajweed/8.svg";
import s9 from "@/assets/tajweed/9.svg";
import s10 from "@/assets/tajweed/10.svg";
import s11 from "@/assets/tajweed/11.svg";
import s12 from "@/assets/tajweed/12.svg";

export type TopSymbolId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const TAJWEED_SVG: Record<TopSymbolId, string> = {
  1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6,
  7: s7, 8: s8, 9: s9, 10: s10, 11: s11, 12: s12,
};

export const TAJWEED_RULE_NAMES: Record<TopSymbolId, string> = {
  1: "মদ্দ-এ-আসলি",
  2: "আরযি সাকিন (ওয়াকফ)",
  3: "মদ্দ-এ-মুনফাসিল",
  4: "মদ্দ-এ-মুত্তাসিল",
  5: "মদ্দ-এ-ইওয়াদ",
  6: "মদ্দ + আরযি সাকিন",
  7: "ওয়াজিব গুন্নাহ (মীম/নুন শদ্দা)",
  8: "ক্বলক্বলাহ",
  9: "লেক্সিক্যাল ব্যতিক্রম",
  10: "শিস (ز س ص)",
  11: "ইখফা (নুন সাকিন/তানওয়িন)",
  12: "ওয়াকফের শেষ অক্ষর",
};

export const ALL_RULE_IDS: TopSymbolId[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];
