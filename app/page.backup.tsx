"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wand2
} from "lucide-react";
import { downloadStandaloneHtml } from "@/lib/exporter/htmlExporter";
import { BACKGROUND_ASSETS, EMOTION_ASSETS, messagesToScenes, parseChatLog } from "@/lib/parser/chatLogParser";
import type { VisualNovelScene } from "@/lib/parser/types";
import type { AssetLibrary, BgmAsset, SceneCharacter } from "@/lib/types";

const STATE_KEY = "ai-log-studio-state-v2";
const ASSET_KEY = "ai-log-studio-assets";
const AUTO_PLAY_MS = 3200;
const IMAGE_LIMIT = 5 * 1024 * 1024;
const BGM_LIMIT = 15 * 1024 * 1024;

const EMPTY_ASSETS: AssetLibrary = {
  standingAssets: [],
  backgroundAssets: [],
  bgmAssets: []
};

const SAMPLE_LOG = `User: 오래된 전망대에서 주인공 리안이 이상한 신호를 듣는 장면을 써줘.
AI: 창밖의 바람은 복도 끝에서 낮게 울렸다. 리안은 낡은 수신기에 손을 얹고, 화면에 떠오른 낯선 문장을 바라보았다.

User: 좋아. 이어서 정체불명의 존재가 대답하는 장면도.
AI: 수신기 너머로 잡음이 가라앉았다. 그리고 아주 가까운 곳에서 속삭이는 듯한 목소리가 들렸다. "드디어 연결됐군요."

\`\`\`ts
const signal = "ACCESS_GRANTED";
\`\`\`

User: 마지막은 조금 설레는 톤으로 정리해줘.
AI: 리안은 처음으로 두려움보다 호기심이 앞섰다. 밤하늘의 별들이 마치 대답처럼 하나씩 밝아졌다.`;

const fallbackScenes = messagesToScenes(parseChatLog(SAMPLE_LOG));

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stringifyScenes(scenes: VisualNovelScene[]) {
  return JSON.stringify(scenes, null, 2);
}

function isSceneArray(value: unknown): value is VisualNovelScene[] {
  if (!Array.isArray(value)) return false;
  return value.every((scene) => {
    if (!scene || typeof scene !== "object") return false;
    const candidate = scene as Record<string, unknown>;
    return typeof candidate.speaker === "string" && typeof candidate.text === "string";
  });
}

function normalizeScenes(scenes: VisualNovelScene[]) {
  return scenes.map((scene, index) => ({
    ...scene,
    id: scene.id ?? uid("scene"),
    sceneNo: index + 1,
    background: scene.background ?? BACKGROUND_ASSETS[index % BACKGROUND_ASSETS.length].id,
    backgroundAsset: scene.backgroundAsset ?? scene.background ?? BACKGROUND_ASSETS[index % BACKGROUND_ASSETS.length].id,
    emotion: scene.emotion ?? "neutral",
    emotionIcon: scene.emotionIcon ?? EMOTION_ASSETS.find((asset) => asset.id === scene.emotion)?.icon ?? "•",
    characters: Array.isArray(scene.characters) ? scene.characters : []
  }));
}

function sanitizeAssets(value: unknown): AssetLibrary {
  if (!value || typeof value !== "object") return EMPTY_ASSETS;
  const candidate = value as Partial<AssetLibrary>;
  return {
    standingAssets: Array.isArray(candidate.standingAssets) ? candidate.standingAssets : [],
    backgroundAssets: Array.isArray(candidate.backgroundAssets) ? candidate.backgroundAssets : [],
    bgmAssets: Array.isArray(candidate.bgmAssets) ? candidate.bgmAssets : []
  };
}

function pruneSceneAssetRefs(scenes: VisualNovelScene[], assets: AssetLibrary) {
  const standingIds = new Set(assets.standingAssets.map((asset) => asset.id));
  const backgroundIds = new Set(assets.backgroundAssets.map((asset) => asset.id));
  const bgmIds = new Set(assets.bgmAssets.map((asset) => asset.id));

  return scenes.map((scene) => ({
    ...scene,
    backgroundAssetId: scene.backgroundAssetId && backgroundIds.has(scene.backgroundAssetId) ? scene.backgroundAssetId : undefined,
    bgmAssetId: scene.bgmAssetId && bgmIds.has(scene.bgmAssetId) ? scene.bgmAssetId : undefined,
    characters: (scene.characters ?? []).map((character) => ({
      ...character,
      assetId: standingIds.has(character.assetId) ? character.assetId : ""
    }))
  }));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "right",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "soft" | "danger" | "ghost" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: React.ElementType;
  iconPosition?: "left" | "right";
}) {
  const variants = {
    primary: "bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] focus:ring-indigo-200",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus:ring-slate-200",
    soft: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100 focus:ring-indigo-200",
    danger: "bg-rose-50 text-rose-600 ring-1 ring-rose-100 hover:bg-rose-100 focus:ring-rose-200",
    ghost: "text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-[0.98] focus:ring-slate-200",
    accent: "bg-purple-600 text-white shadow-sm shadow-purple-200 hover:bg-purple-700 active:scale-[0.98] focus:ring-purple-200"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-[15px]",
    icon: "h-10 w-10 p-0"
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-150 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        size === "icon" ? "rounded-full" : "rounded-xl",
        className
      )}
      {...props}
    >
      {Icon && iconPosition === "left" ? <Icon className="h-4 w-4" /> : null}
      {children}
      {Icon && iconPosition === "right" ? <Icon className="h-4 w-4" /> : null}
    </button>
  );
}

