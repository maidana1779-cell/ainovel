import type { AssetLibrary } from "../types";
import type { VisualNovelScene } from "../parser/types";
import { getPlayerFontOption } from "../playerFonts";

export type StandaloneHtmlOptions = {
  fontId?: string;
  typingEnabled?: boolean;
  bgmEnabled?: boolean;
  includeFonts?: boolean;
  includeAssets?: boolean;
  fullscreen?: boolean;
};

const FALLBACK_BACKGROUNDS: Record<string, string> = {
  observatory: "linear-gradient(135deg,#334155 0%,#312e81 52%,#581c87 100%)",
  alley: "linear-gradient(135deg,#1e1b4b 0%,#581c87 52%,#0f172a 100%)",
  cafe: "linear-gradient(135deg,#9a3412 0%,#78350f 52%,#1c1917 100%)",
  classroom: "linear-gradient(135deg,#0369a1 0%,#1e3a8a 52%,#0f172a 100%)",
  archive: "linear-gradient(135deg,#065f46 0%,#134e4a 52%,#0f172a 100%)",
  cloud: "linear-gradient(135deg,#0e7490 0%,#0c4a6e 52%,#312e81 100%)"
};

const EMPTY_ASSETS: AssetLibrary = {
  standingAssets: [],
  backgroundAssets: [],
  bgmAssets: []
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildStandaloneHtml(scenes: VisualNovelScene[], assets: AssetLibrary = EMPTY_ASSETS, options: StandaloneHtmlOptions = {}) {
  const safeScenes = JSON.stringify(scenes).replace(/</g, "\\u003c");
  const exportAssets = options.includeAssets === false ? EMPTY_ASSETS : assets;
  const safeAssets = JSON.stringify(exportAssets).replace(/</g, "\\u003c");
  const safeFallbacks = JSON.stringify(FALLBACK_BACKGROUNDS).replace(/</g, "\\u003c");
  const playerFont = getPlayerFontOption(options.includeFonts === false ? "system-sans" : options.fontId);
  const googleFontHref = options.includeFonts === false ? "" : playerFont.googleFont ? `https://fonts.googleapis.com/css2?family=${playerFont.googleFont}&display=swap` : "";
  const stageSize = "width: min(1600px, 100vw, calc(100dvh * 16 / 9)); aspect-ratio: 16 / 9;";
  const initialTyping = options.typingEnabled === false ? "false" : "true";
  const allowBgm = options.bgmEnabled === false ? "false" : "true";
  const startFullscreen = options.fullscreen ? "true" : "false";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Exported Visual Novel</title>
  ${googleFontHref ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${googleFontHref}" rel="stylesheet" />` : ""}
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; }
    body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; overflow: hidden; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #f8fafc; background: #0f172a; touch-action: manipulation; }
    .stage { --vn-font-family: ${playerFont.cssFamily}; ${stageSize} position: relative; max-width: 100vw; max-height: 100dvh; overflow: hidden; isolation: isolate; cursor: pointer; }
    .orientation-hint { position: fixed; left: 50%; bottom: 14px; z-index: 40; display: none; transform: translateX(-50%); border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(15,23,42,.72); padding: 8px 12px; color: rgba(248,250,252,.78); font-size: 12px; font-weight: 700; backdrop-filter: blur(10px); pointer-events: none; }
    .bg { position: absolute; inset: 0; background-size: cover; background-position: center; transition: background 240ms ease; z-index: -3; }
    .shade { position: absolute; inset: 0; background: radial-gradient(circle at 26% 18%, rgba(255,255,255,.2), transparent 26%), linear-gradient(to top, rgba(2,6,23,.72), transparent 58%); z-index: -2; }
    .characters { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
    .cg-layer { position: absolute; inset: 0; z-index: 4; display: none; pointer-events: none; background: rgba(0,0,0,.2); }
    .cg-layer.open { display: block; }
    .cg-layer.fade { animation: cgfade .45s ease-out 1; }
    .cg-layer img { width: 100%; height: 100%; object-fit: contain; object-position: center; display: block; background: #000; }
    .character { position: absolute; bottom: 0; height: 80%; width: var(--character-width, 36%); object-fit: contain; object-position: bottom center; transition: filter .3s ease, opacity .3s ease, transform .3s ease; transform: translate(calc(-50% + var(--char-x, 0%)), var(--char-y, 0%)) scaleX(calc(var(--char-scale, 1.02) * var(--char-flip, 1))) scaleY(var(--char-scale, 1.02)); filter: brightness(1); opacity: 1; z-index: 3; }
    .character[data-speaking="false"] { opacity: .7; filter: brightness(.6) blur(1px); z-index: 2; }
    .fallback-character { width: min(24%, 260px); height: 62%; aspect-ratio: .72; border-radius: 999px 999px 18px 18px; background: linear-gradient(180deg, rgba(255,255,255,.58), rgba(255,255,255,.16)); border: 1px solid rgba(255,255,255,.34); display: grid; place-items: start center; padding-top: 42px; box-shadow: 0 24px 80px rgba(0,0,0,.28); }
    .face { width: 54px; height: 54px; border-radius: 999px; background: #fed7aa; box-shadow: inset 0 -8px 18px rgba(15,23,42,.12); }
    .panel { position: absolute; left: 50%; bottom: 32px; z-index: 5; display: flex; align-items: center; width: 88%; max-width: 1320px; height: 156px; padding: 24px 56px; transform: translateX(-50%); box-sizing: border-box; color: #f4f0e6; background: rgba(10,13,18,.84); border-top: 1px solid rgba(255,255,255,.06); box-shadow: 0 -18px 60px rgba(0,0,0,.22); }
    .panel.choice, .panel.hidden { display: none; }
    .panel.dialogue, .panel.system, .panel.code, .panel.narration, .panel.cg { text-align: left; }
    .meta { position: absolute; left: 0; top: -24px; }
    .speaker { display: inline-block; margin-left: 26px; border-radius: 0 6px 0 0; background: #0f141c; color: #f2eee2; padding: 5px 18px; font-size: 13px; font-weight: 500; letter-spacing: .3px; }
    .pill, .counter { border-radius: 999px; padding: 6px 10px; background: rgba(255,255,255,.12); color: #dbeafe; font-size: 13px; font-weight: 800; }
    .narration-dot { position: absolute; left: 18px; top: 18px; width: 6px; height: 6px; border-radius: 999px; background: rgba(255,255,255,.35); }
    .text { flex: 1; max-width: 1160px; min-height: 0; max-height: 100%; white-space: pre-wrap; word-break: keep-all; overflow: hidden; padding-left: 48px; padding-right: 48px; font-family: var(--vn-font-family); font-size: 17px; line-height: 1.85; color: #f4f0e6; }
    .text.narration { display: block; max-width: 1160px; width: auto; text-align: left; font-family: var(--vn-font-family); font-style: italic; font-size: 17px; line-height: 1.85; color: #f4f0e6; }
    .continue { margin-left: auto; color: #f4f0e6; font-size: 18px; opacity: 0; }
    .continue.visible { animation: vnbounce 1.6s ease-in-out infinite; }
    pre.text { margin: 0; border-radius: 12px; padding: 12px; background: rgba(0,0,0,.45); color: #d9f99d; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
    .choice-overlay { position: absolute; left: 0; right: 0; bottom: 18%; z-index: 7; display: none; justify-content: center; padding: 0 72px; font-family: var(--vn-font-family); }
    .choice-overlay.open { display: flex; }
    .choice-box { width: 72%; max-width: 920px; }
    .choice-prompt { margin: 0 0 16px; text-align: center; color: #f4f0e6; font-size: 18px; font-weight: 600; letter-spacing: .04em; text-shadow: 0 2px 10px rgba(0,0,0,.65); }
    .choice-list { display: grid; gap: 12px; border-top: 1px solid rgba(255,255,255,.2); border-bottom: 1px solid rgba(255,255,255,.2); padding: 20px 0; background: rgba(0,0,0,.2); backdrop-filter: blur(2px); }
    .choice-option { display: block; width: 100%; min-height: auto; border: 1px solid rgba(255,255,255,.2); border-radius: 0; padding: 13px 32px; background: rgba(8,10,16,.54); box-shadow: 0 18px 50px rgba(0,0,0,.22); color: #f4f0e6; text-align: left; font-family: var(--vn-font-family); font-size: 18px; font-weight: 500; letter-spacing: .02em; transition: transform .2s ease, border-color .2s ease, background .2s ease, color .2s ease; }
    .choice-option:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.45); background: rgba(255,255,255,.12); color: white; }
    .choice-number { margin-right: 16px; color: rgba(255,255,255,.45); }
    .stage.shake { animation: vnshake .42s ease-in-out 1; }
    .fx-layer { position:absolute; inset:0; z-index:19; pointer-events:none; opacity:0; }
    .fx-layer.flash { background:white; animation: vnflash .24s ease-out 1; }
    .fx-layer.fade-in { background:black; animation: vnfadein .7s ease-out 1; }
    .fx-layer.fade-out { background:black; animation: vnfadeout .7s ease-out 1; }
    button { min-height: 44px; border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 800; cursor: pointer; color: #111827; background: rgba(248,250,252,.9); box-shadow: 0 12px 30px rgba(0,0,0,.18); }
    .side-menu { position: absolute; right: 18px; top: 20px; z-index: 8; display: flex; flex-direction: column; align-items: center; gap: 18px; }
    .side-menu button { min-height: auto; padding: 0; color: rgba(232,228,216,.8); background: transparent; border: 0; box-shadow: none; font-size: 9px; font-weight: 600; }
    .side-menu .icon { display:block; font-size:17px; line-height:1; }
    .side-menu button[aria-pressed="true"] { color: white; background: transparent; }
    .side-menu button:disabled { pointer-events: none; }
    .log-overlay { position: absolute; inset: 0; z-index: 20; display: none; background: rgba(0,0,0,.45); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); cursor: default; padding: 8vh 4vw; }
    .log-overlay.open { display: flex; }
    .log-panel { width: 100%; max-width: 1040px; margin: 0 auto 0 6%; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.08) transparent; cursor: auto; mask-image: linear-gradient(to bottom, transparent 0, black 32px, black calc(100% - 32px), transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 32px, black calc(100% - 32px), transparent 100%); }
    .log-panel::-webkit-scrollbar { width: 2px; }
    .log-panel::-webkit-scrollbar-track { background: transparent; }
    .log-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 999px; }
    .log-head { display: none; }
    .log-list { display: grid; gap: 46px; }
    .log-item { position: relative; display: block; width: 100%; min-height: auto; border: 0; border-radius: 0; background: transparent; box-shadow: none; padding: 0 0 0 22px; text-align: left; color: inherit; cursor: pointer; transition: opacity .18s ease; }
    .log-item:hover { opacity: .9; }
    .log-item.current::before { content: ""; position: absolute; left: 0; top: 4px; width: 3px; height: 3px; border-radius: 999px; background: #ab9bf2; box-shadow: 0 0 5px 1px rgba(171,155,242,.7); }
    .log-speaker { display: block; margin: 0 0 12px; color: rgba(180,174,206,.42); font-size: 11px; font-weight: 400; letter-spacing: .2em; }
    .log-text { margin: 0; white-space: pre-wrap; word-break: keep-all; font-family: var(--vn-font-family); font-size: 19px; font-weight: 400; line-height: 2; letter-spacing: .01em; color: rgba(235,233,244,.94); text-shadow: 0 1px 6px rgba(0,0,0,.35); }
    .log-text.narration { font-size: 16.5px; font-style: italic; color: rgba(196,190,216,.48); }
    .log-text.code { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 14.5px; color: rgba(200,194,224,.55); word-break: break-word; }
    @media (max-width: 900px) { .log-panel { margin: 0 auto; max-width: 640px; } }
    @media (max-width: 640px) {
      .panel { bottom: 22px; width: 88%; height: 128px; padding: 18px 22px; }
      .speaker { margin-left: 18px; font-size: 12px; padding: 4px 14px; }
      .text { padding-left: 12px; padding-right: 20px; font-size: 14px; line-height: 1.75; }
      .continue { font-size: 15px; }
      .choice-overlay { bottom: 16%; padding: 0 24px; }
      .choice-box { width: 100%; }
      .choice-prompt { font-size: 15px; }
      .choice-option { padding: 11px 16px; font-size: 15px; }
      .side-menu { right: 10px; top: 14px; gap: 10px; }
      .side-menu .icon { font-size: 14px; }
      .side-menu button { font-size: 8px; }
      .fallback-character { width: 30%; height: 58%; padding-top: 28px; }
      .face { width: 42px; height: 42px; }
      .log-overlay { padding: 7vh 7vw; }
      .log-text { font-size: 17px; }
      .log-text.narration { font-size: 15px; }
    }
    @media (orientation: portrait) and (max-width: 900px) { .orientation-hint { display: block; } }
    @keyframes vnbounce { 0%,100% { opacity:.35; transform:translateY(0); } 50% { opacity:.9; transform:translateY(3px); } }
    @keyframes vnshake { 0%,100% { transform:translate(0,0); } 20% { transform:translate(-6px,3px); } 40% { transform:translate(5px,-2px); } 60% { transform:translate(-3px,-3px); } 80% { transform:translate(4px,2px); } }
    @keyframes vnflash { 0% { opacity:0; } 14% { opacity:.86; } 100% { opacity:0; } }
    @keyframes vnfadein { from { opacity:.55; } to { opacity:0; } }
    @keyframes vnfadeout { from { opacity:0; } to { opacity:.55; } }
    @keyframes cgfade { from { opacity:0; } to { opacity:1; } }
    button:disabled { opacity: .45; cursor: not-allowed; }
  </style>
</head>
<body>
  <main class="stage">
    <div id="bg" class="bg"></div>
    <div class="shade"></div>
    <div id="characters" class="characters" aria-hidden="true"></div>
    <div id="cgLayer" class="cg-layer" aria-hidden="true"></div>
    <div class="side-menu">
      <button id="logButton" type="button" aria-pressed="false"><span class="icon">L</span>Log</button>
      <button id="sideBgm" type="button" aria-pressed="false"><span class="icon">B</span>BGM</button>
      <button type="button" disabled><span class="icon">&gt;</span>Skip</button>
      <button id="sideAuto" type="button" aria-pressed="false"><span class="icon">A</span>Auto</button>
      <button type="button" disabled><span class="icon">M</span>Menu</button>
    </div>
    <section id="panel" class="panel dialogue" aria-live="polite">
      <span id="narrationDot" class="narration-dot" hidden></span>
      <div id="meta" class="meta">
        <div id="speaker" class="speaker"></div>
      </div>
      <div id="text" class="text"></div>
      <div id="continue" class="continue">▼</div>
    </section>
    <section id="choiceOverlay" class="choice-overlay" aria-live="polite">
      <div class="choice-box">
        <p id="choicePrompt" class="choice-prompt"></p>
        <div id="choiceList" class="choice-list"></div>
      </div>
    </section>
    <div id="fxLayer" class="fx-layer"></div>
    <div id="logOverlay" class="log-overlay" aria-hidden="true">
      <div id="logPanel" class="log-panel">
        <div class="log-head">
          <div>
            <h2 class="log-title">LOG</h2>
            <p class="log-subtitle">현재 장면까지의 기록</p>
          </div>
          <button id="logClose" class="log-close" type="button">Close</button>
        </div>
        <div id="logList" class="log-list"></div>
      </div>
    </div>
  </main>
  <div class="orientation-hint">가로 화면에서 더 편하게 볼 수 있습니다</div>
  <audio id="audio"></audio>
  <iframe id="youtubeBgm" title="YouTube BGM player" allow="autoplay; encrypted-media" style="display:none"></iframe>
  <script>
    const scenes = ${safeScenes};
    const assets = ${safeAssets};
    const fallbacks = ${safeFallbacks};
    const STORAGE_KEY = "exported-chatlog-vn-progress";
    const AUTO_PLAY_MS = 3200;
    const START_FULLSCREEN = ${startFullscreen};
    const signature = scenes.length + ":" + scenes.map((scene) => (scene.displayMode || "") + ":" + (scene.speaker || "") + ":" + scene.text.length).join("|");
    let index = 0;
    let autoPlay = false;
    let bgmEnabled = false;
    let typingEnabled = ${initialTyping};
    let typingComplete = false;
    let textPageIndex = 0;
    let textPages = [""];
    let typingTimer = null;
    let timer = null;
    const bg = document.getElementById("bg");
    const stage = document.querySelector(".stage");
    const characters = document.getElementById("characters");
    const cgLayer = document.getElementById("cgLayer");
    const panel = document.getElementById("panel");
    const meta = document.getElementById("meta");
    const speaker = document.getElementById("speaker");
    let text = document.getElementById("text");
    const narrationDot = document.getElementById("narrationDot");
    const continueMark = document.getElementById("continue");
    const logButton = document.getElementById("logButton");
    const logOverlay = document.getElementById("logOverlay");
    const logPanel = document.getElementById("logPanel");
    const logClose = document.getElementById("logClose");
    const logList = document.getElementById("logList");
    const choiceOverlay = document.getElementById("choiceOverlay");
    const choicePrompt = document.getElementById("choicePrompt");
    const choiceList = document.getElementById("choiceList");
    const fxLayer = document.getElementById("fxLayer");
    const sideBgm = document.getElementById("sideBgm");
    const sideAuto = document.getElementById("sideAuto");
    const audio = document.getElementById("audio");
    const youtubeBgm = document.getElementById("youtubeBgm");
    let logOpen = false;

    const standingById = Object.fromEntries(assets.standingAssets.map((asset) => [asset.id, asset]));
    const backgroundById = Object.fromEntries(assets.backgroundAssets.map((asset) => [asset.id, asset]));
    const bgmById = ${allowBgm} ? Object.fromEntries(assets.bgmAssets.map((asset) => [asset.id, asset])) : {};

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.signature === signature && typeof saved.index === "number") {
        index = Math.min(Math.max(saved.index, 0), Math.max(scenes.length - 1, 0));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    function saveProgress() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ signature, index }));
    }

    function modeOf(scene) {
      if (scene.displayMode) return scene.displayMode;
      if (scene.type === "code" || scene.emotion === "code") return "code";
      if (scene.role === "narration") return "narration";
      if (scene.role === "system") return "system";
      return "dialogue";
    }

    function isYoutubeBgm(asset) {
      return Boolean(asset && (asset.source === "youtube" || asset.youtubeVideoId));
    }

    function youtubeEmbedUrl(videoId) {
      const params = new URLSearchParams({
        autoplay: "1",
        loop: "1",
        playlist: videoId,
        controls: "0",
        modestbranding: "1",
        rel: "0",
        playsinline: "1"
      });
      return "https://www.youtube.com/embed/" + videoId + "?" + params.toString();
    }

    function sceneShowsDialogue(scene) {
      return modeOf(scene) !== "cg" || (scene.showDialogue !== false && String(scene.text || "").trim().length > 0);
    }

    function normalizeCharacterName(value) {
      return String(value || "").trim().replace(/\\.[^.]+$/, "").toLowerCase();
    }

    function sceneCharacters(scene) {
      const mode = modeOf(scene);
      if (mode !== "dialogue") return [];
      const rank = { left: 0, center: 1, right: 2 };
      const list = Array.isArray(scene.characters) ? [...scene.characters] : [];
      if (modeOf(scene) === "dialogue" && scene.speaker && list.length === 0) {
        list.push({ assetId: "", name: scene.speaker, position: "center", isSpeaking: true });
      }
      return list.sort((a, b) => (rank[a.position] ?? 1) - (rank[b.position] ?? 1));
    }

    function standingAssetForCharacter(character, scene) {
      const explicit = character.assetId ? standingById[character.assetId] : null;
      if (explicit) return explicit;
      const characterName = normalizeCharacterName(character.name);
      const speakerName = normalizeCharacterName(scene.speaker);
      return assets.standingAssets.find((asset) => {
        const assetName = normalizeCharacterName(asset.name);
        return assetName === characterName || assetName === speakerName;
      });
    }

    function characterLeftPercent(position) {
      if (position === "left") return 25;
      if (position === "right") return 75;
      return 50;
    }

    function characterWidthPercent(total) {
      if (total <= 1) return "46%";
      if (total === 2) return "36%";
      return "28%";
    }

    function splitTextPages(value, limit = 145) {
      const source = String(value || "").trim();
      if (!source) return [""];
      const chars = Array.from(source);
      const pages = [];
      let start = 0;
      while (start < chars.length) {
        if (chars.length - start <= limit) {
          pages.push(chars.slice(start).join("").trim());
          break;
        }
        const end = Math.min(chars.length, start + limit);
        const windowChars = chars.slice(start, end);
        let cut = -1;
        for (let i = windowChars.length - 1; i >= Math.max(0, windowChars.length - 48); i -= 1) {
          if (/[.!?。！？…\\n]/.test(windowChars[i])) { cut = i + 1; break; }
        }
        if (cut < Math.floor(limit * .55)) {
          for (let i = windowChars.length - 1; i >= Math.max(0, windowChars.length - 32); i -= 1) {
            if (/\\s/.test(windowChars[i])) { cut = i + 1; break; }
          }
        }
        if (cut <= 0) cut = windowChars.length;
        pages.push(chars.slice(start, start + cut).join("").trim());
        start += cut;
        while (chars[start] && /\\s/.test(chars[start])) start += 1;
      }
      return pages.filter(Boolean).length ? pages.filter(Boolean) : [source];
    }

    function sceneEffects(scene) {
      return Array.isArray(scene.effects) ? scene.effects : [];
    }

    function sceneTypingSpeed(scene) {
      const effect = sceneEffects(scene).find((item) => item.type === "textSpeed");
      if (!effect) return 50;
      if (effect.value === "slow") return 70;
      if (effect.value === "fast") return 28;
      return 50;
    }

    function scenePause(scene, position) {
      return sceneEffects(scene)
        .filter((effect) => effect.type === "pause" && effect.position === position)
        .reduce((total, effect) => total + (effect.durationMs || 0), 0);
    }

    function runVisualEffects(scene) {
      stage.classList.toggle("shake", sceneEffects(scene).some((effect) => effect.type === "screenShake"));
      fxLayer.className = "fx-layer";
      const effect = sceneEffects(scene).find((item) => item.type === "flash" || item.type === "fadeIn" || item.type === "fadeOut");
      if (!effect) return;
      window.requestAnimationFrame(() => {
        fxLayer.classList.add(effect.type === "flash" ? "flash" : effect.type === "fadeIn" ? "fade-in" : "fade-out");
      });
    }

    function syncBgmSource(scene) {
      const asset = scene.bgmAssetId ? bgmById[scene.bgmAssetId] : null;
      if (!asset) {
        audio.pause();
        audio.removeAttribute("src");
        delete audio.dataset.bgmId;
        bgmEnabled = false;
        sideBgm.setAttribute("aria-pressed", "false");
        return;
      }
      if (audio.dataset.bgmId !== asset.id) {
        audio.pause();
        audio.src = asset.dataUrl;
        audio.dataset.bgmId = asset.id;
      }
      if (bgmEnabled && audio.paused) {
        audio.play().catch((error) => {
          console.error("BGM play() failed", error);
          bgmEnabled = false;
          sideBgm.setAttribute("aria-pressed", "false");
        });
      }
    }

    function renderLogOverlay() {
      logList.innerHTML = "";
      scenes.slice(0, index + 1).forEach((scene, sceneIndex) => {
        const mode = modeOf(scene);
        const item = document.createElement("button");
        item.type = "button";
        item.className = "log-item" + (sceneIndex === index ? " current" : "");
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          jumpToScene(sceneIndex);
          setLogOpen(false);
        });
        if (mode !== "narration" && scene.speaker) {
          const speakerNode = document.createElement("p");
          speakerNode.className = "log-speaker";
          speakerNode.textContent = scene.speaker;
          item.appendChild(speakerNode);
        }
        const textNode = document.createElement("p");
        textNode.className = "log-text" + (mode === "narration" ? " narration" : mode === "code" ? " code" : "");
        textNode.textContent = scene.text || "";
        item.appendChild(textNode);
        logList.appendChild(item);
      });
    }

    function setLogOpen(nextValue) {
      logOpen = nextValue;
      logOverlay.classList.toggle("open", logOpen);
      logOverlay.setAttribute("aria-hidden", String(!logOpen));
      logButton.setAttribute("aria-pressed", String(logOpen));
      if (logOpen) {
        renderLogOverlay();
        window.requestAnimationFrame(() => {
          logPanel.scrollTop = logPanel.scrollHeight;
        });
      }
    }

    function sceneIndexById(sceneId) {
      return scenes.findIndex((scene) => scene && scene.id === sceneId);
    }

    function chooseOption(targetSceneId) {
      const targetIndex = targetSceneId ? sceneIndexById(targetSceneId) : -1;
      jumpToScene(targetIndex >= 0 ? targetIndex : Math.min(index + 1, Math.max(scenes.length - 1, 0)));
    }

    function renderChoices(scene, mode) {
      const options = Array.isArray(scene.choices) ? scene.choices : [];
      choiceList.innerHTML = "";
      choicePrompt.textContent = scene.text || "";
      choiceOverlay.classList.toggle("open", mode === "choice" && options.length > 0);
      if (mode !== "choice") return;
      options.forEach((option, optionIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-option";
        const number = document.createElement("span");
        number.className = "choice-number";
        number.textContent = String(optionIndex + 1).padStart(2, "0");
        button.appendChild(number);
        button.appendChild(document.createTextNode(option.text || ""));
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          chooseOption(option.targetSceneId);
        });
        choiceList.appendChild(button);
      });
    }

    function renderCg(scene, mode) {
      cgLayer.innerHTML = "";
      cgLayer.className = "cg-layer";
      if (mode !== "cg" || !scene.imageAsset) return;
      const transform = Object.assign({ scale: 1, x: 0, y: 0, fit: "contain" }, scene.cgTransform || {});
      const image = document.createElement("img");
      image.src = scene.imageAsset;
      image.alt = scene.imageFileName || "CG Scene";
      image.style.objectFit = transform.fit === "cover" ? "cover" : "contain";
      image.style.transform = "translate(" + Number(transform.x || 0) + "%, " + Number(transform.y || 0) + "%) scale(" + Number(transform.scale || 1) + ")";
      cgLayer.appendChild(image);
      cgLayer.classList.add("open");
      if (scene.cgTransition !== "instant") cgLayer.classList.add("fade");
    }

    function syncBgmForScene(scene) {
      const asset = scene.bgmAssetId ? bgmById[scene.bgmAssetId] : null;
      if (!asset) {
        audio.pause();
        audio.removeAttribute("src");
        delete audio.dataset.bgmId;
        youtubeBgm.src = "about:blank";
        delete youtubeBgm.dataset.bgmId;
        bgmEnabled = false;
        sideBgm.setAttribute("aria-pressed", "false");
        return;
      }
      if (!bgmEnabled) return;
      if (isYoutubeBgm(asset)) {
        audio.pause();
        audio.removeAttribute("src");
        delete audio.dataset.bgmId;
        if (asset.youtubeVideoId && youtubeBgm.dataset.bgmId !== asset.id) {
          youtubeBgm.src = youtubeEmbedUrl(asset.youtubeVideoId);
          youtubeBgm.dataset.bgmId = asset.id;
        }
        return;
      }
      youtubeBgm.src = "about:blank";
      delete youtubeBgm.dataset.bgmId;
      if (asset.dataUrl && audio.dataset.bgmId !== asset.id) {
        audio.src = asset.dataUrl;
        audio.dataset.bgmId = asset.id;
        audio.play().catch((error) => {
          console.error("BGM play() failed", error);
          bgmEnabled = false;
          sideBgm.setAttribute("aria-pressed", "false");
        });
      }
    }

    function render() {
      if (typingTimer) window.clearTimeout(typingTimer);
      typingTimer = null;
      typingComplete = !typingEnabled;
      const scene = scenes[index] || { displayMode: "narration", text: "No scenes yet.", background: "observatory", emotion: "distant", characters: [] };
      const mode = modeOf(scene);
      syncBgmForScene(scene);
      textPages = mode === "choice" || !sceneShowsDialogue(scene) ? [""] : splitTextPages(scene.text || "");
      textPageIndex = Math.min(textPageIndex, Math.max(textPages.length - 1, 0));
      renderChoices(scene, mode);
      renderCg(scene, mode);
      runVisualEffects(scene);
      const bgAsset = scene.backgroundAssetId ? backgroundById[scene.backgroundAssetId] : null;
      bg.style.background = bgAsset ? "url('" + bgAsset.dataUrl + "') center / cover" : (fallbacks[scene.backgroundAsset || scene.background] || fallbacks.observatory);
      characters.innerHTML = "";
      const visibleCharacters = sceneCharacters(scene);
      visibleCharacters.forEach((character, characterIndex) => {
        const asset = standingAssetForCharacter(character, scene);
        const el = asset ? document.createElement("img") : document.createElement("div");
        el.className = asset ? "character" : "character fallback-character";
        el.style.left = characterLeftPercent(character.position) + "%";
        el.style.setProperty("--character-width", characterWidthPercent(visibleCharacters.length));
        const transform = Object.assign({ scale: 1, x: 0, y: 0, flipX: false }, (asset && asset.defaultTransform) || {}, character.characterTransform || {});
        const baseScale = character.isSpeaking ? 1.02 : 0.94;
        el.style.setProperty("--char-x", Number(transform.x || 0) + "%");
        el.style.setProperty("--char-y", Number(transform.y || 0) + "%");
        el.style.setProperty("--char-scale", String(baseScale * Number(transform.scale || 1)));
        el.style.setProperty("--char-flip", transform.flipX ? "-1" : "1");
        el.dataset.speaking = String(Boolean(character.isSpeaking));
        if (asset) {
          el.src = asset.dataUrl;
          el.alt = character.name;
        } else {
          el.innerHTML = '<div class="face"></div>';
        }
        characters.appendChild(el);
      });
      const showDialoguePanel = sceneShowsDialogue(scene);
      panel.className = "panel " + (showDialoguePanel ? mode : "hidden");
      const showMeta = showDialoguePanel && mode !== "narration" && mode !== "choice" && Boolean(scene.speaker);
      meta.hidden = !showMeta;
      narrationDot.hidden = true;
      speaker.textContent = showMeta ? (scene.speaker || "") : "";
      const replacement = document.createElement(mode === "code" ? "pre" : "div");
      replacement.className = "text " + mode;
      replacement.id = "text";
      text.replaceWith(replacement);
      text = replacement;
      if (mode === "choice" || !showDialoguePanel) {
        text.textContent = "";
        completeTyping();
      } else {
        typeText(textPages[textPageIndex] || "", scene);
      }
      sideAuto.setAttribute("aria-pressed", String(autoPlay));
      sideBgm.disabled = !scene.bgmAssetId || !bgmById[scene.bgmAssetId];
      sideBgm.setAttribute("aria-pressed", String(bgmEnabled));
      continueMark.classList.toggle("visible", typingComplete);
      syncBgmSource(scene);
      if (logOpen) {
        renderLogOverlay();
        window.requestAnimationFrame(() => {
          logPanel.scrollTop = logPanel.scrollHeight;
        });
      }
      saveProgress();
    }

    function typeText(value, scene) {
      const chars = Array.from(value);
      let cursor = 0;
      text.textContent = typingEnabled ? "" : value;
      if (!typingEnabled) {
        completeTyping();
        return;
      }
      function tick() {
        cursor += 1;
        text.textContent = chars.slice(0, cursor).join("");
        if (cursor >= chars.length) {
          completeTyping();
          return;
        }
        const currentChar = chars[Math.max(cursor - 1, 0)] || "";
        const delay = currentChar === "\\n" ? 220 : /[.,?!。…]/.test(currentChar) ? 180 : /\\s/.test(currentChar) ? 16 : sceneTypingSpeed(scene || {});
        typingTimer = window.setTimeout(tick, delay + (cursor === 1 ? scenePause(scene || {}, "beforeText") : 0));
      }
      tick();
    }

    function completeTyping() {
      typingComplete = true;
      continueMark.classList.add("visible");
      const scene = scenes[index] || {};
      if (autoPlay && modeOf(scene) !== "choice" && (textPageIndex < textPages.length - 1 || index < scenes.length - 1)) {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => handleAdvance(), AUTO_PLAY_MS + scenePause(scene, "afterText"));
      }
    }

    function revealText() {
      if (typingTimer) window.clearTimeout(typingTimer);
      typingTimer = null;
      const scene = scenes[index] || {};
      text.textContent = textPages[textPageIndex] || scene.text || "";
      completeTyping();
    }

    function move(delta) {
      if (timer) window.clearTimeout(timer);
      timer = null;
      const currentScene = scenes[index] || {};
      const targetById = delta > 0 && currentScene.nextSceneId ? sceneIndexById(currentScene.nextSceneId) : -1;
      index = targetById >= 0 ? targetById : Math.min(Math.max(index + delta, 0), Math.max(scenes.length - 1, 0));
      textPageIndex = 0;
      if (index >= scenes.length - 1 && delta > 0) setAutoPlay(false);
      render();
    }

    function jumpToScene(sceneIndex) {
      if (timer) window.clearTimeout(timer);
      timer = null;
      setAutoPlay(false);
      index = Math.min(Math.max(sceneIndex, 0), Math.max(scenes.length - 1, 0));
      textPageIndex = 0;
      render();
    }

    function handleAdvance() {
      if (logOpen) return;
      const scene = scenes[index] || {};
      if (modeOf(scene) === "choice") return;
      if (typingEnabled && !typingComplete) {
        revealText();
        return;
      }
      if (textPageIndex < textPages.length - 1) {
        textPageIndex += 1;
        render();
        return;
      }
      move(1);
    }

    function setAutoPlay(nextValue) {
      autoPlay = nextValue;
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (autoPlay && typingComplete && (textPageIndex < textPages.length - 1 || index < scenes.length - 1)) timer = window.setTimeout(() => handleAdvance(), AUTO_PLAY_MS);
      sideAuto.setAttribute("aria-pressed", String(autoPlay));
    }

    stage.addEventListener("click", () => {
      if (START_FULLSCREEN && !document.fullscreenElement) stage.requestFullscreen?.().catch(() => {});
      handleAdvance();
    });
    logButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setLogOpen(!logOpen);
    });
    logOverlay.addEventListener("click", (event) => {
      event.stopPropagation();
      setLogOpen(false);
    });
    logPanel.addEventListener("click", (event) => event.stopPropagation());
    logClose.addEventListener("click", (event) => {
      event.stopPropagation();
      setLogOpen(false);
    });
    sideAuto.addEventListener("click", (event) => {
      event.stopPropagation();
      setAutoPlay(!autoPlay);
    });
    sideBgm.addEventListener("click", (event) => {
      event.stopPropagation();
      const scene = scenes[index] || scenes[0] || {};
      const asset = scene.bgmAssetId ? bgmById[scene.bgmAssetId] : null;
      if (!asset) return;
      if (bgmEnabled) {
        audio.pause();
        youtubeBgm.src = "about:blank";
        bgmEnabled = false;
        sideBgm.setAttribute("aria-pressed", "false");
        return;
      }
      if (isYoutubeBgm(asset)) {
        audio.pause();
        audio.removeAttribute("src");
        if (!asset.youtubeVideoId) return;
        youtubeBgm.src = youtubeEmbedUrl(asset.youtubeVideoId);
        youtubeBgm.dataset.bgmId = asset.id;
        bgmEnabled = true;
        sideBgm.setAttribute("aria-pressed", "true");
        return;
      }
      if (audio.dataset.bgmId !== asset.id) {
        youtubeBgm.src = "about:blank";
        delete youtubeBgm.dataset.bgmId;
        if (!asset.dataUrl) return;
        audio.src = asset.dataUrl;
        audio.dataset.bgmId = asset.id;
      }
      audio.play()
        .then(() => {
          bgmEnabled = true;
          sideBgm.setAttribute("aria-pressed", "true");
        })
        .catch((error) => {
          console.error("BGM play() failed", error);
          bgmEnabled = false;
          sideBgm.setAttribute("aria-pressed", "false");
        });
    });
    window.addEventListener("keydown", (event) => {
      const tagName = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
      if (event.key === "Escape" && logOpen) { event.preventDefault(); setLogOpen(false); return; }
      if (event.key === " " || event.key === "Enter") { event.preventDefault(); handleAdvance(); }
    });
    render();
  </script>
</body>
</html>`;
}

export function downloadStandaloneHtml(scenes: VisualNovelScene[], assets: AssetLibrary = EMPTY_ASSETS, options: StandaloneHtmlOptions = {}, filename = "visual-novel.html") {
  const html = buildStandaloneHtml(scenes, assets, options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getHtmlPreview(scenes: VisualNovelScene[], assets: AssetLibrary = EMPTY_ASSETS, options: StandaloneHtmlOptions = {}) {
  return escapeHtml(buildStandaloneHtml(scenes, assets, options));
}
