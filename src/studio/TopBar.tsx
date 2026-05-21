import { useEffect, useRef } from "react";
import { BookOpen, CheckCircle2, FileDown, FileImage, Layers, Sparkles, Zap } from "lucide-react";
import { useEditorStore } from "@/state/editorStore";
import { useHistoryStore } from "@/state/historyStore";
import { useOverridesStore } from "@/state/overridesStore";
import { toast } from "sonner";

export function TopBar({ totalPages, totalAyat }: { totalPages: number; totalAyat: number }) {
  const editMode = useEditorStore((s) => s.editMode);
  const setEditMode = useEditorStore((s) => s.setEditMode);

  const entriesCount = useHistoryStore((s) => s.entries.length);
  const initialEntriesRef = useRef(entriesCount);

  // Track the history count when entering edit mode
  useEffect(() => {
    if (editMode) {
      initialEntriesRef.current = entriesCount;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  const hasNewChanges = editMode && entriesCount > initialEntriesRef.current;

  const handlePreviewClick = () => {
    if (hasNewChanges) {
      // Data is auto-persisted via zustand/persist — just confirm with a toast
      toast.success("পরিবর্তন স্বয়ংক্রিয়ভাবে সেভ হয়েছে ✓", {
        description: "LocalStorage-এ সব পরিবর্তন সংরক্ষিত।",
        duration: 3000,
      });
    }
    setEditMode(false);
  };

  const handleExportPNG = () => {
    toast.info("PNG রপ্তানি", {
      description: "ব্রাউজার Print (Ctrl+P) → 'Save as PDF' → PNG হিসেবে সেভ করুন। নেটিভ PNG এক্সপোর্ট শীঘ্রই আসছে।",
      duration: 5000,
    });
  };

  const handleExportPDF = () => {
    toast.info("PDF রপ্তানি — শীঘ্রই আসছে!", {
      description: "এই ফিচারটি পরবর্তী আপডেটে যুক্ত হবে।",
      duration: 4000,
    });
  };

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-neutral-100 shadow-lg">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 text-neutral-950 shadow-md shadow-amber-900/40">
          <BookOpen className="h-4.5 w-4.5" strokeWidth={2.5} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-neutral-950">
            <span className="h-1 w-1 rounded-full bg-neutral-950" />
          </span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-wide text-neutral-100" style={{ fontFamily: "var(--font-arabic)" }}>
            কুরআন পাবলিশার
          </span>
          <span className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">
            Professional Publishing Suite
          </span>
        </div>
      </div>

      {/* Center nav */}
      <div className="flex items-center gap-1">
        <NavPill
          icon={Layers}
          label="প্রিভিউ"
          active={!editMode}
          onClick={handlePreviewClick}
        />
        <NavPill
          icon={Sparkles}
          label="এডিটর"
          active={editMode}
          onClick={() => setEditMode(true)}
        />
        {/* Auto-save indicator */}
        {editMode && hasNewChanges && (
          <span className="ml-2 flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-2.5 w-2.5" />
            অটো-সেভ
          </span>
        )}
      </div>

      {/* Right stats + actions */}
      <div className="flex items-center gap-2">
        <StatBadge label="আয়াত" value={totalAyat.toLocaleString("bn-BD")} />
        <StatBadge label="পেজ" value={totalPages.toLocaleString("bn-BD")} />

        <div className="mx-1 h-5 w-px bg-neutral-800" />

        <button
          id="btn-export-png"
          onClick={handleExportPNG}
          title="PNG হিসেবে রপ্তানি করুন"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-all hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300 active:scale-95"
        >
          <FileImage className="h-3.5 w-3.5" />
          PNG
        </button>

        <button
          id="btn-export-pdf"
          onClick={handleExportPDF}
          title="PDF হিসেবে রপ্তানি করুন"
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-3.5 py-1.5 text-xs font-bold text-neutral-950 shadow-md shadow-amber-900/30 transition-all hover:from-amber-300 hover:to-amber-500 hover:shadow-lg active:scale-95"
        >
          <FileDown className="h-3.5 w-3.5" />
          PDF রপ্তানি
        </button>

        <button
          id="btn-quick-publish"
          title="Quick publish"
          className="grid h-7 w-7 place-items-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
        >
          <Zap className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

function NavPill({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="font-bold text-amber-300">{value}</span>
    </div>
  );
}
