"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Clock,
  Download,
  Edit3,
  Eye,
  FileJson,
  FileText,
  GitBranch,
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
import { DEFAULT_PLAYER_FONT_ID, PLAYER_FONT_OPTIONS, getPlayerFontOption } from "@/lib/playerFonts";
import type { VisualNovelScene } from "@/lib/parser/types";
import type { AssetLibrary, BgmAsset, SceneCharacter, VnEffect } from "@/lib/types";

const STATE_KEY = "ai-log-studio-state-v2";
const ASSET_KEY = "ai-log-studio-assets";
const ASSET_DB_NAME = "ai-log-studio-assets-db";
const ASSET_DB_STORE = "asset-library";
const ASSET_DB_ITEM_KEY = "assets";
const AUTO_PLAY_MS = 3200;
const TYPING_SPEEDS = {
  normal: 50,
  instant: 0
} as const;
type TypingSpeedMode = keyof typeof TYPING_SPEEDS;
type SelectionKind = "scene" | "multi-scene" | "text-block";
type EditToolId = "choices" | "enhance" | "search-ai" | "batch-edit";
type AiToolId = "choices" | "enhance" | "search-ai";
type SelectionState = {
  kind: SelectionKind;
  sceneIndexes: number[];
  text?: string;
};
type ToolCandidate = {
  id: string;
  toolId: EditToolId;
  title: string;
  summary: string;
  selection: SelectionState;
  originalScenes: VisualNovelScene[];
  candidateScenes: VisualNovelScene[];
  applyScenes?: VisualNovelScene[];
  choiceScene?: VisualNovelScene;
  branchScenes?: VisualNovelScene[];
  effectSuggestions?: Array<{ sceneIndex: number; sceneId: string; effects: VnEffect[] }>;
  selectedEffectIds?: string[];
};
const IMAGE_LIMIT = 5 * 1024 * 1024;
const BGM_LIMIT = 15 * 1024 * 1024;
const TEXT_PAGE_LIMIT = 145;

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

const TOTAL_SCENES = 24;

const FALLBACK_BACKGROUNDS: Record<string, { location: string; gradient: string; icon: string }> = {
  observatory: { location: "전망대", gradient: "from-slate-700 via-indigo-900 to-purple-950", icon: "OBS" },
  alley: { location: "골목", gradient: "from-indigo-950 via-purple-950 to-slate-900", icon: "ALY" },
  cafe: { location: "카페", gradient: "from-orange-800 via-amber-900 to-stone-900", icon: "CAF" },
  classroom: { location: "교실", gradient: "from-sky-800 via-blue-900 to-slate-900", icon: "CLS" },
  archive: { location: "문서고", gradient: "from-emerald-800 via-teal-900 to-slate-900", icon: "ARC" },
  cloud: { location: "클라우드", gradient: "from-cyan-800 via-sky-900 to-indigo-950", icon: "CLD" }
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stringifyScenes(scenes: VisualNovelScene[]) {
  return JSON.stringify(scenes, null, 2);
}

function isSceneArray(value: unknown): value is VisualNovelScene[] {
  if (!Array.isArray(value)) return false;
  return value.every((scene) => {
    if (!scene || typeof scene !== "object") return false;
    const candidate = scene as Record<string, unknown>;
    return typeof candidate.text === "string";
  });
}

function normalizeScenes(scenes: VisualNovelScene[]) {
  return scenes.map((scene, index) => ({
    ...scene,
    id: scene.id ?? uid("scene"),
    displayMode: scene.displayMode ?? (scene.type === "code" ? "code" : scene.role === "narration" ? "narration" : scene.role === "system" ? "system" : "dialogue"),
    sceneNo: index + 1,
    background: scene.background ?? BACKGROUND_ASSETS[index % BACKGROUND_ASSETS.length].id,
    backgroundAsset: scene.backgroundAsset ?? scene.background ?? BACKGROUND_ASSETS[index % BACKGROUND_ASSETS.length].id,
    emotion: scene.emotion ?? "neutral",
    emotionIcon: scene.emotionIcon ?? EMOTION_ASSETS.find((asset) => asset.id === scene.emotion)?.icon ?? "•",
    characters: Array.isArray(scene.characters) ? scene.characters : []
  }));
}

function sceneMergeKey(scene: VisualNovelScene) {
  return `${scene.speaker ?? ""}::${scene.text.trim().slice(0, 160)}`;
}

function mergeSceneAssetLinks(nextScenes: VisualNovelScene[], previousScenes: VisualNovelScene[]) {
  const previousByKey = new Map(previousScenes.map((scene) => [sceneMergeKey(scene), scene]));
  return nextScenes.map((scene, index) => {
    const previous = previousByKey.get(sceneMergeKey(scene)) ?? previousScenes[index];
    if (!previous) return scene;
    return {
      ...scene,
      backgroundAssetId: previous.backgroundAssetId ?? scene.backgroundAssetId,
      bgmAssetId: previous.bgmAssetId ?? scene.bgmAssetId,
      characters: previous.characters?.length ? previous.characters : scene.characters
    };
  });
}

function selectionLabel(selection: SelectionState) {
  if (selection.kind === "text-block") return "텍스트 블록";
  if (selection.sceneIndexes.length <= 1) return "단일 Scene";
  return `${selection.sceneIndexes.length}개 Scene`;
}

function sceneExcerpt(scene: VisualNovelScene, limit = 90) {
  const compact = scene.text.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}...` : compact;
}

function splitTextPages(text: string, limit = TEXT_PAGE_LIMIT) {
  const source = text.trim();
  if (!source) return [""];
  const chars = Array.from(source);
  const pages: string[] = [];
  let start = 0;
  while (start < chars.length) {
    if (chars.length - start <= limit) {
      pages.push(chars.slice(start).join("").trim());
      break;
    }
    const end = Math.min(chars.length, start + limit);
    const windowChars = chars.slice(start, end);
    let cut = -1;
    for (let index = windowChars.length - 1; index >= Math.max(0, windowChars.length - 48); index -= 1) {
      if (/[.!?。！？…\n]/.test(windowChars[index])) {
        cut = index + 1;
        break;
      }
    }
    if (cut < Math.floor(limit * 0.55)) {
      for (let index = windowChars.length - 1; index >= Math.max(0, windowChars.length - 32); index -= 1) {
        if (/\s/.test(windowChars[index])) {
          cut = index + 1;
          break;
        }
      }
    }
    if (cut <= 0) cut = windowChars.length;
    pages.push(chars.slice(start, start + cut).join("").trim());
    start += cut;
    while (chars[start] && /\s/.test(chars[start])) start += 1;
  }
  return pages.filter(Boolean).length ? pages.filter(Boolean) : [source];
}

function buildSelection(sceneIndexes: number[], scenes: VisualNovelScene[]): SelectionState {
  const unique = Array.from(new Set(sceneIndexes)).filter((index) => index >= 0 && index < scenes.length).sort((a, b) => a - b);
  const safeIndexes = unique.length ? unique : [0].filter((index) => scenes[index]);
  return {
    kind: safeIndexes.length > 1 ? "multi-scene" : "scene",
    sceneIndexes: safeIndexes
  };
}

function replaceSelectedScenes(scenes: VisualNovelScene[], candidate: ToolCandidate) {
  if (candidate.applyScenes) return candidate.applyScenes;
  if (candidate.toolId === "enhance" && candidate.effectSuggestions) {
    const selectedIds = new Set(candidate.selectedEffectIds ?? candidate.effectSuggestions.flatMap((item) => item.effects.map((effect) => effect.id)));
    const effectsByScene = new Map<string, VnEffect[]>();
    candidate.effectSuggestions.forEach((suggestion) => {
      const selectedEffects = suggestion.effects.filter((effect) => selectedIds.has(effect.id));
      if (selectedEffects.length) effectsByScene.set(suggestion.sceneId, selectedEffects);
    });
    return scenes.map((scene) => {
      const selectedEffects = effectsByScene.get(scene.id);
      if (!selectedEffects?.length) return scene;
      return { ...scene, effects: [...(scene.effects ?? []), ...selectedEffects] };
    });
  }
  const next = [...scenes];
  candidate.selection.sceneIndexes.forEach((sceneIndex, index) => {
    const candidateScene = candidate.candidateScenes[index];
    if (candidateScene) next[sceneIndex] = candidateScene;
  });
  return next;
}

function createChoiceCandidate(scenes: VisualNovelScene[], selection: SelectionState): ToolCandidate {
  const originalScenes = selection.sceneIndexes.map((index) => scenes[index]).filter(Boolean);
  const insertAfter = selection.sceneIndexes[selection.sceneIndexes.length - 1] ?? 0;
  const sourceScene = scenes[insertAfter] ?? scenes[0];
  const choiceId = uid("choice");
  const branchOneId = uid("branch");
  const branchTwoId = uid("branch");
  const sharedSceneFields = {
    background: sourceScene?.background ?? "observatory",
    backgroundAsset: sourceScene?.backgroundAsset ?? sourceScene?.background ?? "observatory",
    backgroundAssetId: sourceScene?.backgroundAssetId,
    bgmAssetId: sourceScene?.bgmAssetId,
    emotion: "neutral",
    emotionIcon: sourceScene?.emotionIcon,
    characters: sourceScene?.characters ?? []
  };
  const choiceScene: VisualNovelScene = {
    ...sharedSceneFields,
    id: choiceId,
    sceneNo: insertAfter + 2,
    role: "system",
    displayMode: "choice",
    speaker: undefined,
    text: "어떻게 답할까?",
    choices: [
      { id: uid("option"), text: "더 솔직하게 답한다.", targetSceneId: branchOneId },
      { id: uid("option"), text: "잠시 침묵하며 상대를 살핀다.", targetSceneId: branchTwoId }
    ]
  };
  const branchOneScene: VisualNovelScene = {
    ...sharedSceneFields,
    id: branchOneId,
    sceneNo: insertAfter + 3,
    role: "narration",
    displayMode: "narration",
    speaker: undefined,
    text: "솔직한 대답이 공기 위로 조심스럽게 놓인다.",
    choices: undefined
  };
  const branchTwoScene: VisualNovelScene = {
    ...sharedSceneFields,
    id: branchTwoId,
    sceneNo: insertAfter + 4,
    role: "narration",
    displayMode: "narration",
    speaker: undefined,
    text: "잠깐의 침묵 사이로 상대의 표정이 천천히 읽힌다.",
    choices: undefined
  };
  const applyScenes = [
    ...scenes.slice(0, insertAfter + 1),
    choiceScene,
    branchOneScene,
    branchTwoScene,
    ...scenes.slice(insertAfter + 1)
  ];
  return {
    id: uid("candidate"),
    toolId: "choices",
    title: "선택지 생성",
    summary: "선택 영역 뒤에 클릭 가능한 Choice 노드와 branch Scene 2개를 생성합니다.",
    selection,
    originalScenes,
    candidateScenes: [choiceScene, branchOneScene, branchTwoScene],
    applyScenes,
    choiceScene,
    branchScenes: [branchOneScene, branchTwoScene]
  };
}

function createEnhanceCandidate(scenes: VisualNovelScene[], selection: SelectionState): ToolCandidate {
  const originalScenes = selection.sceneIndexes.map((index) => scenes[index]).filter(Boolean);
  const candidateScenes = originalScenes.map((scene) => ({
    ...scene,
    text: scene.displayMode === "dialogue"
      ? `${scene.text.trim()}\n\n(잠깐의 정적. 시선이 흔들리고, 배경음이 한 박자 낮아진다.)`
      : `${scene.text.trim()}\n\n화면의 공기가 한층 느려지고, 장면의 여운이 잠시 머문다.`
  }));
  return {
    id: uid("candidate"),
    toolId: "enhance",
    title: "선택 영역 연출 강화",
    summary: "선택 영역 안에 VN 연출용 행동/분위기 문장을 초안으로 덧붙입니다.",
    selection,
    originalScenes,
    candidateScenes
  };
}

function createEnhanceEffectCandidate(scenes: VisualNovelScene[], selection: SelectionState): ToolCandidate {
  const originalScenes = selection.sceneIndexes.map((index) => scenes[index]).filter(Boolean);
  const effectSuggestions = selection.sceneIndexes.map((sceneIndex, suggestionIndex) => {
    const scene = scenes[sceneIndex];
    const effects: VnEffect[] = [
      { id: uid("effect"), type: "pause", durationMs: 600, position: "beforeText" },
      { id: uid("effect"), type: "textSpeed", value: "slow" },
      { id: uid("effect"), type: "pause", durationMs: 800, position: "afterText" }
    ];
    if (suggestionIndex % 2 === 1) effects.push({ id: uid("effect"), type: "screenShake", intensity: "soft" });
    if ((scene?.text ?? "").length > TEXT_PAGE_LIMIT) effects.push({ id: uid("effect"), type: "splitTextPage" });
    if (suggestionIndex % 3 === 2) effects.push({ id: uid("effect"), type: "flash", durationMs: 220 });
    return { sceneIndex, sceneId: scene.id, effects };
  });
  return {
    id: uid("candidate"),
    toolId: "enhance",
    title: "연출 강화",
    summary: "원문 텍스트는 유지하고 선택한 VN effect/event만 추가합니다.",
    selection,
    originalScenes,
    candidateScenes: originalScenes,
    effectSuggestions,
    selectedEffectIds: effectSuggestions.flatMap((item) => item.effects.map((effect) => effect.id))
  };
}

function createSearchAiCandidate(scenes: VisualNovelScene[], selection: SelectionState, query: string, replacement: string): ToolCandidate {
  const originalScenes = selection.sceneIndexes.map((index) => scenes[index]).filter(Boolean);
  const safeQuery = query.trim();
  const safeReplacement = replacement.trim();
  const candidateScenes = originalScenes.map((scene) => ({
    ...scene,
    text: safeQuery
      ? scene.text.split(safeQuery).join(safeReplacement || safeQuery)
      : `${scene.text.trim()}\n\n[AI 수정 메모] 이 선택 영역을 더 자연스러운 VN 문장으로 다듬어 주세요.`
  }));
  return {
    id: uid("candidate"),
    toolId: "search-ai",
    title: "검색 + AI 수정",
    summary: safeQuery ? `"${safeQuery}"를 선택 영역 안에서만 찾아 수정한 초안입니다.` : "선택 영역만 대상으로 수정 메모를 추가한 초안입니다.",
    selection,
    originalScenes,
    candidateScenes
  };
}

function createBatchEditCandidate(scenes: VisualNovelScene[], selection: SelectionState, patch: Partial<VisualNovelScene>): ToolCandidate {
  const originalScenes = selection.sceneIndexes.map((index) => scenes[index]).filter(Boolean);
  const candidateScenes = originalScenes.map((scene) => ({ ...scene, ...patch }));
  return {
    id: uid("candidate"),
    toolId: "batch-edit",
    title: "Batch Edit",
    summary: "선택 영역의 공통 속성을 한 번에 수정하는 일반 편집 초안입니다.",
    selection,
    originalScenes,
    candidateScenes
  };
}

function effectLabel(effect: VnEffect) {
  if (effect.type === "pause") return `pause ${effect.durationMs}ms ${effect.position === "beforeText" ? "before text" : "after text"}`;
  if (effect.type === "textSpeed") return `textSpeed ${effect.value}`;
  if (effect.type === "screenShake") return `screenShake ${effect.intensity}`;
  if (effect.type === "fadeIn") return `fadeIn ${effect.durationMs}ms`;
  if (effect.type === "fadeOut") return `fadeOut ${effect.durationMs}ms`;
  if (effect.type === "flash") return `flash ${effect.durationMs}ms`;
  if (effect.type === "splitTextPage") return "splitTextPage";
  if (effect.type === "emphasis") return `emphasis ${effect.value}`;
  if (effect.type === "soundEffect") return `soundEffect ${effect.placeholder}`;
  return effect.type;
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

function openAssetDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB를 사용할 수 없습니다."));
      return;
    }
    const request = indexedDB.open(ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_DB_STORE)) db.createObjectStore(ASSET_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("에셋 저장소를 열 수 없습니다."));
  });
}

function readAssetStore() {
  return new Promise<AssetLibrary | null>((resolve, reject) => {
    openAssetDb()
      .then((db) => {
        const transaction = db.transaction(ASSET_DB_STORE, "readonly");
        const request = transaction.objectStore(ASSET_DB_STORE).get(ASSET_DB_ITEM_KEY);
        request.onsuccess = () => {
          db.close();
          resolve(request.result ? sanitizeAssets(request.result) : null);
        };
        request.onerror = () => {
          db.close();
          reject(request.error ?? new Error("에셋을 불러올 수 없습니다."));
        };
      })
      .catch(reject);
  });
}

function writeAssetStore(assets: AssetLibrary) {
  return new Promise<void>((resolve, reject) => {
    openAssetDb()
      .then((db) => {
        const transaction = db.transaction(ASSET_DB_STORE, "readwrite");
        const request = transaction.objectStore(ASSET_DB_STORE).put(assets, ASSET_DB_ITEM_KEY);
        request.onsuccess = () => {
          db.close();
          resolve();
        };
        request.onerror = () => {
          db.close();
          reject(request.error ?? new Error("에셋을 저장할 수 없습니다."));
        };
      })
      .catch(reject);
  });
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

function sceneBackground(scene: VisualNovelScene) {
  return FALLBACK_BACKGROUNDS[scene.backgroundAsset ?? scene.background ?? "observatory"] ?? FALLBACK_BACKGROUNDS.observatory;
}

function normalizeCharacterName(value?: string) {
  return (value ?? "")
    .trim()
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
}

function orderedCharacters(scene: VisualNovelScene) {
  const rank: Record<SceneCharacter["position"], number> = { left: 0, center: 1, right: 2 };
  const characters = [...(scene.characters ?? [])];
  const speakerName = scene.speaker?.trim();
  const shouldAutoPlaceSpeaker = sceneDisplayMode(scene) === "dialogue" && speakerName && characters.length === 0;
  if (shouldAutoPlaceSpeaker) {
    characters.push({
      assetId: "",
      name: speakerName,
      position: "center",
      isSpeaking: true
    });
  }
  return characters.sort((a, b) => rank[a.position] - rank[b.position]);
}

function characterLeftPercent(position: SceneCharacter["position"]) {
  if (position === "left") return 25;
  if (position === "right") return 75;
  return 50;
}

function characterWidthPercent(total: number) {
  if (total <= 1) return "46%";
  if (total === 2) return "36%";
  return "28%";
}

function standingAssetForCharacter(character: SceneCharacter, scene: VisualNovelScene, assets: AssetLibrary) {
  const explicitAsset = character.assetId ? assets.standingAssets.find((asset) => asset.id === character.assetId) : undefined;
  if (explicitAsset) return explicitAsset;
  const characterName = normalizeCharacterName(character.name);
  const speakerName = normalizeCharacterName(scene.speaker);
  return assets.standingAssets.find((asset) => {
    const assetName = normalizeCharacterName(asset.name);
    return assetName === characterName || assetName === speakerName;
  });
}

const FontStyles = () => (
  <style>{`
    .als-root { font-family:'Pretendard Variable',Pretendard,'Noto Sans KR',ui-sans-serif,system-ui,sans-serif; }
    .als-scrollbar::-webkit-scrollbar { width:6px; height:6px; }
    .als-scrollbar::-webkit-scrollbar-thumb { background:#E2E8F0; border-radius:999px; }
    .als-scrollbar::-webkit-scrollbar-track { background:transparent; }
    .als-tail { position:absolute; left:28px; bottom:-7px; width:14px; height:14px; background:inherit; transform:rotate(45deg); border-radius:3px; }
    .als-vignette { background:radial-gradient(120% 90% at 50% 110%, rgba(0,0,0,0.55), transparent 60%); }
    @keyframes vnbounce { 0%,100% { opacity:.35; transform:translateY(0); } 50% { opacity:.9; transform:translateY(3px); } }
    @keyframes vnshake { 0%,100% { transform:translate(0,0); } 20% { transform:translate(-6px,3px); } 40% { transform:translate(5px,-2px); } 60% { transform:translate(-3px,-3px); } 80% { transform:translate(4px,2px); } }
    @keyframes vnflash { 0% { opacity:0; } 14% { opacity:.86; } 100% { opacity:0; } }
    @keyframes vnfadein { from { opacity:.55; } to { opacity:0; } }
    @keyframes vnfadeout { from { opacity:0; } to { opacity:.55; } }
  `}</style>
);

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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

function Pill({ role }: { role?: string }) {
  const label = (role ?? "AI").toUpperCase();
  const isUser = label === "USER";
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${isUser ? "bg-purple-600" : "bg-indigo-600"}`}>
      {label}
    </span>
  );
}

