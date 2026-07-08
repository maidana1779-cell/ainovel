"use client";

type Props = {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onConvert: () => void;
};

export function ChatLogInput({ value, error, onChange, onConvert }: Props) {
  const isEmpty = value.trim().length === 0;

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-soft">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">로그 입력</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ChatGPT, Claude, Gemini 대화를 붙여넣으면 역할, 문단, 코드블록을 장면으로 정리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onConvert}
          className="min-h-11 rounded-full bg-indigo-500 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        >
          변환하기
        </button>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`User: 오늘 대화를 비주얼 노벨처럼 보여줘.\nAssistant: 좋아요. 첫 장면은 밝은 작업실에서 시작합니다.\n\n나: 코드블록도 장면으로 분리할 수 있어?\nAI: 물론입니다.\n\n\`\`\`ts\nconst scene = { speaker: "AI", emotion: "thoughtful" };\n\`\`\``}
        className="min-h-[380px] w-full resize-y rounded-[22px] border border-slate-200 bg-slate-50/80 p-5 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
      />

      {isEmpty ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          아직 입력된 로그가 없습니다. 샘플을 불러오거나 예시처럼 대화를 붙여넣어 보세요.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
