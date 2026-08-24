import type { Metadata } from "next";
import { DailyTasksDashboard } from "./DailyTasksDashboard";

export const metadata: Metadata = {
  title: "مهام تمهيد اليومية",
  description: "سجل يومي واضح للمهام والإنجازات والاعتمادات.",
};

export default function Home() {
  return <DailyTasksDashboard />;
}
