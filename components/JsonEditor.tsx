"use client";

type Props = {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
};

export function JsonEditor({ value, error, onChange }: Props) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-soft">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">고급 편집 모드</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Scene JSON을 직접 편집합니다. `speaker`, `text`, `background`, `emotion` 값을 유지해주세요.
          </p>
        </div>
        <span className={error ? "text-sm font-bold text-rose-600" : "text-sm font-bold text-emerald-600"}>
          {error ? "JSON 오류" : "JSON 정상"}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="h-[430px] w-full resize-y rounded-[22px] border border-slate-200 bg-slate-50 p-5 font-mono text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
      />
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
