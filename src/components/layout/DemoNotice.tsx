"use client";

import { resetDemoData } from "@/lib/demo/api";

/** Keeps the demo boundary visible and lets a visitor restore the sample data. */
export function DemoNotice() {
  function reset() {
    if (!window.confirm("Reset this browser's AutoFix demo data and sign out?")) return;
    resetDemoData();
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
      <span><strong>Interactive demo</strong> · changes stay in this browser · no real email or payment is sent</span>
      <button type="button" onClick={reset} className="font-semibold underline underline-offset-2 hover:text-amber-700">Reset demo data</button>
    </div>
  );
}
