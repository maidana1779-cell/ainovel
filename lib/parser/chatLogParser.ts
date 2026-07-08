import type { MessageRole, ParsedMessage, SceneCharacter, VisualNovelScene } from "./types";

const ROLE_LABELS: Record<string, MessageRole> = {
  user: "user",
  human: "user",
  "나": "user",
  "사용자": "user",
  assistant: "assistant",
  ai: "assistant",
  chatgpt: "assistant",
  claude: "assistant",
  gemini: "assistant",
  bot: "assistant",
  "어시스턴트": "assistant",
  system: "system",
  "시스템": "system",
  narration: "narration",
  narrator: "narration",
  scene: "narration",
  "장면": "narration",
  "나레이션": "narration"
};

export const BACKGROUND_ASSETS = [
  { id: "observatory", label: "전망대", gradient: "from-slate-700 via-indigo-900 to-purple-950", icon: "OBS" },
  { id: "alley", label: "골목", gradient: "from-indigo-950 via-purple-950 to-slate-900", icon: "ALY" },
  { id: "cafe", label: "카페", gradient: "from-orange-800 via-amber-900 to-stone-900", icon: "CAF" },
  { id: "classroom", label: "교실", gradient: "from-sky-800 via-blue-900 to-slate-900", icon: "CLS" },
  { id: "archive", label: "문서고", gradient: "from-emerald-800 via-teal-900 to-slate-900", icon: "ARC" },
  { id: "cloud", label: "클라우드", gradient: "from-cyan-800 via-sky-900 to-indigo-950", icon: "CLD" }
] as const;

export const EMOTION_ASSETS = [
  { id: "neutral", label: "기본", icon: "•" },
  { id: "thoughtful", label: "사색", icon: "..." },
  { id: "curious", label: "궁금", icon: "?" },
  { id: "excited", label: "고조", icon: "!" },
  { id: "concerned", label: "불안", icon: "!" },
  { id: "calm", label: "차분", icon: "~" },
  { id: "distant", label: "서술", icon: "—" },
  { id: "code", label: "코드", icon: "#" }
] as const;

export const CHARACTER_ASSETS = [
  { id: "user", name: "사용자", fallbackPosition: "left" as const },
  { id: "ai", name: "AI", fallbackPosition: "center" as const },
  { id: "system", name: "시스템", fallbackPosition: "right" as const },
  { id: "narrator", name: "나레이션", fallbackPosition: "center" as const }
] as const;

export const PARSER_TEST_SAMPLE = `감찰관｜"접촉 이후부터 이탈 시점까지. 대략 열네 시간."

숫자를 읽는다. 14시간. 2035년 7월 14일 저녁부터 15일 아침까지. 경계영역에서 보낸 하룻밤.

감찰관｜"그 사이에 있었던 일을 시간순으로 말해줘. 세세하지 않아도 돼. 큰 흐름만."

이건—넓은 그물이다. 좁은 질문으로 하나하나 찔러가던 방식에서, 한 번에 전체를 던지는 방식으로 바꿨다.`;

const MAX_SCENE_TEXT_LENGTH = 330;
const MIN_SPLIT_TARGET = 250;

function normalizeRole(raw: string): MessageRole | null {
  return ROLE_LABELS[raw.trim().toLowerCase()] ?? null;
}