function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "right",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ElementType;
  iconPosition?: "left" | "right";
}) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98]",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]",
    ghost: "text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-[0.98]",
    accent: "bg-purple-600 text-white shadow-sm shadow-purple-200 hover:bg-purple-700 active:scale-[0.98]",
    danger: "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 active:scale-[0.98]"
  };
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2.5", lg: "text-[15px] px-5 py-3" };
  return (
    <button type="button" className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {Icon && iconPosition === "left" && <Icon className="h-4 w-4" />}
      {children}
      {Icon && iconPosition === "right" && <Icon className="h-4 w-4" />}
    </button>
  );
}

function Card({ children, className = "", padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-10px_rgba(99,102,241,0.12)] ${padded ? "p-6" : ""} ${className}`}>
      {children}
    </div>
  );
}

function Avatar({ tone = "indigo", size = 9 }: { tone?: "indigo" | "purple" | "slate" | "rose"; size?: 6 | 8 | 9 }) {
  const tones = { indigo: "from-indigo-400 to-indigo-600", purple: "from-purple-400 to-purple-600", slate: "from-slate-300 to-slate-400", rose: "from-rose-400 to-rose-600" };
  const sizes = { 6: "h-6 w-6", 8: "h-8 w-8", 9: "h-9 w-9" };
  return (
    <div className={`${sizes[size]} shrink-0 rounded-full bg-gradient-to-br ${tones[tone]} flex items-center justify-center`}>
      <User className="h-4 w-4 text-white" />
    </div>
  );
}

function sceneDisplayMode(scene: VisualNovelScene) {
  if (scene.displayMode) return scene.displayMode;
  if (scene.type === "code") return "code";
  if (scene.role === "narration") return "narration";
  if (scene.role === "system") return "system";
  return "dialogue";
}

function sceneEffects(scene: VisualNovelScene) {
  return scene.effects ?? [];
}

function sceneTypingSpeed(scene: VisualNovelScene, fallback: number) {
  const speedEffect = sceneEffects(scene).find((effect): effect is Extract<VnEffect, { type: "textSpeed" }> => effect.type === "textSpeed");
  if (!speedEffect) return fallback;
  if (speedEffect.value === "slow") return 70;
  if (speedEffect.value === "fast") return 28;
  return fallback;
}

function scenePause(scene: VisualNovelScene, position: "beforeText" | "afterText") {
  return sceneEffects(scene)
    .filter((effect): effect is Extract<VnEffect, { type: "pause" }> => effect.type === "pause" && effect.position === position)
    .reduce((total, effect) => total + effect.durationMs, 0);
}

function TypingText({
  text,
  speed = TYPING_SPEEDS.normal,
  enabled = true,
  revealToken = 0,
  resetToken = 0,
  startDelay = 0,
  completeDelay = 0,
  className = "",
  style,
  as = "p",
  onComplete
}: {
  text: string;
  speed?: number;
  enabled?: boolean;
  revealToken?: number;
  resetToken?: number;
  startDelay?: number;
  completeDelay?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: "p" | "pre";
  onComplete?: () => void;
}) {
  const chars = useMemo(() => Array.from(text), [text]);
  const [visibleCount, setVisibleCount] = useState(enabled ? 0 : chars.length);
  const completedRef = useRef(false);
  const Element = as;

  useEffect(() => {
    completedRef.current = false;
    setVisibleCount(enabled ? 0 : chars.length);
  }, [chars.length, enabled, resetToken, text]);

  useEffect(() => {
    if (!enabled) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }
    if (visibleCount >= chars.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        if (completeDelay > 0) {
          const timer = window.setTimeout(() => onComplete?.(), completeDelay);
          return () => window.clearTimeout(timer);
        }
        onComplete?.();
      }
      return;
    }
    const previousChar = chars[Math.max(visibleCount - 1, 0)] ?? "";
    const delay = previousChar === "\n" ? 220 : /[.,?!。…]/.test(previousChar) ? 180 : /\s/.test(previousChar) ? 16 : speed;
    const timer = window.setTimeout(() => setVisibleCount((value) => Math.min(chars.length, value + 1)), delay + (visibleCount === 0 ? startDelay : 0));
    return () => window.clearTimeout(timer);
  }, [chars.length, completeDelay, enabled, onComplete, speed, startDelay, visibleCount]);

  useEffect(() => {
    if (revealToken > 0) setVisibleCount(chars.length);
  }, [chars.length, revealToken]);

  return <Element className={className} style={style}>{chars.slice(0, visibleCount).join("")}</Element>;
}

function DialoguePanel({
  scene,
  pageText,
  sceneIndex,
  totalScenes,
  typingEnabled,
  typingSpeed,
  typingComplete,
  revealToken,
  resetToken,
  fontFamily,
  onTypingComplete,
  variant = "hero",
  compact = false
}: {
  scene: VisualNovelScene;
  pageText?: string;
  sceneIndex: number;
  totalScenes: number;
  typingEnabled: boolean;
  typingSpeed: number;
  typingComplete: boolean;
  revealToken: number;
  resetToken?: number;
  fontFamily: string;
  onTypingComplete: () => void;
  variant?: "hero" | "inline";
  compact?: boolean;
}) {
  const displayMode = sceneDisplayMode(scene);
  const visibleText = pageText ?? scene.text;
  const effectiveTypingSpeed = sceneTypingSpeed(scene, typingSpeed);
  const beforeTextDelay = scenePause(scene, "beforeText");
  const afterTextDelay = scenePause(scene, "afterText");
  const isNarration = displayMode === "narration";
  const isCode = displayMode === "code" || scene.type === "code";
  const isInline = variant === "inline";
  if (displayMode === "choice") return null;
  return (
    <div className="pointer-events-none absolute bottom-8 left-1/2 h-[156px] w-[88%] max-w-[1320px] -translate-x-1/2 text-white">
      {!isNarration && !isCode ? (
        <div
          className={cn(
            "absolute -top-6 left-0 z-10 ml-[26px] inline-block rounded-tr-md bg-[#0f141c] px-[18px] py-[5px] text-[13px] font-medium tracking-[0.3px] text-[#f2eee2]",
            isInline ? "text-[11px]" : ""
          )}
        >
          {scene.speaker}
        </div>
      ) : null}
      <div
        className={cn(
          "relative flex h-[156px] w-full items-center border-t border-white/[0.06] bg-[rgba(10,13,18,0.84)] px-14 py-6 text-[#f4f0e6]",
          isNarration ? "text-center" : "text-left"
        )}
      >
        {isCode ? (
          <TypingText
            as="pre"
            text={visibleText}
            enabled={typingEnabled}
            speed={effectiveTypingSpeed}
            revealToken={revealToken}
            resetToken={resetToken}
            startDelay={beforeTextDelay}
            completeDelay={afterTextDelay}
            onComplete={onTypingComplete}
            style={{ fontFamily }}
            className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap rounded-lg bg-black/35 px-8 py-2 font-mono text-[14px] leading-[1.85] text-lime-100"
          />
        ) : (
          <TypingText
            text={visibleText}
            enabled={typingEnabled}
            speed={effectiveTypingSpeed}
            revealToken={revealToken}
            resetToken={resetToken}
            startDelay={beforeTextDelay}
            completeDelay={afterTextDelay}
            onComplete={onTypingComplete}
            style={{ fontFamily }}
            className={cn(
              "max-w-[1160px] min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-keep px-12 text-[17px] leading-[1.85] text-[#f4f0e6]",
              isNarration
                ? "italic text-center"
                : "text-left"
            )}
          />
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-[18px] w-[18px] shrink-0 text-[#f4f0e6] transition-opacity",
            typingComplete ? "animate-[vnbounce_1.6s_ease-in-out_infinite]" : "opacity-0"
          )}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function CharacterFigure({
  character,
  asset,
  leftPercent,
  style,
  variant = "hero"
}: {
  character: SceneCharacter;
  asset?: { dataUrl: string; name: string };
  leftPercent: number;
  style?: React.CSSProperties;
  variant?: "hero" | "inline";
}) {
  const tones = { indigo: "from-indigo-300/40 to-indigo-500/10", purple: "from-purple-300/40 to-purple-500/10", rose: "from-rose-300/40 to-rose-500/10" };
  const tone = character.position === "left" ? "purple" : character.position === "right" ? "rose" : "indigo";
  const characterWidth = variant === "inline" ? "var(--character-width, 36%)" : "var(--character-width, 36%)";
  return (
    <motion.div
      className="absolute bottom-0 origin-bottom"
      style={{
        ...style,
        left: `${leftPercent}%`,
        height: "80%",
        width: characterWidth,
        zIndex: character.isSpeaking ? 3 : 2
      }}
      animate={{
        x: "-50%",
        scale: character.isSpeaking ? 1.02 : 1,
        opacity: character.isSpeaking ? 1 : 0.7,
        filter: character.isSpeaking ? "brightness(1)" : "brightness(0.6) blur(1px)"
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {asset ? (
        <img src={asset.dataUrl} alt={asset.name} className="h-full w-full object-contain object-bottom" />
      ) : (
        <div className={`flex h-full aspect-[3/4] items-start justify-center rounded-t-full bg-gradient-to-b ${tones[tone]} pt-8`}>
          <User className={`h-12 w-12 ${character.isSpeaking ? "text-white/90" : "text-white/50"}`} />
        </div>
      )}
    </motion.div>
  );
}

function ChoiceOverlay({
  scene,
  onChoose,
  fontFamily
}: {
  scene: VisualNovelScene;
  onChoose: (targetSceneId?: string) => void;
  fontFamily: string;
}) {
  const options = scene.choices ?? [];
  if (sceneDisplayMode(scene) !== "choice" || options.length === 0) return null;
  return (
    <div className="absolute inset-x-0 bottom-[18%] z-40 flex justify-center px-10">
      <div className="w-[72%] max-w-[920px]" style={{ fontFamily }}>
        {scene.text ? <p className="mb-4 text-center text-[18px] font-semibold tracking-[0.04em] text-[#f4f0e6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">{scene.text}</p> : null}
        <div className="space-y-3 border-y border-white/20 bg-black/20 py-5 backdrop-blur-[2px]">
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChoose(option.targetSceneId);
              }}
              className="block w-full rounded-none bg-transparent px-8 py-3 text-left text-[18px] font-medium tracking-[0.02em] text-[#f4f0e6] shadow-none transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <span className="mr-4 text-white/55">{index + 1}.</span>
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VNStage({
  scene,
  scenes = [scene],
  assets,
  current,
  total,
  autoPlay,
  onNext,
  onJumpScene,
  onChoose,
  onToggleAuto,
  bgmEnabled,
  onToggleBgm,
  typingEnabled,
  typingSpeed,
  typingComplete,
  revealToken,
  resetToken,
  pageText,
  textPageIndex,
  textPageTotal,
  playerFontFamily,
  onTypingComplete
}: {
  scene: VisualNovelScene;
  scenes?: VisualNovelScene[];
  assets: AssetLibrary;
  current: number;
  total: number;
  autoPlay: boolean;
  onNext: () => void;
  onJumpScene: (index: number) => void;
  onChoose: (targetSceneId?: string) => void;
  onToggleAuto: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
  typingEnabled: boolean;
  typingSpeed: number;
  typingComplete: boolean;
  revealToken: number;
  resetToken?: number;
  pageText?: string;
  textPageIndex?: number;
  textPageTotal?: number;
  playerFontFamily: string;
  onTypingComplete: () => void;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const bg = sceneBackground(scene);
  const backgroundAsset = scene.backgroundAssetId ? assets.backgroundAssets.find((asset) => asset.id === scene.backgroundAssetId) : undefined;
  const displayMode = sceneDisplayMode(scene);
  const effects = sceneEffects(scene);
  const hasShake = effects.some((effect) => effect.type === "screenShake");
  const hasFlash = effects.some((effect) => effect.type === "flash");
  const hasFadeIn = effects.some((effect) => effect.type === "fadeIn");
  const hasFadeOut = effects.some((effect) => effect.type === "fadeOut");
  const visibleLogScenes = scenes.slice(0, current + 1);
  useEffect(() => {
    if (!logOpen) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setLogOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [logOpen]);
  useEffect(() => {
    if (!logOpen || !logScrollRef.current) return;
    logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logOpen, visibleLogScenes.length]);
  return (
    <div
      className={cn(
        "relative mx-auto aspect-video w-full max-w-[1440px] cursor-pointer overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-indigo-100/50",
        hasShake && "animate-[vnshake_.42s_ease-in-out_1]"
      )}
      role="button"
      tabIndex={0}
      aria-label="Advance dialogue"
      onClick={() => {
        if (!logOpen && displayMode !== "choice") onNext();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && logOpen) {
          event.preventDefault();
          setLogOpen(false);
          return;
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (!logOpen && displayMode !== "choice") onNext();
        }
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${scene.id}-${scene.backgroundAssetId ?? scene.background}`}
          initial={{ opacity: 0, scale: 1.04, x: 24 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.98, x: -24 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-0 bg-gradient-to-br ${backgroundAsset ? "" : bg.gradient}`}
          style={backgroundAsset ? { backgroundImage: `url(${backgroundAsset.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_25%_15%,white,transparent_35%),radial-gradient(circle_at_80%_65%,white,transparent_30%)]" />
          <div className="absolute inset-0 als-vignette" />

          {(displayMode === "dialogue" || displayMode === "choice") ? <div className="absolute inset-0 z-10 pointer-events-none">
            {orderedCharacters(scene).map((character, index, allCharacters) => (
              <CharacterFigure
                key={`${character.assetId}-${character.position}-${index}`}
                character={character}
                asset={standingAssetForCharacter(character, scene, assets)}
                leftPercent={characterLeftPercent(character.position)}
                variant="hero"
                style={{ "--character-width": characterWidthPercent(allCharacters.length) } as React.CSSProperties}
              />
            ))}
          </div> : null}
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-30">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${scene.id}-dialogue`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <DialoguePanel scene={scene} pageText={pageText} sceneIndex={current} totalScenes={total} typingEnabled={typingEnabled} typingSpeed={typingSpeed} typingComplete={typingComplete} revealToken={revealToken} resetToken={resetToken} fontFamily={playerFontFamily} onTypingComplete={onTypingComplete} variant="hero" compact />
          </motion.div>
        </AnimatePresence>
      </div>
      <ChoiceOverlay scene={scene} onChoose={onChoose} fontFamily={playerFontFamily} />
      {hasFlash ? <div key={`${scene.id}-flash`} className="pointer-events-none absolute inset-0 z-[65] bg-white animate-[vnflash_.24s_ease-out_1]" /> : null}
      {hasFadeIn ? <div key={`${scene.id}-fade-in`} className="pointer-events-none absolute inset-0 z-[64] bg-black animate-[vnfadein_.7s_ease-out_1] opacity-0" /> : null}
      {hasFadeOut ? <div key={`${scene.id}-fade-out`} className="pointer-events-none absolute inset-0 z-[64] bg-black animate-[vnfadeout_.7s_ease-out_1] opacity-0" /> : null}
      <div className="absolute right-4 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-2">
        {[
          ["Log", "☰"],
          ["Skip", "»"],
          ["Auto", "▶"],
          ["Menu", "≡"]
        ].map(([label, icon]) => (
          <button
            key={label}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (label === "Log") setLogOpen((value) => !value);
              if (label === "Auto") onToggleAuto();
            }}
            disabled={label === "Skip" || label === "Menu"}
            className={`flex flex-col items-center gap-0.5 bg-transparent p-0 text-[9px] font-semibold text-[#e8e4d8cc] shadow-none transition disabled:pointer-events-none disabled:opacity-55 ${(label === "Auto" && autoPlay) || (label === "Log" && logOpen) ? "text-white" : ""}`}
          >
            <span className="text-[17px] leading-none">{icon}</span>
            {label}
          </button>
        ))}
      </div>
      {logOpen ? (
        <div
          className="absolute inset-0 z-[70] flex cursor-default bg-[rgba(0,0,0,0.45)] px-[4vw] py-[8vh] backdrop-blur-[10px] transition-opacity duration-300 max-[640px]:px-[7vw] max-[640px]:py-[7vh]"
          onClick={(event) => {
            event.stopPropagation();
            setLogOpen(false);
          }}
        >
          <div
            ref={logScrollRef}
            className="als-scrollbar w-full max-w-[1040px] cursor-auto overflow-y-auto pl-[6%] pr-6 [mask-image:linear-gradient(to_bottom,transparent_0,black_32px,black_calc(100%-32px),transparent_100%)] [scrollbar-color:rgba(255,255,255,0.08)_transparent] [scrollbar-width:thin] max-[900px]:mx-auto max-[900px]:max-w-[640px] max-[900px]:pl-0 max-[640px]:px-[3vw]"
            style={{ fontFamily: playerFontFamily }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hidden">
              <div>
                <h3 className="text-sm font-bold tracking-[0.35em] text-white/70">LOG</h3>
                <p className="mt-1 text-xs font-medium text-white/45">현재 장면까지의 대사 기록</p>
              </div>
              <button
                type="button"
                onClick={() => setLogOpen(false)}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 shadow-none hover:bg-white/15"
              >
                Close
              </button>
            </div>
            <div className="space-y-[46px]">
              {visibleLogScenes.map((item, index) => {
                const mode = sceneDisplayMode(item);
                const isCode = mode === "code" || item.type === "code";
                const showSpeaker = mode !== "narration" && Boolean(item.speaker);
                return (
                  <button
                    key={`${item.id}-${index}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onJumpScene(index);
                      setLogOpen(false);
                    }}
                    className="relative block w-full cursor-pointer bg-transparent p-0 pl-[22px] text-left shadow-none transition-opacity hover:opacity-90 focus:outline-none focus:ring-0"
                  >
                    {index === current ? <span className="absolute left-0 top-1 h-[3px] w-[3px] rounded-full bg-[#ab9bf2] shadow-[0_0_5px_1px_rgba(171,155,242,0.7)]" aria-hidden="true" /> : null}
                    {showSpeaker ? <span className="mb-3 block text-[11px] font-normal tracking-[0.2em] text-[rgba(180,174,206,0.42)]">{item.speaker}</span> : null}
                    {isCode ? (
                      <code className="block whitespace-pre-wrap break-words font-mono text-[14.5px] leading-[2] text-[rgba(200,194,224,0.55)]">{item.text}</code>
                    ) : (
                      <p className={`m-0 whitespace-pre-wrap break-keep font-normal leading-[2] tracking-[0.01em] shadow-black/35 [text-shadow:0_1px_6px_var(--tw-shadow-color)] ${mode === "narration" ? "text-[16.5px] italic text-[rgba(196,190,216,0.48)] max-[640px]:text-[15px]" : "text-[19px] text-[rgba(235,233,244,0.94)] max-[640px]:text-[17px]"}`}>{item.text}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Toolbar({
  onSample,
  onConvert,
  onExport,
  onToggleJson,
  jsonOpen
}: {
  onSample: () => void;
  onConvert: () => void;
  onExport: () => void;
  onToggleJson: () => void;
  jsonOpen: boolean;
}) {
  const steps = ["로그 붙여넣기", "변환", "장면 수정", "Export"];
  const [active] = useState(1);
  return (
    <div className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-extrabold text-slate-900">AI Log Studio</span>
        </div>

        <div className="hidden md:flex items-center">
          {steps.map((label, i) => {
            const isActive = i === active;
            const isDone = i < active;
            return (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <span className={`h-5 w-5 flex items-center justify-center rounded-full text-[11px] font-bold ${isActive ? "bg-indigo-600 text-white" : isDone ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={`text-xs font-semibold ${isActive ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
                </div>
                {i < steps.length - 1 && <div className="w-8 h-px bg-slate-200 mx-3" />}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" icon={FileText} iconPosition="left" onClick={onSample}>샘플 로그</Button>
          <button type="button" onClick={onToggleJson} className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors ${jsonOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}>
            <Settings className="h-4 w-4" />
          </button>
          <button type="button" onClick={onConvert} className="h-9 rounded-lg px-3 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
            변환
          </button>
          <button type="button" onClick={onExport} className="hidden h-9 rounded-lg px-3 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:block">
            Export
          </button>
          <Avatar tone="slate" size={8} />
        </div>
      </div>
    </div>
  );
}

function Hero({
  scene,
  assets,
  current,
  total,
  autoPlay,
  onConvert,
  onSample,
  onExport,
  onNext,
  onToggleAuto,
  bgmEnabled,
  onToggleBgm,
  typingEnabled,
  typingSpeed,
  typingComplete,
  revealToken,
  onTypingComplete
}: {
  scene: VisualNovelScene;
  assets: AssetLibrary;
  current: number;
  total: number;
  autoPlay: boolean;
  onConvert: () => void;
  onSample: () => void;
  onExport: () => void;
  onNext: () => void;
  onToggleAuto: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
  typingEnabled: boolean;
  typingSpeed: number;
  typingComplete: boolean;
  revealToken: number;
  onTypingComplete: () => void;
}) {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-20 grid lg:grid-cols-2 gap-14 items-center">
      <div>
        <Badge tone="purple" className="mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          AI LOG → VISUAL NOVEL
        </Badge>
        <h1 className="text-[2.75rem] leading-[1.15] md:text-5xl font-extrabold text-slate-900 tracking-tight">
          AI 채팅 로그{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">비주얼 노벨 제작툴</span>
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" icon={ArrowRight} onClick={onConvert}>변환하기</Button>
          <Button variant="secondary" size="lg" icon={FileText} onClick={onSample}>샘플 로그 보기</Button>
          <Button variant="ghost" size="lg" icon={Download} onClick={onExport}>HTML Export</Button>
        </div>
        <div className="mt-10 flex items-center gap-6 text-xs text-slate-400 font-medium">
          <span>ChatGPT 지원</span><span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Claude 지원</span><span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Gemini 지원</span>
        </div>
      </div>

      <VNStage
        scene={scene}
        assets={assets}
        current={current}
        total={total}
        autoPlay={autoPlay}
        onNext={onNext}
        onJumpScene={() => undefined}
        onChoose={() => undefined}
        onToggleAuto={onToggleAuto}
        bgmEnabled={bgmEnabled}
        onToggleBgm={onToggleBgm}
        typingEnabled={typingEnabled}
        typingSpeed={typingSpeed}
        typingComplete={typingComplete}
        revealToken={revealToken}
        resetToken={0}
        playerFontFamily={getPlayerFontOption().cssFamily}
        onTypingComplete={onTypingComplete}
      />
    </section>
  );
}

function LogInputCard({
  log,
  onLogChange,
  onConvert,
  error
}: {
  log: string;
  onLogChange: (value: string) => void;
  onConvert: () => void;
  error: string | null;
}) {
  return (
    <Card className="self-start">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">로그 입력</h3>
          <p className="text-[13px] text-slate-500 mt-1">크랙, 플레이툰, 케이브덕 등 AI 채팅 플랫폼 로그를 붙여넣어 주세요.</p>
        </div>
        <Badge tone="slate">붙여넣기 전용</Badge>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <textarea
          value={log}
          onChange={(event) => onLogChange(event.target.value)}
          className="als-scrollbar h-[520px] max-h-[60vh] min-h-[260px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-[13px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
          placeholder={`User: 장면을 써줘.\nAI: 복도 끝에서 낮은 신호음이 들렸다.`}
        />
        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={ClipboardPaste} iconPosition="left" className="flex-1" onClick={() => navigator.clipboard?.readText().then(onLogChange).catch(() => undefined)}>붙여넣기</Button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-slate-400">지원 형식 · AI 채팅 플랫폼 로그 / 일반 텍스트</span>
        <Button variant="primary" icon={Wand2} onClick={onConvert}>변환하기</Button>
      </div>
    </Card>
  );
}

function PreviewCard({
  scene,
  scenesLength,
  current,
  assets,
  autoPlay,
  bgmEnabled,
  typingEnabled,
  typingSpeed,
  typingComplete,
  revealToken,
  onNext,
  onToggleAuto,
  onToggleBgm,
  onToggleTyping,
  typingSpeedMode,
  onTypingSpeedChange,
  onTypingComplete
}: {
  scene: VisualNovelScene;
  scenesLength: number;
  current: number;
  assets: AssetLibrary;
  autoPlay: boolean;
  bgmEnabled: boolean;
  typingEnabled: boolean;
  typingSpeed: number;
  typingComplete: boolean;
  revealToken: number;
  onNext: () => void;
  onToggleAuto: () => void;
  onToggleBgm: () => void;
  onToggleTyping: () => void;
  typingSpeedMode: TypingSpeedMode;
  onTypingSpeedChange: (mode: TypingSpeedMode) => void;
  onTypingComplete: () => void;
}) {
  return (
    <Card className="h-full flex flex-col" padded={false}>
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h3 className="text-lg font-extrabold text-slate-900">VN 미리보기</h3>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
          <Eye className="h-3.5 w-3.5" /> 실시간 렌더링
        </span>
      </div>

      <div className="px-6">
        <VNStageInline
          scene={scene}
          assets={assets}
          current={current}
          total={scenesLength}
          autoPlay={autoPlay}
          onNext={onNext}
          onToggleAuto={onToggleAuto}
          bgmEnabled={bgmEnabled}
          onToggleBgm={onToggleBgm}
          typingEnabled={typingEnabled}
          typingSpeed={typingSpeed}
          typingComplete={typingComplete}
          revealToken={revealToken}
          onTypingComplete={onTypingComplete}
        />
      </div>

      <div className="px-6 py-5 mt-auto">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onToggleTyping}
            className={`h-10 rounded-full border px-4 text-xs font-bold transition-colors ${typingEnabled ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            aria-pressed={typingEnabled}
          >
            타자 효과 {typingEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="h-1.5 w-40 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-indigo-500"
              animate={{ width: `${((current + 1) / Math.max(scenesLength, 1)) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function VNStageInline({
  scene,
  assets,
  current,
  total,
  autoPlay,
  onNext,
  onToggleAuto,
  bgmEnabled,
  onToggleBgm,
  typingEnabled,
  typingSpeed,
  typingComplete,
  revealToken,
  onTypingComplete
}: {
  scene: VisualNovelScene;
  assets: AssetLibrary;
  current: number;
  total: number;
  autoPlay: boolean;
  onNext: () => void;
  onToggleAuto: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
  typingEnabled: boolean;
  typingSpeed: number;
  typingComplete: boolean;
  revealToken: number;
  onTypingComplete: () => void;
}) {
  const bg = sceneBackground(scene);
  const backgroundAsset = scene.backgroundAssetId ? assets.backgroundAssets.find((asset) => asset.id === scene.backgroundAssetId) : undefined;
  const displayMode = sceneDisplayMode(scene);
  return (
    <div
      className="relative mx-auto aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-slate-200"
      role="button"
      tabIndex={0}
      aria-label="Advance dialogue"
      onClick={onNext}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onNext();
        }
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${scene.id}-${scene.backgroundAssetId ?? scene.background}`}
          initial={{ opacity: 0, scale: 1.05, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.97, x: -30 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-0 bg-gradient-to-br ${backgroundAsset ? "" : bg.gradient}`}
          style={backgroundAsset ? { backgroundImage: `url(${backgroundAsset.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_70%_30%,white,transparent_40%)]" />
          <div className="absolute inset-0 als-vignette" />
          {displayMode === "dialogue" ? <div className="absolute inset-0 z-10 pointer-events-none">
            {orderedCharacters(scene).map((character, index, allCharacters) => (
              <CharacterFigure
                key={`${character.assetId}-${character.position}-${index}`}
                character={character}
                asset={standingAssetForCharacter(character, scene, assets)}
                leftPercent={characterLeftPercent(character.position)}
                variant="inline"
                style={{ "--character-width": characterWidthPercent(allCharacters.length) } as React.CSSProperties}
              />
            ))}
          </div> : null}
        </motion.div>
      </AnimatePresence>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div key={`${scene.id}-d`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <DialoguePanel scene={scene} sceneIndex={current} totalScenes={total} typingEnabled={typingEnabled} typingSpeed={typingSpeed} typingComplete={typingComplete} revealToken={revealToken} fontFamily={getPlayerFontOption().cssFamily} onTypingComplete={onTypingComplete} variant="inline" compact />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="absolute right-3 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-1.5 sm:flex">
        {[
          ["Log", "☰"],
          ["Skip", "»"],
          ["Auto", "▶"],
          ["Menu", "≡"]
        ].map(([label, icon]) => (
          <button
            key={label}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (label === "Auto") onToggleAuto();
            }}
            disabled={label !== "Auto"}
            className={`flex flex-col items-center gap-0.5 bg-transparent p-0 text-[8px] font-semibold text-[#e8e4d8cc] shadow-none transition disabled:pointer-events-none disabled:opacity-55 ${label === "Auto" && autoPlay ? "text-white" : ""}`}
          >
            <span className="text-[15px] leading-none">{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompactHeroLegacy({
  onConvert,
  onSample,
  onExport
}: {
  onConvert: () => void;
  onSample: () => void;
  onExport: () => void;
}) {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-5 pt-8 text-center lg:px-8">
      <Badge tone="purple" className="mb-4">
        <Sparkles className="h-3.5 w-3.5" />
        AI LOG TO VISUAL NOVEL
      </Badge>
      <h1 className="text-[2.75rem] leading-[1.15] md:text-5xl font-extrabold text-slate-900 tracking-tight">
        AI 채팅 로그를 <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">비주얼 노벨로</span>
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-500">
        
      </p>
      {false ? <div>
        <Button variant="primary" size="lg" icon={ArrowRight} onClick={onConvert}>변환하기</Button>
        <Button variant="secondary" size="lg" icon={FileText} onClick={onSample}>샘플 로그 불러오기</Button>
        <Button variant="ghost" size="lg" icon={Download} onClick={onExport}>HTML 내보내기</Button>
      </div> : null}
    </section>
  );
}

function CompactHero({
  onConvert,
  onSample,
  onExport
}: {
  onConvert: () => void;
  onSample: () => void;
  onExport: () => void;
}) {
  void onConvert;
  void onSample;
  void onExport;
  return (
    <section className="mx-auto max-w-5xl px-6 pb-4 pt-8 text-center lg:px-8">
      <Badge tone="purple" className="mb-4">
        <Sparkles className="h-3.5 w-3.5" />
        AI LOG TO VISUAL NOVEL
      </Badge>
      <h1 className="text-[2.75rem] leading-[1.15] md:text-5xl font-extrabold text-slate-900 tracking-tight">
        AI 채팅 로그를 <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">비주얼 노벨로</span>
      </h1>
    </section>
  );
}

function LargeVNPreviewSection({
  scene,
  scenes,
  assets,
  current,
  total,
  autoPlay,
  onNext,
  onJumpScene,
  onChoose,
  onToggleAuto,
  bgmEnabled,
  onToggleBgm,
  typingEnabled,
  typingSpeed,
  typingComplete,
  revealToken,
  typingResetToken,
  pageText,
  textPageIndex,
  textPageTotal,
  playerFontFamily,
  onTypingComplete,
  onToggleTyping,
  typingSpeedMode,
  onTypingSpeedChange
}: {
  scene: VisualNovelScene;
  scenes: VisualNovelScene[];
  assets: AssetLibrary;
  current: number;
  total: number;
  autoPlay: boolean;
  onNext: () => void;
  onJumpScene: (index: number) => void;
  onChoose: (targetSceneId?: string) => void;
  onToggleAuto: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
  typingEnabled: boolean;
  typingSpeed: number;
  typingComplete: boolean;
  revealToken: number;
  typingResetToken: number;
  pageText?: string;
  textPageIndex?: number;
  textPageTotal?: number;
  playerFontFamily: string;
  onTypingComplete: () => void;
  onToggleTyping: () => void;
  typingSpeedMode: TypingSpeedMode;
  onTypingSpeedChange: (mode: TypingSpeedMode) => void;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">VN 미리보기</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">화면을 클릭하거나 Space / Enter로 다음 대사를 진행합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleTyping}
            className={`h-10 rounded-full border px-4 text-xs font-bold transition-colors ${typingEnabled ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
            aria-pressed={typingEnabled}
          >
            타자 효과 {typingEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      <VNStage
        scene={scene}
        assets={assets}
        current={current}
        total={total}
        autoPlay={autoPlay}
        onNext={onNext}
        onJumpScene={onJumpScene}
        onChoose={onChoose}
        onToggleAuto={onToggleAuto}
        bgmEnabled={bgmEnabled}
        onToggleBgm={onToggleBgm}
        typingEnabled={typingEnabled}
        typingSpeed={typingSpeed}
        typingComplete={typingComplete}
        revealToken={revealToken}
        resetToken={typingResetToken}
        pageText={pageText}
        textPageIndex={textPageIndex}
        textPageTotal={textPageTotal}
        playerFontFamily={playerFontFamily}
        onTypingComplete={onTypingComplete}
      />
    </section>
  );
}

function Workspace({
  log,
  onLogChange,
  onConvert,
  error,
  scene,
  scenesLength,
  current,
  assets,
  autoPlay,
  bgmEnabled,
  typingEnabled,
  typingSpeed,
  typingComplete,
  revealToken,
  onNext,
  onToggleAuto,
  onToggleBgm,
  onToggleTyping,
  typingSpeedMode,
  onTypingSpeedChange,
  onTypingComplete
}: {
  log: string;
  onLogChange: (value: string) => void;
  onConvert: () => void;
  error: string | null;
  scene: VisualNovelScene;
  scenesLength: number;
  current: number;
  assets: AssetLibrary;
  autoPlay: boolean;
  bgmEnabled: boolean;
  typingEnabled: boolean;
  typingSpeed: number;
  typingComplete: boolean;
  revealToken: number;
  onNext: () => void;
  onToggleAuto: () => void;
  onToggleBgm: () => void;
  onToggleTyping: () => void;
  typingSpeedMode: TypingSpeedMode;
  onTypingSpeedChange: (mode: TypingSpeedMode) => void;
  onTypingComplete: () => void;
}) {
  return (
    <section id="workspace" className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
      <div className="grid lg:grid-cols-[45%_55%] gap-6 items-stretch">
        <LogInputCard log={log} onLogChange={onLogChange} onConvert={onConvert} error={error} />
        <PreviewCard
          scene={scene}
          scenesLength={scenesLength}
          current={current}
        assets={assets}
        autoPlay={autoPlay}
          bgmEnabled={bgmEnabled}
          typingEnabled={typingEnabled}
          typingSpeed={typingSpeed}
          typingComplete={typingComplete}
          revealToken={revealToken}
        onNext={onNext}
          onToggleAuto={onToggleAuto}
          onToggleBgm={onToggleBgm}
          onToggleTyping={onToggleTyping}
          typingSpeedMode={typingSpeedMode}
          onTypingSpeedChange={onTypingSpeedChange}
          onTypingComplete={onTypingComplete}
        />
      </div>
    </section>
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
    audioRef.current.src = asset.dataUrl;
    audioRef.current.play().then(() => setPlayingId(asset.id)).catch(() => onError("브라우저 정책상 먼저 재생 버튼을 눌러야 합니다."));
  }

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
      <Card>
        <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">에셋 관리</h3>
            <p className="text-[13px] text-slate-500 mt-1">스탠딩, 배경, BGM을 등록해서 Scene에 연결합니다.</p>
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {[
              ["standing", "스탠딩"],
              ["background", "배경"],
              ["bgm", "BGM"]
            ].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id as typeof tab)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tab === id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="mb-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-xs font-semibold text-slate-400 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-500">
          <Upload className="h-4 w-4" />
          {tab === "bgm" ? "mp3, wav, ogg 업로드" : "png, jpg, webp 업로드"}
          <input type="file" multiple accept={tab === "bgm" ? ".mp3,.wav,.ogg,audio/*" : ".png,.jpg,.jpeg,.webp,image/*"} onChange={(event) => uploadFiles(event.target.files, tab)} className="sr-only" />
        </label>

        {tab === "standing" && (
          <div>
            <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
              스탠딩 이름을 대사 화자명과 같게 맞추면, 해당 캐릭터 대사 장면에 자동으로 표시됩니다.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {assets.standingAssets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex aspect-[3/4] items-end justify-center overflow-hidden rounded-xl bg-slate-100">
                    <img src={asset.dataUrl} alt={asset.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <input value={asset.name} onChange={(event) => rename("standingAssets", asset.id, event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  <button type="button" onClick={() => remove("standingAssets", asset.id)} className="mt-2 text-xs font-bold text-rose-500">삭제</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "background" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {assets.backgroundAssets.map((asset) => (
              <div key={asset.id} className="rounded-2xl border border-slate-200 p-3">
                <img src={asset.dataUrl} alt={asset.name} className="aspect-video w-full rounded-xl object-cover" />
                <input value={asset.name} onChange={(event) => rename("backgroundAssets", asset.id, event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                <button type="button" onClick={() => remove("backgroundAssets", asset.id)} className="mt-2 text-xs font-bold text-rose-500">삭제</button>
              </div>
            ))}
          </div>
        )}

        {tab === "bgm" && (
          <div className="grid gap-3">
            {assets.bgmAssets.map((asset) => (
              <div key={asset.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                <button type="button" onClick={() => togglePreview(asset)} className={`h-9 w-9 flex items-center justify-center rounded-full border transition-colors ${playingId === asset.id ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {playingId === asset.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <input value={asset.name} onChange={(event) => rename("bgmAssets", asset.id, event.target.value)} className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                <span className="truncate text-xs text-slate-400">{asset.fileName}</span>
                <button type="button" onClick={() => remove("bgmAssets", asset.id)} className="text-xs font-bold text-rose-500">삭제</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function SceneCard({
  scene,
  scenes,
  index,
  assets,
  current,
  selected,
  onSelect,
  onToggleSelection,
  onUpdateScene,
  onUpdateCharacter,
  onAddCharacter,
  onRemoveCharacter,
  onDeleteScene,
  onDragStart,
  onDropScene
}: {
  scene: VisualNovelScene;
  scenes: VisualNovelScene[];
  index: number;
  assets: AssetLibrary;
  current: number;
  selected: boolean;
  onSelect: (index: number) => void;
  onToggleSelection: (index: number) => void;
  onUpdateScene: (index: number, patch: Partial<VisualNovelScene>) => void;
  onUpdateCharacter: (sceneIndex: number, characterIndex: number, patch: Partial<SceneCharacter>) => void;
  onAddCharacter: (sceneIndex: number) => void;
  onRemoveCharacter: (sceneIndex: number, characterIndex: number) => void;
  onDeleteScene: (index: number) => void;
  onDragStart: (index: number) => void;
  onDropScene: (index: number) => void;
}) {
  const bg = sceneBackground(scene);
  const uploadedBg = scene.backgroundAssetId ? assets.backgroundAssets.find((asset) => asset.id === scene.backgroundAssetId) : undefined;
  const isChoiceScene = sceneDisplayMode(scene) === "choice" || Boolean(scene.choices?.length);
  const sceneIds = new Set(scenes.map((item) => item.id));
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropScene(index)}
      className={`group rounded-2xl border overflow-hidden bg-white hover:border-slate-300 hover:shadow-md transition-all ${isChoiceScene ? "border-amber-200 bg-amber-50/25" : ""} ${selected ? "border-purple-300 ring-2 ring-purple-100" : current === index ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"}`}
    >
      <button
        type="button"
        onClick={() => onSelect(index)}
        className={`relative aspect-video w-full bg-gradient-to-br ${uploadedBg ? "" : bg.gradient} flex items-center justify-center`}
        style={uploadedBg ? { backgroundImage: `url(${uploadedBg.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {!uploadedBg && <span className="text-3xl font-black text-white/80">{bg.icon}</span>}
        <span className="absolute top-2 left-2 h-6 w-6 rounded-md bg-black/30 text-white text-[11px] font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <span
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelection(index);
          }}
          className={`absolute left-10 top-2 flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-extrabold transition-colors ${selected ? "bg-purple-600 text-white" : "bg-white/85 text-slate-600 hover:bg-white"}`}
        >
          {selected ? "Selected" : "Select"}
        </span>
        <span className="absolute top-2 right-2 h-6 w-6 rounded-md bg-black/30 text-white/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <span className="absolute bottom-2 left-2 text-[11px] font-semibold text-white/90 bg-black/30 rounded-full px-2 py-0.5">
          {uploadedBg?.name ?? bg.location}
        </span>
        {isChoiceScene ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-amber-950 shadow-sm">
            선택지 노드
          </span>
        ) : null}
      </button>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Avatar tone={scene.role === "user" ? "purple" : "indigo"} size={6} />
          <input value={scene.speaker ?? ""} onChange={(event) => onUpdateScene(index, { speaker: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          <Pill role={scene.role} />
        </div>

        <textarea value={scene.text} onChange={(event) => onUpdateScene(index, { text: event.target.value })} className="als-scrollbar min-h-[72px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 p-2 text-[13px] leading-relaxed text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />

        {scene.choices?.length ? (
          <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50/50 p-2">
            <p className="mb-2 text-[11px] font-extrabold text-purple-600">선택지 노드 · Branch 연결</p>
            <div className="space-y-2">
              {scene.choices.map((choice, choiceIndex) => (
                <div key={choice.id} className="grid gap-1">
                  <input
                    value={choice.text}
                    onChange={(event) => onUpdateScene(index, { choices: scene.choices?.map((item, innerIndex) => innerIndex === choiceIndex ? { ...item, text: event.target.value } : item) })}
                    className="rounded-lg border border-purple-100 bg-white px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                  <select
                    value={choice.targetSceneId ?? ""}
                    onChange={(event) => onUpdateScene(index, { choices: scene.choices?.map((item, innerIndex) => innerIndex === choiceIndex ? { ...item, targetSceneId: event.target.value || undefined } : item) })}
                    className="rounded-lg border border-purple-100 bg-white px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="">다음 Scene으로 이동</option>
                    {scenes.map((targetScene, targetIndex) => (
                      <option key={targetScene.id} value={targetScene.id}>Scene {targetIndex + 1} · {sceneExcerpt(targetScene, 32)}</option>
                    ))}
                  </select>
                  <p className={`text-[10px] font-semibold ${choice.targetSceneId && sceneIds.has(choice.targetSceneId) ? "text-purple-500" : "text-rose-500"}`}>
                    {choice.targetSceneId
                      ? sceneIds.has(choice.targetSceneId)
                        ? `연결 대상: Scene ${scenes.findIndex((targetScene) => targetScene.id === choice.targetSceneId) + 1}`
                        : "경고: 삭제되었거나 존재하지 않는 Scene을 가리킵니다."
                      : "경고: 연결 대상이 비어 있습니다. 선택 시 다음 Scene으로 이동합니다."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {scene.effects?.length ? (
          <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2">
            <p className="mb-2 text-[11px] font-extrabold text-indigo-600">VN Effects</p>
            <div className="flex flex-wrap gap-1.5">
              {scene.effects.map((effect) => (
                <span key={effect.id} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-100">
                  {effectLabel(effect)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <select value={scene.backgroundAssetId ?? ""} onChange={(event) => onUpdateScene(index, { backgroundAssetId: event.target.value || undefined })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600">
            <option value="">더미 배경</option>
            {assets.backgroundAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          <select value={scene.bgmAssetId ?? ""} onChange={(event) => onUpdateScene(index, { bgmAssetId: event.target.value || undefined })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600">
            <option value="">BGM 없음</option>
            {assets.bgmAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Characters</span>
            <button type="button" onClick={() => onAddCharacter(index)} disabled={scene.characters.length >= 3} className="text-[11px] font-bold text-indigo-600 disabled:text-slate-300">추가</button>
          </div>
          <div className="space-y-2">
            {scene.characters.map((character, characterIndex) => (
              <div key={`${character.position}-${characterIndex}`} className="grid grid-cols-[1fr_76px_70px_24px] gap-1">
                <select
                  value={character.assetId}
                  onChange={(event) => {
                    const asset = assets.standingAssets.find((item) => item.id === event.target.value);
                    onUpdateCharacter(index, characterIndex, { assetId: event.target.value, name: asset?.name ?? character.name });
                  }}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600"
                >
                  <option value="">미등록</option>
                  {assets.standingAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                <select value={character.position} onChange={(event) => onUpdateCharacter(index, characterIndex, { position: event.target.value as SceneCharacter["position"] })} className="rounded-lg border border-slate-200 bg-white px-1 py-1 text-[11px] text-slate-600">
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
                <label className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1 text-[11px] text-slate-600">
                  <input type="checkbox" checked={character.isSpeaking} onChange={(event) => onUpdateCharacter(index, characterIndex, { isSpeaking: event.target.checked })} className="accent-indigo-600" />
                  말함
                </label>
                <button type="button" onClick={() => onRemoveCharacter(index, characterIndex)} className="rounded-lg text-rose-400 hover:bg-rose-50">×</button>
                <input value={character.name} onChange={(event) => onUpdateCharacter(index, characterIndex, { name: event.target.value })} className="col-span-4 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Scene {String(index + 1).padStart(2, "0")}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onSelect(index)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onDeleteScene(index)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectionStatusBar({
  selection,
  canUndo,
  onSelectAll,
  onClear,
  onUndo
}: {
  selection: SelectionState;
  canUndo: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
      <div>
        <p className="text-xs font-extrabold text-indigo-700">Selection / 선택 영역</p>
        <p className="mt-1 text-xs text-indigo-500">
          {selection.sceneIndexes.length ? `${selectionLabel(selection)} 선택됨 · Scene ${selection.sceneIndexes.map((index) => index + 1).join(", ")}` : "도구를 실행할 Scene 또는 텍스트 블록을 선택하세요."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onSelectAll}>전체 선택</Button>
        <Button variant="ghost" size="sm" onClick={onClear}>선택 해제</Button>
        <Button variant="secondary" size="sm" onClick={onUndo} disabled={!canUndo}>Undo</Button>
      </div>
    </div>
  );
}

function CandidateDiff({
  candidate
}: {
  candidate: ToolCandidate | null;
}) {
  if (!candidate) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4">
        <p className="text-xs font-extrabold text-slate-500">Preview / Diff</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">도구를 실행하면 원본과 candidate가 여기에 나란히 표시됩니다. Apply 전까지 실제 Scene 데이터는 바뀌지 않습니다.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-purple-700">{candidate.title}</p>
          <p className="mt-1 text-xs text-purple-500">{candidate.summary}</p>
        </div>
        <Badge tone="purple">{selectionLabel(candidate.selection)}</Badge>
      </div>
      {candidate.toolId === "choices" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">choiceScene + choices[] + branchScenes[]</p>
          {candidate.choiceScene?.choices?.length ? (
            <div className="rounded-2xl bg-slate-950 px-6 py-5 text-[#f4f0e6]">
              <p className="mb-4 text-center text-sm font-semibold">{candidate.choiceScene.text}</p>
              <div className="space-y-2 border-y border-white/15 py-4">
                {candidate.choiceScene.choices.map((choice, index) => (
                  <div key={choice.id} className="rounded-lg px-3 py-2 text-sm hover:bg-white/10">
                    <span className="mr-3 text-white/45">{index + 1}.</span>
                    {choice.text}
                    <span className="ml-3 text-xs text-white/35">→ branch Scene {index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {(candidate.branchScenes ?? candidate.candidateScenes.slice(1)).map((branchScene, index) => (
              <div key={branchScene.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-extrabold text-slate-400">branchScenes[{index}]</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{branchScene.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Apply하면 현재 선택 영역 뒤에 choiceScene 1개와 branchScenes {Math.max((candidate.branchScenes ?? []).length, candidate.candidateScenes.length - 1)}개가 삽입되고, 각 choice.targetSceneId가 branch Scene으로 연결됩니다.</p>
        </div>
      ) : (
      <div className="grid gap-3 lg:grid-cols-2">
        {candidate.originalScenes.map((original, index) => {
          const next = candidate.candidateScenes[index];
          return (
            <div key={`${candidate.id}-${original.id}-${index}`} className="contents">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Original · Scene {candidate.selection.sceneIndexes[index] + 1}</p>
                <p className="whitespace-pre-wrap break-keep text-xs leading-6 text-slate-600">{original.text}</p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-purple-400">Candidate</p>
                <p className="whitespace-pre-wrap break-keep text-xs leading-6 text-slate-700">{next?.text ?? ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function EditToolsPanel({
  scenes,
  assets,
  selection,
  candidate,
  onCandidate
}: {
  scenes: VisualNovelScene[];
  assets: AssetLibrary;
  selection: SelectionState;
  candidate: ToolCandidate | null;
  onCandidate: (candidate: ToolCandidate) => void;
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [batchSpeaker, setBatchSpeaker] = useState("");
  const [batchMode, setBatchMode] = useState("");
  const [batchBackgroundId, setBatchBackgroundId] = useState("");
  const selectedScenes = selection.sceneIndexes.map((index) => scenes[index]).filter(Boolean);
  const disabled = selectedScenes.length === 0;

  function runBatchEdit() {
    const patch: Partial<VisualNovelScene> = {};
    if (batchSpeaker.trim()) patch.speaker = batchSpeaker.trim();
    if (batchMode) patch.displayMode = batchMode as VisualNovelScene["displayMode"];
    if (batchBackgroundId !== "") patch.backgroundAssetId = batchBackgroundId || undefined;
    if (!Object.keys(patch).length) return;
    onCandidate(createBatchEditCandidate(scenes, selection, patch));
  }

  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h4 className="text-sm font-extrabold text-slate-900">Edit Tools</h4>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">선택 영역만 대상으로 도구를 실행하고, Preview/Diff 확인 후 Apply하세요.</p>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => onCandidate(createChoiceCandidate(scenes, selection))}
            disabled={disabled}
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-left transition hover:bg-indigo-50 disabled:opacity-45"
          >
            <span className="block text-xs font-extrabold text-indigo-700">AI · 선택지 생성</span>
            <span className="mt-1 block text-xs leading-5 text-indigo-500">선택 영역의 흐름 뒤에 독자 선택지를 candidate로 만듭니다.</span>
          </button>
          <button
            type="button"
            onClick={() => onCandidate(createEnhanceEffectCandidate(scenes, selection))}
            disabled={disabled}
            className="w-full rounded-2xl border border-purple-100 bg-purple-50/60 p-3 text-left transition hover:bg-purple-50 disabled:opacity-45"
          >
            <span className="block text-xs font-extrabold text-purple-700">AI · 연출 강화</span>
            <span className="mt-1 block text-xs leading-5 text-purple-500">장면의 정적, 시선, 분위기 같은 VN 연출 문장을 제안합니다.</span>
          </button>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-extrabold text-slate-600">AI · 검색 + 수정</p>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선택 영역에서 찾을 문구" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="바꿀 문구 또는 수정 방향" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <Button variant="secondary" size="sm" className="mt-2 w-full" disabled={disabled} onClick={() => onCandidate(createSearchAiCandidate(scenes, selection, query, replacement))}>Candidate 생성</Button>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3">
            <p className="text-xs font-extrabold text-slate-600">Batch Edit · 일반 편집</p>
            <input value={batchSpeaker} onChange={(event) => setBatchSpeaker(event.target.value)} placeholder="speaker 일괄 변경, 비우면 유지" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <select value={batchMode} onChange={(event) => setBatchMode(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="">displayMode 유지</option>
              <option value="dialogue">dialogue</option>
              <option value="narration">narration</option>
              <option value="system">system</option>
              <option value="code">code</option>
            </select>
            <select value={batchBackgroundId} onChange={(event) => setBatchBackgroundId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="">background 유지</option>
              <option value="__clear__">background 비우기</option>
              {assets.backgroundAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              disabled={disabled}
              onClick={() => {
                const normalizedBackground = batchBackgroundId === "__clear__" ? "" : batchBackgroundId;
                setBatchBackgroundId(normalizedBackground);
                const patch: Partial<VisualNovelScene> = {};
                if (batchSpeaker.trim()) patch.speaker = batchSpeaker.trim();
                if (batchMode) patch.displayMode = batchMode as VisualNovelScene["displayMode"];
                if (batchBackgroundId) patch.backgroundAssetId = batchBackgroundId === "__clear__" ? undefined : batchBackgroundId;
                if (Object.keys(patch).length) onCandidate(createBatchEditCandidate(scenes, selection, patch));
              }}
            >
              Batch Candidate 생성
            </Button>
          </div>
        </div>
      </div>
      <CandidateDiff candidate={candidate} />
    </div>
  );
}

function WorkflowCandidateDiff({
  candidate,
  onCandidateChange,
  onApply,
  onCancel
}: {
  candidate: ToolCandidate | null;
  onCandidateChange: (candidate: ToolCandidate) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  if (!candidate) return null;
  function toggleEffect(effectId: string) {
    if (!candidate) return;
    const selected = new Set(candidate.selectedEffectIds ?? []);
    if (selected.has(effectId)) selected.delete(effectId);
    else selected.add(effectId);
    onCandidateChange({ ...candidate, selectedEffectIds: Array.from(selected) });
  }
  return (
    <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-purple-700">Preview / Diff</p>
          <p className="mt-1 text-xs text-purple-500">{candidate.title} · {candidate.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onApply}>Apply</Button>
        </div>
      </div>
      {candidate.toolId === "enhance" && candidate.effectSuggestions ? (
        <div className="grid gap-3">
          {candidate.effectSuggestions.map((suggestion) => {
            const original = candidate.originalScenes.find((scene) => scene.id === suggestion.sceneId);
            const selected = new Set(candidate.selectedEffectIds ?? []);
            return (
              <div key={suggestion.sceneId} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Scene {suggestion.sceneIndex + 1}</p>
                <p className="whitespace-pre-wrap break-keep text-xs leading-6 text-slate-600">{original?.text ?? ""}</p>
                <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wide text-purple-400">Suggested Effects</p>
                <div className="mt-2 grid gap-2">
                  {suggestion.effects.map((effect) => (
                    <label key={effect.id} className="flex items-center gap-2 rounded-lg border border-purple-100 bg-purple-50/60 px-3 py-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={selected.has(effect.id)} onChange={() => toggleEffect(effect.id)} className="accent-purple-600" />
                      {effectLabel(effect)}
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-400">Text change: 없음</p>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="grid gap-3 lg:grid-cols-2">
        {candidate.originalScenes.map((original, index) => {
          const next = candidate.candidateScenes[index];
          return (
            <div key={`${candidate.id}-${original.id}-${index}`} className="contents">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Original · Scene {candidate.selection.sceneIndexes[index] + 1}</p>
                <p className="whitespace-pre-wrap break-keep text-xs leading-6 text-slate-600">{original.text}</p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-purple-400">Candidate</p>
                <p className="whitespace-pre-wrap break-keep text-xs leading-6 text-slate-700">{next?.text ?? ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function WorkflowToolsPanel({
  scenes,
  assets,
  selection,
  candidate,
  onCandidate,
  onApply,
  onCancel
}: {
  scenes: VisualNovelScene[];
  assets: AssetLibrary;
  selection: SelectionState;
  candidate: ToolCandidate | null;
  onCandidate: (candidate: ToolCandidate) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const [aiTool, setAiTool] = useState<AiToolId>("enhance");
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSpeaker, setBatchSpeaker] = useState("");
  const [batchMode, setBatchMode] = useState("");
  const [batchBackgroundId, setBatchBackgroundId] = useState("");
  const selectedScenes = selection.sceneIndexes.map((index) => scenes[index]).filter(Boolean);
  const disabled = selectedScenes.length === 0;
  const currentStep = candidate ? 5 : disabled ? 1 : 2;

  function generateCandidate() {
    if (disabled) return;
    if (aiTool === "choices") onCandidate(createChoiceCandidate(scenes, selection));
    if (aiTool === "enhance") onCandidate(createEnhanceEffectCandidate(scenes, selection));
    if (aiTool === "search-ai") onCandidate(createSearchAiCandidate(scenes, selection, query, replacement));
  }

  function generateBatchCandidate() {
    if (disabled) return;
    const patch: Partial<VisualNovelScene> = {};
    if (batchSpeaker.trim()) patch.speaker = batchSpeaker.trim();
    if (batchMode) patch.displayMode = batchMode as VisualNovelScene["displayMode"];
    if (batchBackgroundId) patch.backgroundAssetId = batchBackgroundId === "__clear__" ? undefined : batchBackgroundId;
    if (Object.keys(patch).length) onCandidate(createBatchEditCandidate(scenes, selection, patch));
  }

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h4 className="text-sm font-extrabold text-slate-900">Selection Workflow</h4>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">선택 영역을 정한 뒤, 하나의 작업만 골라 candidate를 확인하고 Apply합니다.</p>
        </div>
        <Badge tone={candidate ? "purple" : disabled ? "slate" : "indigo"}>Step {currentStep}</Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {["1 Selection", "2 AI Tool", "3 Preview / Apply"].map((label, index) => {
          const active = index === 0 ? disabled : index === 1 ? !disabled && !candidate : Boolean(candidate);
          return (
            <div key={label} className={`rounded-xl border px-3 py-2 text-xs font-bold ${active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-100 bg-slate-50 text-slate-400"}`}>
              {label}
            </div>
          );
        })}
      </div>

      {disabled ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-extrabold text-slate-700">먼저 Selection / 선택 영역을 지정하세요.</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">아래 Scene 카드에서 Select를 누르면 다음 단계가 열립니다. 선택하지 않으면 현재 Scene을 기본 대상으로 사용합니다.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="grid gap-3 md:grid-cols-[240px_1fr_auto] md:items-end">
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">AI Tool</label>
              <select
                value={aiTool}
                onChange={(event) => {
                  setAiTool(event.target.value as AiToolId);
                  onCancel();
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="enhance">연출 강화</option>
                <option value="choices">선택지 생성</option>
                <option value="search-ai">AI 수정</option>
              </select>
            </div>

            {aiTool === "search-ai" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선택 영역에서 찾을 문구" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="바꿀 문구 또는 수정 방향" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-500">
                  {aiTool === "choices" ? "선택 영역 뒤에 독자 선택지 candidate를 만듭니다." : "선택 영역에 VN 연출 문장 candidate를 제안합니다."}
                </p>
              </div>
            )}

            <Button variant="primary" size="md" icon={Wand2} iconPosition="left" onClick={generateCandidate}>
              Generate
            </Button>
          </div>

          <WorkflowCandidateDiff candidate={candidate} onCandidateChange={onCandidate} onApply={onApply} onCancel={onCancel} />
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-slate-100 bg-white">
        <button type="button" onClick={() => setBatchOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div>
            <p className="text-xs font-extrabold text-slate-600">General Edit Tools</p>
            <p className="mt-0.5 text-xs text-slate-400">Batch Edit는 AI가 아닌 일반 편집 도구입니다.</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${batchOpen ? "rotate-180" : ""}`} />
        </button>
        {batchOpen ? (
          <div className="grid gap-2 border-t border-slate-100 p-4 md:grid-cols-[1fr_180px_220px_auto]">
            <input value={batchSpeaker} onChange={(event) => setBatchSpeaker(event.target.value)} placeholder="speaker 일괄 변경" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <select value={batchMode} onChange={(event) => setBatchMode(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="">displayMode 유지</option>
              <option value="dialogue">dialogue</option>
              <option value="narration">narration</option>
              <option value="system">system</option>
              <option value="code">code</option>
            </select>
            <select value={batchBackgroundId} onChange={(event) => setBatchBackgroundId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="">background 유지</option>
              <option value="__clear__">background 비우기</option>
              {assets.backgroundAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Button variant="secondary" size="sm" disabled={disabled} onClick={generateBatchCandidate}>Candidate</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SceneAccordion({
  scenes,
  assets,
  current,
  fileInputRef,
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
  onApplyBackgroundBulk,
  onApplyBgmBulk,
  onCommitCandidate,
  canUndo,
  onUndo
}: {
  scenes: VisualNovelScene[];
  assets: AssetLibrary;
  current: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
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
  onApplyBackgroundBulk: (backgroundAssetId: string | undefined, mode: "all" | "empty") => void;
  onApplyBgmBulk: (bgmAssetId: string | undefined, mode: "all" | "empty") => void;
  onCommitCandidate: (candidate: ToolCandidate) => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bulkBackgroundId, setBulkBackgroundId] = useState("");
  const [bulkBgmId, setBulkBgmId] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [candidate, setCandidate] = useState<ToolCandidate | null>(null);
  const selection = buildSelection(selectedIndexes.length ? selectedIndexes : [current], scenes);

  function toggleSelection(index: number) {
    setSelectedIndexes((value) => {
      const next = value.includes(index) ? value.filter((item) => item !== index) : [...value, index];
      return next.sort((a, b) => a - b);
    });
    setCandidate(null);
  }

  function applyCandidate() {
    if (!candidate) return;
    onCommitCandidate(candidate);
    setCandidate(null);
  }

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
      <Card padded={false}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Layers className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-left">
              <h3 className="text-[15px] font-extrabold text-slate-900">장면 편집</h3>
              <p className="text-xs text-slate-400">카드를 열어 speaker · background · text · asset을 수정</p>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="px-6 pb-6 pt-1 border-t border-slate-100">
            <SelectionStatusBar
              selection={selection}
              canUndo={canUndo}
              onSelectAll={() => {
                setSelectedIndexes(scenes.map((_, index) => index));
                setCandidate(null);
              }}
              onClear={() => {
                setSelectedIndexes([]);
                setCandidate(null);
              }}
              onUndo={onUndo}
            />
            <WorkflowToolsPanel
              scenes={scenes}
              assets={assets}
              selection={selection}
              candidate={candidate}
              onCandidate={setCandidate}
              onApply={applyCandidate}
              onCancel={() => setCandidate(null)}
            />
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-slate-500">배경 일괄 적용</span>
                <select
                  value={bulkBackgroundId}
                  onChange={(event) => setBulkBackgroundId(event.target.value)}
                  className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:max-w-[260px]"
                >
                  <option value="">더미 배경</option>
                  {assets.backgroundAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                <Button variant="secondary" size="sm" onClick={() => onApplyBackgroundBulk(bulkBackgroundId || undefined, "all")}>전체 적용</Button>
                <Button variant="secondary" size="sm" onClick={() => onApplyBackgroundBulk(bulkBackgroundId || undefined, "empty")}>빈 장면만</Button>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-slate-500">BGM 일괄 적용</span>
                <select
                  value={bulkBgmId}
                  onChange={(event) => setBulkBgmId(event.target.value)}
                  className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:max-w-[260px]"
                >
                  <option value="">BGM 없음</option>
                  {assets.bgmAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                <Button variant="secondary" size="sm" onClick={() => onApplyBgmBulk(bulkBgmId || undefined, "all")}>전체 적용</Button>
                <Button variant="secondary" size="sm" onClick={() => onApplyBgmBulk(bulkBgmId || undefined, "empty")}>빈 장면만</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
              <Button variant="secondary" size="sm" icon={Plus} iconPosition="left" onClick={onAddScene}>새 장면 추가</Button>
              <Button variant="secondary" size="sm" icon={Upload} iconPosition="left" onClick={() => fileInputRef.current?.click()}>JSON Import</Button>
              <Button variant="secondary" size="sm" icon={Download} iconPosition="left" onClick={onExportJson}>JSON Export</Button>
              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => onImportJson(event.target.files?.[0])} />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenes.map((scene, index) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  scenes={scenes}
                  index={index}
                  assets={assets}
                  current={current}
                  selected={selection.sceneIndexes.includes(index)}
                  onSelect={onSelect}
                  onToggleSelection={toggleSelection}
                  onUpdateScene={onUpdateScene}
                  onUpdateCharacter={onUpdateCharacter}
                  onAddCharacter={onAddCharacter}
                  onRemoveCharacter={onRemoveCharacter}
                  onDeleteScene={onDeleteScene}
                  onDragStart={onDragStart}
                  onDropScene={onDropScene}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
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
    <section className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <FileJson className="h-5 w-5 text-slate-500" />
          <h3 className="text-lg font-extrabold text-slate-900">Scene JSON</h3>
        </div>
        {error ? <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p> : null}
        <textarea value={jsonText} onChange={(event) => onChange(event.target.value)} className="als-scrollbar h-[360px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 p-4 font-mono text-xs leading-6 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
      </Card>
    </section>
  );
}

function ExportCard({
  scenes,
  assets,
  playerFontId,
  onPlayerFontChange,
  onExportJson,
  onExportHtml,
  onResetProgress
}: {
  scenes: VisualNovelScene[];
  assets: AssetLibrary;
  playerFontId: string;
  onPlayerFontChange: (fontId: string) => void;
  onExportJson: () => void;
  onExportHtml: () => void;
  onResetProgress: () => void;
}) {
  const assetCount = assets.standingAssets.length + assets.backgroundAssets.length + assets.bgmAssets.length;
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">작품 내보내기</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">완성한 비주얼 노벨을 하나의 HTML 파일로 내보내요.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-8">
          <div>
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-indigo-900 to-purple-950 shadow-lg shadow-indigo-200/60">
              <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_30%_20%,white,transparent_35%)]" />
              <div className="absolute inset-0 als-vignette" />
              <div className="absolute top-3 left-3">
                <Badge tone="indigo" className="!bg-white/15 !border-white/20 !text-white">완성본</Badge>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white font-extrabold text-[15px] leading-snug">{scenes[0]?.speaker ?? "AI Log Studio"}의 이야기</p>
                <p className="text-white/60 text-xs mt-1">{scenes.length} scenes · {assetCount} assets</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={ImageIcon} iconPosition="left" className="w-full mt-3" onClick={onResetProgress}>
              이어보기 초기화
            </Button>
          </div>

          <div className="flex flex-col">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">작품 제목</label>
                <input defaultValue="AI Log Visual Novel" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">작가명</label>
                <input defaultValue="Seya" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300" />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">작품 설명</label>
              <textarea
                defaultValue="AI와 주고받은 대화를 클릭해서 읽는 비주얼 노벨로 구성했습니다."
                rows={2}
                className="als-scrollbar mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">플레이어 폰트</label>
              <select
                value={playerFontId}
                onChange={(event) => onPlayerFontChange(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              >
                {PLAYER_FONT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-[13px] font-bold text-slate-800">{scenes.length}</p>
                  <p className="text-[10px] text-slate-400">Scenes</p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-[13px] font-bold text-slate-800">약 {Math.max(1, Math.ceil(scenes.length / 8))}분</p>
                  <p className="text-[10px] text-slate-400">예상 재생</p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center gap-2">
                <FileText className="h-4 w-4 text-rose-500" />
                <div>
                  <p className="text-[13px] font-bold text-slate-800">{assetCount}</p>
                  <p className="text-[10px] text-slate-400">Assets</p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 flex items-center gap-3">
              <Button variant="secondary" size="lg" icon={Eye} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>미리보기</Button>
              <Button variant="secondary" size="lg" icon={FileJson} onClick={onExportJson}>JSON</Button>
              <Button variant="accent" size="lg" icon={Download} className="flex-1" onClick={onExportHtml}>
                HTML로 내보내기
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 mt-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span className="font-semibold text-slate-500">AI Log Studio</span>
          <span className="hidden sm:inline">· 대화를 이야기로</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <a href="#" className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
            <GitBranch className="h-4 w-4" />
            GitHub
          </a>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <Badge tone="slate">v0.1.0 · Beta</Badge>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [log, setLog] = useState(SAMPLE_LOG);
  const [scenes, setScenes] = useState<VisualNovelScene[]>(fallbackScenes);
  const [jsonText, setJsonText] = useState(stringifyScenes(fallbackScenes));
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [typingEnabled, setTypingEnabled] = useState(true);
  const [typingSpeedMode, setTypingSpeedMode] = useState<TypingSpeedMode>("normal");
  const [playerFontId, setPlayerFontId] = useState(DEFAULT_PLAYER_FONT_ID);
  const [typingComplete, setTypingComplete] = useState(false);
  const [revealToken, setRevealToken] = useState(0);
  const [typingResetToken, setTypingResetToken] = useState(0);
  const [textPageIndex, setTextPageIndex] = useState(0);
  const [assets, setAssets] = useState<AssetLibrary>(EMPTY_ASSETS);
  const [assetStoreReady, setAssetStoreReady] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [undoScenes, setUndoScenes] = useState<VisualNovelScene[] | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeScene = scenes[current] ?? fallbackScenes[0];
  const activeTextPages = sceneDisplayMode(activeScene) === "choice" ? [""] : splitTextPages(activeScene.text);
  const activePageText = activeTextPages[Math.min(textPageIndex, activeTextPages.length - 1)] ?? activeTextPages[0] ?? "";
  const playerFont = getPlayerFontOption(playerFontId);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { log?: string; scenes?: unknown; current?: number; jsonOpen?: boolean; typingEnabled?: boolean; typingSpeedMode?: TypingSpeedMode; playerFontId?: string };
        if (typeof parsed.log === "string") setLog(parsed.log);
        if (isSceneArray(parsed.scenes)) {
          const normalized = normalizeScenes(parsed.scenes);
          setScenes(normalized);
          setJsonText(stringifyScenes(normalized));
        }
        if (typeof parsed.current === "number") setCurrent(Math.max(0, parsed.current));
        if (typeof parsed.jsonOpen === "boolean") setJsonOpen(parsed.jsonOpen);
        if (typeof parsed.typingEnabled === "boolean") setTypingEnabled(parsed.typingEnabled);
        if (parsed.typingSpeedMode) {
          const nextMode = parsed.typingSpeedMode === "instant" ? "instant" : "normal";
          setTypingSpeedMode(nextMode);
          setTypingEnabled(nextMode !== "instant");
        }
        if (typeof parsed.playerFontId === "string" && PLAYER_FONT_OPTIONS.some((option) => option.id === parsed.playerFontId)) setPlayerFontId(parsed.playerFontId);
      }
    } catch {
      localStorage.removeItem(STATE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({ log, scenes, current, jsonOpen, typingEnabled, typingSpeedMode, playerFontId }));
    } catch {
      setError("브라우저 저장 공간이 부족해 진행 상태를 저장하지 못했습니다.");
    }
  }, [log, scenes, current, jsonOpen, typingEnabled, typingSpeedMode, playerFontId]);

  useEffect(() => {
    let cancelled = false;
    readAssetStore()
      .then((storedAssets) => {
        if (cancelled) return;
        if (storedAssets) {
          setAssets(storedAssets);
          return;
        }
        const legacyAssets = localStorage.getItem(ASSET_KEY);
        if (legacyAssets) {
          const migrated = sanitizeAssets(JSON.parse(legacyAssets));
          setAssets(migrated);
          writeAssetStore(migrated)
            .then(() => localStorage.removeItem(ASSET_KEY))
            .catch(() => undefined);
        }
      })
      .catch(() => {
        try {
          const legacyAssets = localStorage.getItem(ASSET_KEY);
          if (legacyAssets && !cancelled) setAssets(sanitizeAssets(JSON.parse(legacyAssets)));
        } catch {
          localStorage.removeItem(ASSET_KEY);
        }
      })
      .finally(() => {
        if (!cancelled) setAssetStoreReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!assetStoreReady) return;
    writeAssetStore(assets)
      .then(() => localStorage.removeItem(ASSET_KEY))
      .catch(() => {
        setError("에셋 저장 공간이 부족합니다. 큰 이미지를 삭제하거나 더 작은 파일로 등록해 주세요.");
      });
  }, [assetStoreReady, assets]);

  useEffect(() => {
    const pruned = pruneSceneAssetRefs(scenes, assets);
    if (JSON.stringify(pruned) !== JSON.stringify(scenes)) {
      setScenes(pruned);
      setJsonText(stringifyScenes(pruned));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  useEffect(() => {
    setTypingComplete(!typingEnabled || sceneDisplayMode(activeScene) === "choice");
    setRevealToken(0);
  }, [activeScene.id, typingEnabled, activeScene, textPageIndex]);

  useEffect(() => {
    setTextPageIndex(0);
  }, [activeScene.id]);

  useEffect(() => {
    if (!autoPlay || !typingComplete) return;
    if (current >= scenes.length - 1 && textPageIndex >= activeTextPages.length - 1) {
      setAutoPlay(false);
      return;
    }
    const timer = window.setTimeout(() => handleAdvance(), AUTO_PLAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, typingComplete, current, scenes.length, textPageIndex, activeTextPages.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        handleAdvance();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scenes.length, typingComplete, typingEnabled]);

  useEffect(() => {
    const asset = activeScene.bgmAssetId ? assets.bgmAssets.find((item) => item.id === activeScene.bgmAssetId) : undefined;
    if (!audioRef.current) return;
    audioRef.current.pause();
    if (!asset) {
      audioRef.current.removeAttribute("src");
      setBgmEnabled(false);
      return;
    }
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
    const next = mergeSceneAssetLinks(messagesToScenes(parsed), scenes);
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

  function applyBackgroundBulk(backgroundAssetId: string | undefined, mode: "all" | "empty") {
    const next = scenes.map((scene) => {
      if (mode === "empty" && scene.backgroundAssetId) return scene;
      return { ...scene, backgroundAssetId };
    });
    setScenesAndJson(next);
    setError(mode === "all" ? "모든 장면에 배경을 적용했습니다." : "배경이 비어 있는 장면에만 적용했습니다.");
  }

  function applyBgmBulk(bgmAssetId: string | undefined, mode: "all" | "empty") {
    const next = scenes.map((scene) => {
      if (mode === "empty" && scene.bgmAssetId) return scene;
      return { ...scene, bgmAssetId };
    });
    setScenesAndJson(next);
    setError(mode === "all" ? "모든 장면에 BGM을 적용했습니다." : "BGM이 비어 있는 장면에만 적용했습니다.");
  }

  function commitToolCandidate(candidate: ToolCandidate) {
    setUndoScenes(scenes);
    const next = replaceSelectedScenes(scenes, candidate);
    setScenesAndJson(next);
    const firstIndex = candidate.selection.sceneIndexes[0] ?? current;
    setCurrent(Math.min(firstIndex, Math.max(next.length - 1, 0)));
    setTypingResetToken((value) => value + 1);
    setError(`${candidate.title} candidate를 선택 영역에 적용했습니다.`);
  }

  function undoToolApply() {
    if (!undoScenes) return;
    setScenesAndJson(undoScenes);
    setUndoScenes(null);
    setTypingResetToken((value) => value + 1);
    setError("마지막 Apply를 되돌렸습니다.");
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
      displayMode: "narration",
      speaker: undefined,
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
    audioRef.current.src = asset.dataUrl;
    audioRef.current.play().then(() => setBgmEnabled(true)).catch(() => setError("브라우저 정책상 BGM 버튼을 한 번 더 눌러 재생해 주세요."));
  }

  function handleAdvance() {
    if (sceneDisplayMode(activeScene) === "choice") return;
    if (typingEnabled && !typingComplete) {
      setRevealToken((value) => value + 1);
      setTypingComplete(true);
      return;
    }
    if (textPageIndex < activeTextPages.length - 1) {
      setTextPageIndex((value) => value + 1);
      setTypingResetToken((value) => value + 1);
      return;
    }
    const nextById = activeScene.nextSceneId ? scenes.findIndex((scene) => scene.id === activeScene.nextSceneId) : -1;
    setCurrent((value) => (nextById >= 0 ? nextById : Math.min(scenes.length - 1, value + 1)));
  }

  function jumpToScene(index: number) {
    setCurrent(Math.min(Math.max(index, 0), Math.max(scenes.length - 1, 0)));
    setAutoPlay(false);
    setTypingComplete(!typingEnabled);
    setRevealToken(0);
    setTextPageIndex(0);
    setTypingResetToken((value) => value + 1);
  }

  function chooseBranch(targetSceneId?: string) {
    const targetIndex = targetSceneId ? scenes.findIndex((scene) => scene.id === targetSceneId) : -1;
    if (targetIndex >= 0) {
      jumpToScene(targetIndex);
      return;
    }
    jumpToScene(Math.min(current + 1, Math.max(scenes.length - 1, 0)));
  }

  function handleTypingComplete() {
    setTypingComplete(true);
  }

  function updateTypingSpeed(mode: TypingSpeedMode) {
    setTypingSpeedMode(mode);
    setTypingEnabled(mode !== "instant");
  }

  function toggleTyping() {
    setTypingEnabled((value) => {
      const next = !value;
      if (next && typingSpeedMode === "instant") setTypingSpeedMode("normal");
      if (!next) setTypingSpeedMode("instant");
      return next;
    });
  }

  function resetProgress() {
    localStorage.removeItem(STATE_KEY);
    setCurrent(0);
    setAutoPlay(false);
    setError("이어보기 위치를 초기화했습니다. 등록 에셋은 유지됩니다.");
  }

  return (
    <div className="als-root min-h-screen bg-slate-50">
      <FontStyles />
      <audio ref={audioRef} loop />
      <Toolbar
        onSample={loadSample}
        onConvert={convertLog}
        onExport={() => downloadStandaloneHtml(scenes, assets, { fontId: playerFont.id })}
        onToggleJson={() => setJsonOpen((value) => !value)}
        jsonOpen={jsonOpen}
      />
      <CompactHero
        onConvert={convertLog}
        onSample={loadSample}
        onExport={() => downloadStandaloneHtml(scenes, assets, { fontId: playerFont.id })}
      />
      <LargeVNPreviewSection
        scene={activeScene}
        scenes={scenes}
        assets={assets}
        current={current}
        total={scenes.length}
        autoPlay={autoPlay}
        typingEnabled={typingEnabled}
        typingSpeed={TYPING_SPEEDS[typingSpeedMode]}
        typingComplete={typingComplete}
        revealToken={revealToken}
        typingResetToken={typingResetToken}
        pageText={activePageText}
        textPageIndex={textPageIndex}
        textPageTotal={activeTextPages.length}
        playerFontFamily={playerFont.cssFamily}
        onNext={handleAdvance}
        onJumpScene={jumpToScene}
        onChoose={chooseBranch}
        onToggleAuto={() => setAutoPlay((value) => !value)}
        bgmEnabled={bgmEnabled}
        onToggleBgm={toggleBgm}
        onToggleTyping={toggleTyping}
        typingSpeedMode={typingSpeedMode}
        onTypingSpeedChange={updateTypingSpeed}
        onTypingComplete={handleTypingComplete}
      />
      <section id="workspace" className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[420px_1fr] lg:items-start">
          <LogInputCard log={log} onLogChange={setLog} onConvert={convertLog} error={error} />
          <div className="space-y-6 [&>section]:mx-0 [&>section]:max-w-none [&>section]:px-0 [&>section]:py-0">
            <AssetManager assets={assets} onAssetsChange={setAssets} onError={setError} />
            <SceneAccordion
              scenes={scenes}
              assets={assets}
              current={current}
              fileInputRef={fileInputRef}
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
              onApplyBackgroundBulk={applyBackgroundBulk}
              onApplyBgmBulk={applyBgmBulk}
              onCommitCandidate={commitToolCandidate}
              canUndo={Boolean(undoScenes)}
              onUndo={undoToolApply}
            />
            <JsonEditor open={jsonOpen} jsonText={jsonText} error={jsonError} onChange={applyJsonText} />
            <ExportCard
              scenes={scenes}
              assets={assets}
              playerFontId={playerFont.id}
              onPlayerFontChange={setPlayerFontId}
              onExportJson={exportJson}
              onExportHtml={() => downloadStandaloneHtml(scenes, assets, { fontId: playerFont.id })}
              onResetProgress={resetProgress}
            />
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