function Card({ children, className, padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-10px_rgba(99,102,241,0.12)]", padded && "p-6", className)}>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{children}</label>;
}

function FontStyles() {
  return (
    <style>{`
      .als-root { font-family: 'Pretendard Variable', Pretendard, 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif; }
      .als-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .als-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 999px; }
      .als-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .als-tail { position: absolute; left: 28px; bottom: -7px; width: 14px; height: 14px; background: inherit; transform: rotate(45deg); border-radius: 3px; }
      .als-vignette { background: radial-gradient(120% 90% at 50% 110%, rgba(0,0,0,0.55), transparent 60%); }
    `}</style>
  );
}

function Badge({
  children,
  tone = "indigo",
  className = ""
}: {
  children: React.ReactNode;
  tone?: "indigo" | "purple" | "rose" | "slate";
  className?: string;
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-100 text-slate-600 border-slate-200"
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

function Avatar({ tone = "slate", size = 8 }: { tone?: "indigo" | "purple" | "slate" | "rose"; size?: 6 | 8 | 9 }) {
  const tones = {
    indigo: "from-indigo-400 to-indigo-600",
    purple: "from-purple-400 to-purple-600",
    slate: "from-slate-300 to-slate-400",
    rose: "from-rose-400 to-rose-600"
  };
  const sizes = {
    6: "h-6 w-6",
    8: "h-8 w-8",
    9: "h-9 w-9"
  };
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br", tones[tone], sizes[size])}>
      <User className="h-4 w-4 text-white" />
    </div>
  );
}

function Hero({
  activeScene,
  assets,
  onConvert,
  onSample,
  onExport,
  onNext,
  bgmEnabled,
  onToggleBgm
}: {
  activeScene: VisualNovelScene;
  assets: AssetLibrary;
  onConvert: () => void;
  onSample: () => void;
  onExport: () => void;
  onNext: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
}) {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-2 lg:px-8">
      <div>
        <Badge tone="purple" className="mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          AI LOG → VISUAL NOVEL
        </Badge>
        <h1 className="text-[2.75rem] font-extrabold leading-[1.15] tracking-tight text-slate-900 md:text-5xl">
          AI 채팅 로그를{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">비주얼 노벨로</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
          ChatGPT, Claude, Gemini 대화를 붙여넣으면 클릭해서 읽는 장면형 스토리로 변환합니다.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" icon={ArrowRight} onClick={onConvert}>변환하기</Button>
          <Button variant="secondary" size="lg" icon={FileText} onClick={onSample}>샘플 로그 보기</Button>
          <Button variant="ghost" size="lg" icon={Download} onClick={onExport}>HTML Export</Button>
        </div>
      </div>

      <VNStage scene={activeScene} assets={assets} onNext={onNext} bgmEnabled={bgmEnabled} onToggleBgm={onToggleBgm} hero />
    </section>
  );
}

function Toolbar({
  onSample,
  onConvert,
  onExport,
  onToggleJson,
  jsonOpen,
  canExport
}: {
  onSample: () => void;
  onConvert: () => void;
  onExport: () => void;
  onToggleJson: () => void;
  jsonOpen: boolean;
  canExport: boolean;
}) {
  const steps = ["로그 붙여넣기", "변환", "장면 수정", "Export"];
  const active = 1;
  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-extrabold text-slate-900">AI Log Studio</span>
        </div>

        <div className="hidden items-center md:flex">
          {steps.map((label, index) => {
            const isActive = index === active;
            const isDone = index < active;
            return (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", isActive ? "bg-indigo-600 text-white" : isDone ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400")}>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className={cn("text-xs font-semibold", isActive ? "text-slate-900" : "text-slate-400")}>{label}</span>
                </div>
                {index < steps.length - 1 ? <div className="mx-3 h-px w-8 bg-slate-200" /> : null}
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" icon={FileText} iconPosition="left" onClick={onSample}>샘플 로그</Button>
          <Button variant="ghost" size="sm" icon={Wand2} iconPosition="left" onClick={onConvert}>변환</Button>
          <Button variant="ghost" size="sm" icon={Download} iconPosition="left" onClick={onExport} disabled={!canExport}>Export</Button>
          <button
            type="button"
            onClick={onToggleJson}
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-colors", jsonOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700")}
            aria-label="고급 편집"
          >
            <Settings className="h-4 w-4" />
          </button>
          <Avatar tone="slate" size={8} />
        </div>
      </div>
    </div>
  );
}

