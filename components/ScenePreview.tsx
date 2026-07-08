"use client";

import type { VisualNovelScene } from "@/lib/parser/types";

type Props = {
  scene?: VisualNovelScene;
  current: number;
  total: number;
  autoPlay: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggleAutoPlay: () => void;
};

const backgroundClass: Record<string, string> = {
  "dawn-terminal": "from-amber-100 via-sky-100 to-indigo-100",
  "library-window": "from-violet-100 via-rose-50 to-amber-100",
  "neon-rooftop": "from-cyan-100 via-indigo-100 to-fuchsia-100",
  "quiet-cafe": "from-emerald-100 via-lime-50 to-orange-100",
  "cloud-archive": "from-sky-100 via-white to-indigo-100"
};

const demoScene: VisualNovelScene = {
  id: "demo-scene",
  displayMode: "dialogue",
  speaker: "AI",
  text: "채팅 로그를 변환하면 이곳에서 클릭해 읽는 장면형 스토리로 미리 볼 수 있습니다.",
  background: "cloud-archive",
  emotion: "thoughtful",
  characters: []
};

export function ScenePreview({
  scene,
  current,
  total,
  autoPlay,
  onPrevious,
  onNext,
  onToggleAutoPlay
}: Props) {
  const displayScene = scene ?? demoScene;
  const displayTotal = Math.max(total, 1);
  const displayCurrent = Math.min(current + 1, displayTotal);
  const gradient = backgroundClass[displayScene.background] ?? backgroundClass["cloud-archive"];
  const isCode = displayScene.type === "code" || displayScene.emotion === "code";

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-soft">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">VN 미리보기</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Space, Enter, 방향키로 장면을 넘길 수 있습니다.</p>
        </div>
        <span className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-extrabold text-indigo-600">
          {displayCurrent} / {displayTotal}
        </span>
      </div>

      <div
        className={`relative aspect-video overflow-hidden rounded-[26px] border border-slate-200 bg-gradient-to-br ${gradient} shadow-inner`}
        aria-label="비주얼 노벨 플레이어"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.88),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,.55),transparent_24%),linear-gradient(to_top,rgba(255,255,255,.4),transparent_58%)]" />
        <div className="absolute left-5 top-5 rounded-full bg-white/80 px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-indigo-500 shadow-sm backdrop-blur">
          VISUAL NOVEL
        </div>

        <div className="absolute inset-x-0 bottom-[30%] flex justify-center px-6">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[38%] border border-white/80 bg-white/70 shadow-xl backdrop-blur sm:h-36 sm:w-36">
            <div className="absolute -bottom-7 rounded-full bg-white px-4 py-1 text-xs font-extrabold text-slate-700 shadow-md">
              {displayScene.speaker}
            </div>
            <div className="relative h-16 w-16 rounded-full bg-orange-100 shadow-inner sm:h-24 sm:w-24">
              <div className="absolute left-1/2 top-5 h-3 w-3 -translate-x-5 rounded-full bg-slate-700 sm:top-7 sm:h-4 sm:w-4 sm:-translate-x-7" />
              <div className="absolute left-1/2 top-5 h-3 w-3 translate-x-2 rounded-full bg-slate-700 sm:top-7 sm:h-4 sm:w-4 sm:translate-x-3" />
              <div className="absolute bottom-4 left-1/2 h-2 w-10 -translate-x-1/2 rounded-full bg-indigo-200 sm:bottom-6 sm:w-14" />
            </div>
          </div>
        </div>

        <div className="absolute inset-x-3 bottom-3 rounded-[22px] border border-white/80 bg-white/[0.82] p-3 text-slate-800 shadow-xl backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-extrabold text-indigo-700">
              {displayScene.speaker}
            </span>
          </div>
          <div className="max-h-[96px] overflow-y-auto pr-1 text-sm leading-6 text-slate-700 sm:max-h-[132px] sm:text-base sm:leading-7">
            {isCode ? (
              <pre className="whitespace-pre-wrap rounded-2xl bg-slate-900 p-3 font-mono text-xs leading-5 text-lime-100 sm:text-sm">
                {displayScene.text}
              </pre>
            ) : (
              <p className="whitespace-pre-wrap">{displayScene.text}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onPrevious}
          disabled={current === 0 || total === 0}
          className="min-h-11 rounded-full bg-slate-100 px-4 font-bold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onToggleAutoPlay}
          disabled={total === 0}
          className="min-h-11 rounded-full bg-violet-100 px-3 text-sm font-extrabold text-violet-700 transition hover:bg-violet-200 focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-45"
          aria-pressed={autoPlay}
        >
          {autoPlay ? "자동재생 끄기" : "자동재생 켜기"}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={current >= total - 1 || total === 0}
          className="min-h-11 rounded-full bg-indigo-500 px-4 font-extrabold text-white transition hover:bg-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          다음
        </button>
      </div>
    </section>
  );
}
