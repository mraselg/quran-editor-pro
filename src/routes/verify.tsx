import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import versesData from "@/data/verses.json";
import { VerseRow, type Verse } from "@/components/verify/VerseRow";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [{ title: "Tajweed Verify — Al-Baqarah 1–18" }],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const verses = useMemo(
    () =>
      (versesData as Verse[]).filter(
        (v) => v.s === 2 && v.v >= 1 && v.v <= 18,
      ),
    [],
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <header className="mb-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Tajweed Verify — Al-Baqarah 1–18</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Left: Arabic with Kariana symbols inline. Right: word-by-word breakdown.
        </p>
      </header>

      <div className="max-w-5xl mx-auto space-y-8">
        {verses.map((verse) => (
          <VerseRow key={verse.id} verse={verse} />
        ))}
      </div>
    </div>
  );
}