function cleanSpeaker(raw: string) {
  return raw.trim().replace(/^[\["'「『\s]+|[\]"'」』\s]+$/g, "").trim();
}

function isLikelySpeakerName(value: string) {
  const speaker = cleanSpeaker(value);
  if (!speaker || speaker.length > 40) return false;
  if (/[\n\r]/.test(speaker)) return false;
  if (/[.!?。！？,，]$/.test(speaker)) return false;
  return true;
}

function buildRoleMessage(role: MessageRole, content: string, speaker?: string): ParsedMessage {
  return {
    role,
    speaker,
    content: content.trim()
  };
}

function detectSpeakerParagraph(paragraph: string): ParsedMessage | null {
  const text = paragraph.trim();
  if (!text) return null;

  const legacy = text.match(/^([A-Za-z가-힣][A-Za-z가-힣0-9 _-]{0,39})\s*:\s*([\s\S]*)$/);
  if (legacy) {
    const label = cleanSpeaker(legacy[1]);
    const role = normalizeRole(label);
    if (role) return buildRoleMessage(role, legacy[2], roleToSpeaker(role));
    if (isLikelySpeakerName(label)) return buildRoleMessage("dialogue", legacy[2], label);
  }

  const patterns: Array<{ regex: RegExp; speakerIndex: number; textIndex: number }> = [
    { regex: /^([^|｜\n]{1,40})\s*[|｜]\s*"([\s\S]*)"\s*$/, speakerIndex: 1, textIndex: 2 },
    { regex: /^([^|｜\n]{1,40})\s*[|｜]\s*'([\s\S]*)'\s*$/, speakerIndex: 1, textIndex: 2 },
    { regex: /^([^-–—\n]{1,40})\s+[-–—]\s+([\s\S]+)$/, speakerIndex: 1, textIndex: 2 },
    { regex: /^\[([^\]\n]{1,40})\]\s*([\s\S]+)$/, speakerIndex: 1, textIndex: 2 },
    { regex: /^([^「\n]{1,40})\s*「([\s\S]*)」\s*$/, speakerIndex: 1, textIndex: 2 },
    { regex: /^([^『\n]{1,40})\s*『([\s\S]*)』\s*$/, speakerIndex: 1, textIndex: 2 }
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;
    const speaker = cleanSpeaker(match[pattern.speakerIndex]);
    if (!isLikelySpeakerName(speaker)) continue;
    return buildRoleMessage("dialogue", match[pattern.textIndex], speaker);
  }

  return null;
}

function splitParagraphOnSpeakerLines(paragraph: string) {
  const lines = paragraph.split("\n");
  const chunks: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    const maybeSpeaker = detectSpeakerParagraph(line);
    if (maybeSpeaker && buffer.length > 0) {
      chunks.push(buffer.join("\n").trim());
      buffer = [line];
      continue;
    }
    buffer.push(line);
  }

  if (buffer.length > 0) chunks.push(buffer.join("\n").trim());
  return chunks.filter(Boolean);
}

function parseTextSegment(segment: string) {
  const paragraphs = segment
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const messages: ParsedMessage[] = [];

  for (const paragraph of paragraphs) {
    const chunks = splitParagraphOnSpeakerLines(paragraph);
    for (const chunk of chunks) {
      const speakerMessage = detectSpeakerParagraph(chunk);
      if (speakerMessage) {
        if (speakerMessage.content) messages.push(speakerMessage);
        continue;
      }
      messages.push({
        role: "narration",
        speaker: "나레이션",
        content: chunk
      });
    }
  }

  return messages;
}

function pushTextSegment(messages: ParsedMessage[], lines: string[]) {
  const segment = lines.join("\n").trim();
  if (!segment) return;
  messages.push(...parseTextSegment(segment));
}

export function parseChatLog(log: string): ParsedMessage[] {
  const lines = log.replace(/\r\n/g, "\n").split("\n");
  const messages: ParsedMessage[] = [];
  let textBuffer: string[] = [];
  let inCode = false;
  let codeLanguage = "";
  let codeBuffer: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const fenceMatch = line.match(/^```([\w.+-]*)\s*$/);

    if (fenceMatch) {
      if (inCode) {
        messages.push({
          role: "tool",
          speaker: "코드",
          type: "code",
          language: codeLanguage || "text",
          content: codeBuffer.join("\n").trim()
        });
        inCode = false;
        codeLanguage = "";
        codeBuffer = [];
      } else {
        pushTextSegment(messages, textBuffer);
        textBuffer = [];
        inCode = true;
        codeLanguage = fenceMatch[1] || "text";
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    textBuffer.push(line);
  }

  if (inCode) {
    messages.push({
      role: "tool",
      speaker: "코드",
      type: "code",
      language: codeLanguage || "text",
      content: codeBuffer.join("\n").trim()
    });
  }

  pushTextSegment(messages, textBuffer);
  return messages.filter((message) => message.content.trim());
}

export function roleToSpeaker(role: MessageRole): string {
  switch (role) {
    case "user":
      return "사용자";
    case "assistant":
      return "AI";
    case "system":
      return "시스템";
    case "tool":
      return "코드";
    case "dialogue":
      return "대사";
    case "narration":
      return "나레이션";
  }
}

function displayModeForMessage(message: ParsedMessage): "dialogue" | "narration" | "system" | "code" {
  if (message.type === "code" || message.role === "tool") return "code";
  if (message.role === "system") return "system";
  if (message.role === "narration") return "narration";
  return "dialogue";
}

function splitLongText(text: string) {
  const normalized = text.trim();
  if (normalized.length <= MAX_SCENE_TEXT_LENGTH) return [normalized];

  const sentences = normalized
    .split(/(?<=[.!?。！？…]|[.!?]["'”’」』])\s+|(?<=[.!?。！？…])(?=[가-힣A-Za-z])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const units = sentences.length > 1 ? sentences : normalized.match(new RegExp(`.{1,${MAX_SCENE_TEXT_LENGTH}}`, "g")) ?? [normalized];
  const chunks: string[] = [];
  let buffer = "";

  for (const unit of units) {
    const next = buffer ? `${buffer} ${unit}`.trim() : unit;
    if (next.length > MAX_SCENE_TEXT_LENGTH && buffer.length >= MIN_SPLIT_TARGET) {
      chunks.push(buffer.trim());
      buffer = unit;
      continue;
    }
    if (next.length > MAX_SCENE_TEXT_LENGTH && !buffer) {
      chunks.push(unit.trim());
      continue;
    }
    buffer = next;
  }

  if (buffer) chunks.push(buffer.trim());
  return chunks;
}

function inferEmotion(message: ParsedMessage): string {
  const text = message.content;
  if (message.type === "code" || message.role === "tool") return "code";
  if (message.role === "system") return "calm";
  if (message.role === "narration") return "distant";
  if (/[!?！？]{2,}|좋아|멋져|great|nice/i.test(text)) return "excited";
  if (/미안|오류|문제|실패|걱정|어렵|불안|sorry|error|fail/i.test(text)) return "concerned";
  if (/\?|？|어떻게|무엇|설명|how|why|what/i.test(text)) return "curious";
  return message.role === "assistant" ? "thoughtful" : "neutral";
}

function focusForRole(role: MessageRole) {
  if (role === "assistant" || role === "dialogue" || role === "tool") return CHARACTER_ASSETS[1];
  if (role === "system") return CHARACTER_ASSETS[2];
  if (role === "narration") return CHARACTER_ASSETS[3];
  return CHARACTER_ASSETS[0];
}

function charactersForMessage(message: ParsedMessage): SceneCharacter[] {
  const focus = focusForRole(message.role);
  return [
    {
      assetId: "",
      name: message.speaker ?? focus.name,
      position: focus.fallbackPosition,
      isSpeaking: message.role !== "narration"
    }
  ];
}

export function messagesToScenes(messages: ParsedMessage[]): VisualNovelScene[] {
  if (messages.length === 0) return [];

  let sceneIndex = 0;
  return messages.flatMap((message) => {
    const chunks = message.type === "code" ? [message.content.trim()] : splitLongText(message.content);

    return chunks.filter(Boolean).map((text) => {
      const backgroundAsset = BACKGROUND_ASSETS[sceneIndex % BACKGROUND_ASSETS.length];
      const emotion = inferEmotion(message);
      const emotionAsset = EMOTION_ASSETS.find((asset) => asset.id === emotion) ?? EMOTION_ASSETS[0];
      const scene: VisualNovelScene = {
        id: `scene-${Date.now()}-${sceneIndex}`,
        sceneNo: sceneIndex + 1,
        role: message.role,
        displayMode: displayModeForMessage(message),
        speaker: message.role === "narration" ? undefined : message.speaker ?? roleToSpeaker(message.role),
        text,
        background: backgroundAsset.id,
        backgroundAsset: backgroundAsset.id,
        emotion,
        emotionIcon: emotionAsset.icon,
        characterFocus: focusForRole(message.role).id,
        characters: charactersForMessage(message),
        type: message.type
      };
      sceneIndex += 1;
      return scene;
    });
  });
}