function LogInputCard({
  log,
  onLogChange,
  onConvert,
  error,
  messageCount,
  sceneCount
}: {
  log: string;
  onLogChange: (value: string) => void;
  onConvert: () => void;
  error: string | null;
  messageCount: number;
  sceneCount: number;
}) {
  return (
    <Card className="flex min-h-[620px] flex-col">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">로그 입력</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">ChatGPT/Claude/Gemini 대화를 그대로 붙여넣으세요.</p>
            </div>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">{messageCount} messages</span>
      </div>

      <textarea
        value={log}
        onChange={(event) => onLogChange(event.target.value)}
        spellCheck={false}
        className="min-h-[390px] flex-1 resize-none rounded-[22px] border-0 bg-slate-50 p-5 text-sm leading-7 text-slate-700 shadow-inner shadow-slate-200/50 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-4 focus:ring-indigo-100"
        placeholder={`User: 주인공이 낡은 역에 도착하는 장면을 써줘.\nAssistant: 플랫폼 끝에서 희미한 불빛이 흔들렸다...\n\n나: 이어서 AI가 단서를 발견하는 장면도.\nAI: 화면에는 짧은 문장이 떠올랐다.`}
      />

      {error ? (
        <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-600 ring-1 ring-rose-100">
          {error}
        </div>
      ) : !log.trim() ? (
        <div className="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold leading-6 text-indigo-700 ring-1 ring-indigo-100">
          로그를 넣으면 자동으로 speaker, text, background, emotion, asset 연결용 Scene JSON을 만들 수 있습니다.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-400">{sceneCount} scenes ready</div>
        <Button variant="primary" icon={Wand2} onClick={onConvert}>변환하기</Button>
      </div>
    </Card>
  );
}

function CharacterFocus({ scene, assets }: { scene: VisualNovelScene; assets: AssetLibrary }) {
  const positions: Record<SceneCharacter["position"], string> = {
    left: "left-[13%]",
    center: "left-1/2 -translate-x-1/2",
    right: "right-[13%]"
  };

  return (
    <div className="absolute inset-x-0 bottom-[18%] top-[12%]">
      {(scene.characters ?? []).map((character, index) => {
        const asset = assets.standingAssets.find((item) => item.id === character.assetId);
        return (
          <motion.div
            key={`${character.assetId || character.name}-${character.position}-${index}`}
            animate={{
              opacity: character.isSpeaking ? 1 : 0.4,
              scale: character.isSpeaking ? 1 : 0.92,
              filter: character.isSpeaking ? "blur(0px)" : "blur(3px)"
            }}
            transition={{ duration: 0.2 }}
            className={cn("absolute bottom-0 flex max-h-full max-w-[32%] items-end justify-center", positions[character.position])}
          >
            {asset ? (
              <img src={asset.dataUrl} alt={character.name} className="max-h-[310px] max-w-full object-contain drop-shadow-2xl" />
            ) : (
              <div className="flex h-36 w-24 items-start justify-center rounded-t-full bg-white/55 pt-5 shadow-2xl ring-1 ring-white/70 sm:h-44 sm:w-32">
                <User className="h-10 w-10 text-indigo-500" />
              </div>
            )}
            <span className="absolute -bottom-7 rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-600 shadow-sm ring-1 ring-white">
              {character.name || "Character"}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

function VNStage({
  scene,
  assets,
  onNext,
  bgmEnabled,
  onToggleBgm,
  hero = false
}: {
  scene: VisualNovelScene;
  assets: AssetLibrary;
  onNext: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
  hero?: boolean;
}) {
  const fallbackBg = BACKGROUND_ASSETS.find((asset) => asset.id === (scene.backgroundAsset ?? scene.background)) ?? BACKGROUND_ASSETS[0];
  const uploadedBg = scene.backgroundAssetId ? assets.backgroundAssets.find((asset) => asset.id === scene.backgroundAssetId) : undefined;

  return (
    <div className={cn("relative aspect-video overflow-hidden border border-slate-200 shadow-xl shadow-indigo-100/50", hero ? "rounded-2xl" : "rounded-xl")}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${scene.id}-${scene.backgroundAssetId ?? scene.background}`}
          initial={{ opacity: 0, scale: 1.05, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.97, x: -30 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn("absolute inset-0 bg-gradient-to-br", uploadedBg ? "" : fallbackBg.gradient)}
          style={uploadedBg ? { backgroundImage: `url(${uploadedBg.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_25%_15%,white,transparent_35%),radial-gradient(circle_at_80%_65%,white,transparent_30%)]" />
          <div className="absolute inset-0 als-vignette" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute left-4 top-4">
        <Badge tone="slate" className="!border-white/15 !bg-black/30 !text-white">
          <span>{uploadedBg ? "IMG" : fallbackBg.icon}</span>
          {uploadedBg?.name ?? fallbackBg.label}
        </Badge>
      </div>
      <Button
        variant={bgmEnabled ? "primary" : "secondary"}
        size="sm"
        icon={bgmEnabled ? Pause : Play}
        onClick={onToggleBgm}
        disabled={!scene.bgmAssetId}
        className="absolute right-4 top-4 z-10"
      >
        BGM
      </Button>
      <CharacterFocus scene={scene} assets={assets} />
      <div className="absolute bottom-3 left-3 right-3 z-10 rounded-2xl border border-white/15 bg-slate-900/55 px-4 py-3 pr-12 text-slate-100 shadow-lg shadow-black/20 backdrop-blur-md">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-lg bg-indigo-500/90 px-2.5 py-1 text-xs font-bold text-white">{scene.speaker || "Narration"}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200">{scene.emotionIcon} {scene.emotion}</span>
        </div>
        {scene.type === "code" ? (
          <pre className="als-scrollbar max-h-24 overflow-auto whitespace-pre-wrap rounded-lg bg-black/35 p-2 font-mono text-xs leading-relaxed text-lime-100">{scene.text}</pre>
        ) : (
          <p className="als-scrollbar max-h-24 overflow-auto pr-2 text-[13.5px] leading-relaxed">{scene.text}</p>
        )}
        <button
          type="button"
          onClick={onNext}
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20"
          aria-label="다음 장면"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="als-tail" />
      </div>
    </div>
  );
}

function PreviewCard({
  scene,
  scenesLength,
  current,
  assets,
  autoPlay,
  bgmEnabled,
  onPrev,
  onNext,
  onToggleAuto,
  onToggleBgm
}: {
  scene: VisualNovelScene;
  scenesLength: number;
  current: number;
  assets: AssetLibrary;
  autoPlay: boolean;
  bgmEnabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAuto: () => void;
  onToggleBgm: () => void;
}) {
  const progress = ((current + 1) / Math.max(scenesLength, 1)) * 100;

  return (
    <Card className="flex min-h-[620px] flex-col">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50">
              <Sparkles className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">VN 미리보기</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">장면, 에셋, BGM 연결 결과를 바로 확인합니다.</p>
            </div>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
          {current + 1} / {scenesLength}
        </span>
      </div>

      <VNStage scene={scene} assets={assets} onNext={onNext} bgmEnabled={bgmEnabled} onToggleBgm={onToggleBgm} />

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Button variant="secondary" size="icon" icon={ChevronLeft} onClick={onPrev} disabled={current <= 0} aria-label="이전 장면" />
        <Button variant="primary" icon={ArrowRight} onClick={onNext} disabled={current >= scenesLength - 1}>다음</Button>
        <Button variant={autoPlay ? "primary" : "secondary"} size="icon" icon={autoPlay ? Pause : Play} onClick={onToggleAuto} aria-label="자동재생" />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-indigo-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.25 }} />
      </div>
    </Card>
  );
}

function AssetManager({
  assets,
  onAssetsChange,
  onError
}: {
  assets: AssetLibrary;
  onAssetsChange: (assets: AssetLibrary) => void;
  onError: (message: string | null) => void;
}) {
  const [tab, setTab] = useState<"standing" | "background" | "bgm">("standing");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function uploadFiles(files: FileList | null, kind: typeof tab) {
    if (!files?.length) return;
    const next: AssetLibrary = {
      standingAssets: [...assets.standingAssets],
      backgroundAssets: [...assets.backgroundAssets],
      bgmAssets: [...assets.bgmAssets]
    };

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/") && /\.(png|jpe?g|webp)$/i.test(file.name);
      const isAudio = file.type.startsWith("audio/") && /\.(mp3|wav|ogg)$/i.test(file.name);
      if ((kind === "standing" || kind === "background") && !isImage) {
        onError("이미지 에셋은 png, jpg, webp 파일만 등록할 수 있습니다.");
        continue;
      }
      if (kind === "bgm" && !isAudio) {
        onError("BGM 에셋은 mp3, wav, ogg 파일만 등록할 수 있습니다.");
        continue;
      }
      if ((kind === "standing" || kind === "background") && file.size > IMAGE_LIMIT) {
        onError("이미지 파일은 5MB 이하를 권장합니다.");
        continue;
      }
      if (kind === "bgm" && file.size > BGM_LIMIT) {
        onError("BGM 파일은 15MB 이하를 권장합니다.");
        continue;
      }

      const dataUrl = await fileToDataUrl(file);
      const asset = { id: uid(kind), name: file.name.replace(/\.[^.]+$/, ""), fileName: file.name, dataUrl };
      if (kind === "standing") next.standingAssets.push(asset);
      if (kind === "background") next.backgroundAssets.push(asset);
      if (kind === "bgm") next.bgmAssets.push(asset);
      onError(null);
    }
    onAssetsChange(next);
  }

  function rename(kind: keyof AssetLibrary, id: string, name: string) {
    onAssetsChange({ ...assets, [kind]: assets[kind].map((asset) => (asset.id === id ? { ...asset, name } : asset)) });
  }

  function remove(kind: keyof AssetLibrary, id: string) {
    if (kind === "bgmAssets" && playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    onAssetsChange({ ...assets, [kind]: assets[kind].filter((asset) => asset.id !== id) });
  }

  function togglePreview(asset: BgmAsset) {
    if (!audioRef.current) return;
    if (playingId === asset.id) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    if (!asset.dataUrl) return;
    audioRef.current.src = asset.dataUrl;
    audioRef.current.play().then(() => setPlayingId(asset.id)).catch(() => onError("브라우저 정책상 먼저 재생 버튼을 눌러야 합니다."));
  }

  const tabs = [
    { id: "standing", label: "스탠딩", count: assets.standingAssets.length, icon: User },
    { id: "background", label: "배경", count: assets.backgroundAssets.length, icon: ImageIcon },
    { id: "bgm", label: "BGM", count: assets.bgmAssets.length, icon: Music }
  ] as const;

  return (
    <Card>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">에셋 관리</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">보유한 제작자 에셋을 등록하고 Scene에 연결합니다.</p>
        </div>
        <div className="flex rounded-full bg-slate-100 p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-indigo-100",
                tab === item.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="mb-5 flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-indigo-200 bg-indigo-50/45 px-5 py-8 text-center transition hover:bg-indigo-50">
        <Upload className="h-8 w-8 text-indigo-500" />
        <span className="mt-3 text-sm font-black text-slate-700">파일 업로드</span>
        <span className="mt-1 text-xs font-semibold text-slate-400">
          {tab === "bgm" ? "mp3, wav, ogg / 15MB 이하 권장" : "png, jpg, webp / 5MB 이하 권장"}
        </span>
        <input
          type="file"
          multiple
          accept={tab === "bgm" ? ".mp3,.wav,.ogg,audio/*" : ".png,.jpg,.jpeg,.webp,image/*"}
          onChange={(event) => uploadFiles(event.target.files, tab)}
          className="sr-only"
        />
      </label>

      {tab === "standing" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assets.standingAssets.map((asset) => (
            <div key={asset.id} className="rounded-[22px] bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="flex aspect-[3/4] items-end justify-center overflow-hidden rounded-2xl bg-white">
                <img src={asset.dataUrl} alt={asset.name} className="max-h-full max-w-full object-contain" />
              </div>
              <input value={asset.name} onChange={(event) => rename("standingAssets", asset.id, event.target.value)} className="mt-3 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100" />
              <Button variant="danger" size="sm" icon={Trash2} className="mt-2 w-full" onClick={() => remove("standingAssets", asset.id)}>삭제</Button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "background" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assets.backgroundAssets.map((asset) => (
            <div key={asset.id} className="rounded-[22px] bg-slate-50 p-3 ring-1 ring-slate-100">
              <img src={asset.dataUrl} alt={asset.name} className="aspect-video w-full rounded-2xl object-cover" />
              <input value={asset.name} onChange={(event) => rename("backgroundAssets", asset.id, event.target.value)} className="mt-3 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100" />
              <Button variant="danger" size="sm" icon={Trash2} className="mt-2 w-full" onClick={() => remove("backgroundAssets", asset.id)}>삭제</Button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "bgm" ? (
        <div className="grid gap-3">
          {assets.bgmAssets.map((asset) => (
            <div key={asset.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <Button variant={playingId === asset.id ? "primary" : "secondary"} size="icon" icon={playingId === asset.id ? Pause : Play} onClick={() => togglePreview(asset)} aria-label="BGM 미리듣기" />
              <input value={asset.name} onChange={(event) => rename("bgmAssets", asset.id, event.target.value)} className="min-w-[180px] flex-1 rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100" />
              <span className="max-w-[220px] truncate text-xs font-semibold text-slate-400">{asset.fileName}</span>
              <Button variant="danger" size="sm" icon={Trash2} onClick={() => remove("bgmAssets", asset.id)}>삭제</Button>
            </div>
          ))}
        </div>
      ) : null}

      {assets.standingAssets.length + assets.backgroundAssets.length + assets.bgmAssets.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">
          아직 등록된 에셋이 없습니다. 위 업로드 영역에서 먼저 파일을 추가하세요.
        </div>
      ) : null}
    </Card>
  );
}

function SceneEditor({
  open,
  scenes,
  assets,
  current,
  dragIndex,
  fileInputRef,
  onToggle,
  onSelect,
  onUpdateScene,
  onUpdateCharacter,
  onAddCharacter,
  onRemoveCharacter,
  onAddScene,
  onDeleteScene,
  onDragStart,
  onDropScene,
  onImportJson,
  onExportJson,
  onExportHtml
}: {
  open: boolean;
  scenes: VisualNovelScene[];
  assets: AssetLibrary;
  current: number;
  dragIndex: number | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onSelect: (index: number) => void;
  onUpdateScene: (index: number, patch: Partial<VisualNovelScene>) => void;
  onUpdateCharacter: (sceneIndex: number, characterIndex: number, patch: Partial<SceneCharacter>) => void;
  onAddCharacter: (sceneIndex: number) => void;
  onRemoveCharacter: (sceneIndex: number, characterIndex: number) => void;
  onAddScene: () => void;
  onDeleteScene: (index: number) => void;
  onDragStart: (index: number) => void;
  onDropScene: (index: number) => void;
  onImportJson: (file?: File) => void;
  onExportJson: () => void;
  onExportHtml: () => void;
}) {
  return (
    <Card className="p-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between rounded-[28px] px-5 py-5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50">
            <Layers className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-950">Scene Editor</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">장면 순서, 배경, BGM, 캐릭터 배치를 편집합니다.</p>
          </div>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t border-slate-100 p-5">
          <div className="mb-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" icon={Plus} onClick={onAddScene}>Scene 추가</Button>
            <Button variant="secondary" size="sm" icon={Upload} onClick={() => fileInputRef.current?.click()}>JSON Import</Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={onExportJson}>JSON Export</Button>
            <Button variant="primary" size="sm" icon={Download} onClick={onExportHtml}>HTML Export</Button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => onImportJson(event.target.files?.[0])} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scenes.map((scene, index) => {
              const fallbackBg = BACKGROUND_ASSETS.find((asset) => asset.id === (scene.backgroundAsset ?? scene.background)) ?? BACKGROUND_ASSETS[0];
              const uploadedBg = scene.backgroundAssetId ? assets.backgroundAssets.find((asset) => asset.id === scene.backgroundAssetId) : undefined;
              return (
                <article
                  key={scene.id}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDropScene(index)}
                  className={cn(
                    "overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 transition",
                    index === current ? "ring-4 ring-indigo-100" : "ring-slate-100 hover:ring-slate-200",
                    dragIndex === index && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    className={cn("relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br", uploadedBg ? "" : fallbackBg.gradient)}
                    style={uploadedBg ? { backgroundImage: `url(${uploadedBg.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                  >
                    {!uploadedBg ? <ImageIcon className="h-9 w-9 text-white/75" /> : null}
                    <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-xs font-black text-slate-600">{index + 1}</span>
                    <span className="absolute right-3 top-3 rounded-full bg-white/80 p-1.5 text-slate-500">
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-600">{uploadedBg?.name ?? fallbackBg.label}</span>
                  </button>

                  <div className="space-y-3 p-4">
                    <div className="grid gap-2">
                      <FieldLabel>Speaker</FieldLabel>
                      <input value={scene.speaker} onChange={(event) => onUpdateScene(index, { speaker: event.target.value })} className="rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100" />
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel>Text</FieldLabel>
                      <textarea value={scene.text} onChange={(event) => onUpdateScene(index, { text: event.target.value })} className="min-h-24 resize-y rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select value={scene.backgroundAssetId ?? ""} onChange={(event) => onUpdateScene(index, { backgroundAssetId: event.target.value || undefined })} className="min-h-10 rounded-xl border-0 bg-slate-50 px-3 text-sm font-semibold text-slate-600 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100">
                        <option value="">더미 배경</option>
                        {assets.backgroundAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                      <select value={scene.bgmAssetId ?? ""} onChange={(event) => onUpdateScene(index, { bgmAssetId: event.target.value || undefined })} className="min-h-10 rounded-xl border-0 bg-slate-50 px-3 text-sm font-semibold text-slate-600 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100">
                        <option value="">BGM 없음</option>
                        {assets.bgmAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Characters</span>
                        <Button variant="soft" size="sm" icon={Plus} onClick={() => onAddCharacter(index)} disabled={(scene.characters ?? []).length >= 3}>추가</Button>
                      </div>
                      <div className="space-y-2">
                        {(scene.characters ?? []).map((character, characterIndex) => (
                          <div key={`${character.position}-${characterIndex}`} className="grid gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-100">
                            <div className="grid grid-cols-[1fr_96px_88px_auto] gap-2">
                              <select
                                value={character.assetId}
                                onChange={(event) => {
                                  const asset = assets.standingAssets.find((item) => item.id === event.target.value);
                                  onUpdateCharacter(index, characterIndex, { assetId: event.target.value, name: asset?.name ?? character.name });
                                }}
                                className="min-h-9 min-w-0 rounded-lg border-0 bg-slate-50 px-2 text-xs font-semibold text-slate-600 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100"
                              >
                                <option value="">미등록</option>
                                {assets.standingAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                              </select>
                              <select value={character.position} onChange={(event) => onUpdateCharacter(index, characterIndex, { position: event.target.value as SceneCharacter["position"] })} className="min-h-9 rounded-lg border-0 bg-slate-50 px-2 text-xs font-semibold text-slate-600 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100">
                                <option value="left">left</option>
                                <option value="center">center</option>
                                <option value="right">right</option>
                              </select>
                              <label className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-slate-50 px-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                                <input type="checkbox" checked={character.isSpeaking} onChange={(event) => onUpdateCharacter(index, characterIndex, { isSpeaking: event.target.checked })} className="h-4 w-4 accent-indigo-600" />
                                말함
                              </label>
                              <Button variant="danger" size="icon" icon={Trash2} onClick={() => onRemoveCharacter(index, characterIndex)} aria-label="캐릭터 삭제" />
                            </div>
                            <input value={character.name} onChange={(event) => onUpdateCharacter(index, characterIndex, { name: event.target.value })} className="rounded-lg border-0 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between pt-1">
                      <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onSelect(index)}>선택</Button>
                      <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDeleteScene(index)}>삭제</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function JsonEditor({
  open,
  jsonText,
  error,
  onChange
}: {
  open: boolean;
  jsonText: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  if (!open) return null;
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
          <FileJson className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-950">Scene JSON</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">고급 편집 모드에서 실제 Scene 데이터를 직접 수정합니다.</p>
        </div>
      </div>
      {error ? <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 ring-1 ring-rose-100">{error}</div> : null}
      <textarea
        value={jsonText}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="h-[420px] w-full resize-y rounded-[22px] border-0 bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-100 outline-none ring-1 ring-slate-800 focus:ring-4 focus:ring-indigo-100"
      />
    </Card>
  );
}

function ExportCard({
  scenes,
  assets,
  onExportJson,
  onExportHtml,
  onResetProgress
}: {
  scenes: VisualNovelScene[];
  assets: AssetLibrary;
  onExportJson: () => void;
  onExportHtml: () => void;
  onResetProgress: () => void;
}) {
  const assetCount = assets.standingAssets.length + assets.backgroundAssets.length + assets.bgmAssets.length;
  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
        <div className="overflow-hidden rounded-[26px] bg-gradient-to-br from-indigo-100 via-sky-100 to-rose-100 p-5">
          <div className="flex h-40 items-center justify-center rounded-[22px] bg-white/55 shadow-inner">
            <Download className="h-10 w-10 text-indigo-500" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-950">Export</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">현재 장면과 등록 에셋을 단일 HTML 또는 JSON으로 저장합니다.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-2xl font-black text-slate-950">{scenes.length}</p>
              <p className="text-xs font-bold text-slate-400">Scenes</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-2xl font-black text-slate-950">{assetCount}</p>
              <p className="text-xs font-bold text-slate-400">Assets</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-2xl font-black text-slate-950">HTML</p>
              <p className="text-xs font-bold text-slate-400">Standalone</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" icon={FileJson} onClick={onExportJson}>JSON Export</Button>
            <Button variant="primary" icon={Download} onClick={onExportHtml}>HTML 내보내기</Button>
            <Button variant="ghost" icon={RotateCcw} onClick={onResetProgress}>이어보기 초기화</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Page() {
  const [log, setLog] = useState(SAMPLE_LOG);
  const [scenes, setScenes] = useState<VisualNovelScene[]>(fallbackScenes);
  const [jsonText, setJsonText] = useState(stringifyScenes(fallbackScenes));
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [sceneEditorOpen, setSceneEditorOpen] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [assets, setAssets] = useState<AssetLibrary>(EMPTY_ASSETS);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeScene = scenes[current] ?? fallbackScenes[0];
  const messageCount = useMemo(() => parseChatLog(log).length, [log]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      const savedAssets = localStorage.getItem(ASSET_KEY);
      if (savedAssets) setAssets(sanitizeAssets(JSON.parse(savedAssets)));
      if (saved) {
        const parsed = JSON.parse(saved) as { log?: string; scenes?: unknown; current?: number; jsonOpen?: boolean; sceneEditorOpen?: boolean };
        if (typeof parsed.log === "string") setLog(parsed.log);
        if (isSceneArray(parsed.scenes)) {
          const normalized = normalizeScenes(parsed.scenes);
          setScenes(normalized);
          setJsonText(stringifyScenes(normalized));
        }
        if (typeof parsed.current === "number") setCurrent(Math.max(0, parsed.current));
        if (typeof parsed.jsonOpen === "boolean") setJsonOpen(parsed.jsonOpen);
        if (typeof parsed.sceneEditorOpen === "boolean") setSceneEditorOpen(parsed.sceneEditorOpen);
      }
    } catch {
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(ASSET_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ log, scenes, current, jsonOpen, sceneEditorOpen }));
  }, [log, scenes, current, jsonOpen, sceneEditorOpen]);

  useEffect(() => {
    localStorage.setItem(ASSET_KEY, JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    const pruned = pruneSceneAssetRefs(scenes, assets);
    if (JSON.stringify(pruned) !== JSON.stringify(scenes)) {
      setScenes(pruned);
      setJsonText(stringifyScenes(pruned));
    }
    // Asset changes are the trigger; using the current scenes snapshot avoids a cleanup loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setCurrent((value) => {
        if (value >= scenes.length - 1) {
          setAutoPlay(false);
          return value;
        }
        return value + 1;
      });
    }, AUTO_PLAY_MS);
    return () => window.clearInterval(timer);
  }, [autoPlay, scenes.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrent((value) => Math.max(0, value - 1));
      }
      if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setCurrent((value) => Math.min(scenes.length - 1, value + 1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scenes.length]);

  useEffect(() => {
    const asset = activeScene.bgmAssetId ? assets.bgmAssets.find((item) => item.id === activeScene.bgmAssetId) : undefined;
    if (!audioRef.current) return;
    audioRef.current.pause();
    if (!asset) {
      audioRef.current.removeAttribute("src");
      setBgmEnabled(false);
      return;
    }
    if (!asset.dataUrl) return;
    audioRef.current.src = asset.dataUrl;
    if (bgmEnabled) audioRef.current.play().catch(() => setBgmEnabled(false));
  }, [activeScene.bgmAssetId, assets.bgmAssets, bgmEnabled]);

  function setScenesAndJson(next: VisualNovelScene[]) {
    const normalized = normalizeScenes(next);
    setScenes(normalized);
    setJsonText(stringifyScenes(normalized));
    setCurrent((value) => Math.min(value, Math.max(normalized.length - 1, 0)));
  }

  function loadSample() {
    setLog(SAMPLE_LOG);
    const next = messagesToScenes(parseChatLog(SAMPLE_LOG));
    setScenesAndJson(next);
    setCurrent(0);
    setError(null);
  }

  function convertLog() {
    if (!log.trim()) {
      setError("붙여넣은 로그가 없습니다. 샘플 로그를 불러오거나 대화를 입력해 주세요.");
      return;
    }
    if (log.length > 120_000) {
      setError("로그가 너무 깁니다. 우선 12만 자 이하로 나누어 변환해 주세요.");
      return;
    }
    const parsed = parseChatLog(log);
    if (parsed.length === 0) {
      setError("대화를 찾지 못했습니다. User:, Assistant:, AI: 같은 speaker 라벨을 확인해 주세요.");
      return;
    }
    const next = messagesToScenes(parsed);
    setScenesAndJson(next);
    setCurrent(0);
    setError(null);
  }

  function applyJsonText(value: string) {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      if (!isSceneArray(parsed)) {
        setJsonError("Scene JSON은 speaker와 text를 가진 배열이어야 합니다.");
        return;
      }
      setScenes(normalizeScenes(parsed));
      setJsonError(null);
    } catch {
      setJsonError("JSON 형식이 올바르지 않습니다. 쉼표와 따옴표를 확인해 주세요.");
    }
  }

  function updateScene(index: number, patch: Partial<VisualNovelScene>) {
    setScenesAndJson(scenes.map((scene, sceneIndex) => (sceneIndex === index ? { ...scene, ...patch } : scene)));
  }

  function updateSceneCharacter(sceneIndex: number, characterIndex: number, patch: Partial<SceneCharacter>) {
    setScenesAndJson(
      scenes.map((scene, index) => {
        if (index !== sceneIndex) return scene;
        return {
          ...scene,
          characters: scene.characters.map((character, innerIndex) => (innerIndex === characterIndex ? { ...character, ...patch } : character))
        };
      })
    );
  }

  function addCharacter(sceneIndex: number) {
    const positions: SceneCharacter["position"][] = ["left", "center", "right"];
    setScenesAndJson(
      scenes.map((scene, index) => {
        if (index !== sceneIndex || scene.characters.length >= 3) return scene;
        const used = new Set(scene.characters.map((character) => character.position));
        const position = positions.find((item) => !used.has(item)) ?? "center";
        return {
          ...scene,
          characters: [...scene.characters, { assetId: "", name: "Character", position, isSpeaking: scene.characters.length === 0 }]
        };
      })
    );
  }

  function removeCharacter(sceneIndex: number, characterIndex: number) {
    setScenesAndJson(
      scenes.map((scene, index) => {
        if (index !== sceneIndex) return scene;
        return { ...scene, characters: scene.characters.filter((_, innerIndex) => innerIndex !== characterIndex) };
      })
    );
  }

  function addScene() {
    const nextScene: VisualNovelScene = {
      ...fallbackScenes[0],
      id: uid("scene"),
      sceneNo: scenes.length + 1,
      speaker: "Narration",
      text: "새 장면을 입력하세요.",
      characters: []
    };
    setScenesAndJson([...scenes, nextScene]);
    setCurrent(scenes.length);
  }

  function deleteScene(index: number) {
    if (scenes.length <= 1) {
      setError("최소 한 개의 Scene은 필요합니다.");
      return;
    }
    const next = scenes.filter((_, sceneIndex) => sceneIndex !== index);
    setScenesAndJson(next);
    setCurrent((value) => Math.min(value, next.length - 1));
  }

  function onDropScene(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...scenes];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setScenesAndJson(next);
    setDragIndex(null);
  }

  function importJsonFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyJsonText(String(reader.result));
    reader.onerror = () => setJsonError("JSON 파일을 읽을 수 없습니다.");
    reader.readAsText(file);
  }

  function exportJson() {
    const blob = new Blob([stringifyScenes(scenes)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "visual-novel-scenes.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function toggleBgm() {
    const asset = activeScene.bgmAssetId ? assets.bgmAssets.find((item) => item.id === activeScene.bgmAssetId) : undefined;
    if (!asset || !audioRef.current) return;
    if (bgmEnabled) {
      audioRef.current.pause();
      setBgmEnabled(false);
      return;
    }
      if (!asset.dataUrl) return;
      audioRef.current.src = asset.dataUrl;
    audioRef.current.play().then(() => setBgmEnabled(true)).catch(() => setError("브라우저 정책상 BGM 버튼을 한 번 더 눌러 재생해 주세요."));
  }

  function resetProgress() {
    localStorage.removeItem(STATE_KEY);
    setCurrent(0);
    setAutoPlay(false);
    setError("이어보기 위치를 초기화했습니다. 등록 에셋은 유지됩니다.");
  }

  return (
    <main className="als-root min-h-screen bg-slate-50">
      <FontStyles />
      <audio ref={audioRef} loop />
      <Toolbar
        onSample={loadSample}
        onConvert={convertLog}
        onExport={() => downloadStandaloneHtml(scenes, assets)}
        onToggleJson={() => setJsonOpen((value) => !value)}
        jsonOpen={jsonOpen}
        canExport={scenes.length > 0}
      />
      <Hero
        activeScene={activeScene}
        assets={assets}
        onConvert={convertLog}
        onSample={loadSample}
        onExport={() => downloadStandaloneHtml(scenes, assets)}
        onNext={() => setCurrent((value) => Math.min(scenes.length - 1, value + 1))}
        bgmEnabled={bgmEnabled}
        onToggleBgm={toggleBgm}
      />

      <section id="workspace" className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <div className="grid items-stretch gap-6 lg:grid-cols-[45%_55%]">
          <LogInputCard log={log} onLogChange={setLog} onConvert={convertLog} error={error} messageCount={messageCount} sceneCount={scenes.length} />
          <PreviewCard
            scene={activeScene}
            scenesLength={scenes.length}
            current={current}
            assets={assets}
            autoPlay={autoPlay}
            bgmEnabled={bgmEnabled}
            onPrev={() => setCurrent((value) => Math.max(0, value - 1))}
            onNext={() => setCurrent((value) => Math.min(scenes.length - 1, value + 1))}
            onToggleAuto={() => setAutoPlay((value) => !value)}
            onToggleBgm={toggleBgm}
          />
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6 lg:px-8">
          <AssetManager assets={assets} onAssetsChange={setAssets} onError={setError} />
          <SceneEditor
            open={sceneEditorOpen}
            scenes={scenes}
            assets={assets}
            current={current}
            dragIndex={dragIndex}
            fileInputRef={fileInputRef}
            onToggle={() => setSceneEditorOpen((value) => !value)}
            onSelect={setCurrent}
            onUpdateScene={updateScene}
            onUpdateCharacter={updateSceneCharacter}
            onAddCharacter={addCharacter}
            onRemoveCharacter={removeCharacter}
            onAddScene={addScene}
            onDeleteScene={deleteScene}
            onDragStart={setDragIndex}
            onDropScene={onDropScene}
            onImportJson={importJsonFile}
            onExportJson={exportJson}
            onExportHtml={() => downloadStandaloneHtml(scenes, assets)}
          />
          <JsonEditor open={jsonOpen} jsonText={jsonText} error={jsonError} onChange={applyJsonText} />
          <ExportCard
            scenes={scenes}
            assets={assets}
            onExportJson={exportJson}
            onExportHtml={() => downloadStandaloneHtml(scenes, assets)}
            onResetProgress={resetProgress}
          />
      </div>
    </main>
  );
}
