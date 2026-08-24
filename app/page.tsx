import type { Metadata } from "next";
import { DailyTasksDashboard } from "./DailyTasksDashboard";

export const metadata: Metadata = {
  title: "مهام تمهيد اليومية",
  description: "صفحة تسجيل المهام اليومية.",
};

export default function Home() {
  return <DailyTasksDashboard />;
}
