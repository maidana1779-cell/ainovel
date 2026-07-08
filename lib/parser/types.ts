import type { Scene, SceneCharacter } from "../types";

export type MessageRole = "user" | "assistant" | "system" | "narration" | "dialogue" | "tool";

export type MessageType = "message" | "code";

export type ParsedMessage = {
  role: MessageRole;
  content: string;
  speaker?: string;
  type?: MessageType;
  language?: string;
};

export type VisualNovelScene = Scene & {
  sceneNo?: number;
  role?: MessageRole;
  background: string;
  backgroundAsset?: string;
  emotion: string;
  emotionIcon?: string;
  characterFocus?: string;
  imageAsset?: string;
  type?: MessageType;
  characters: SceneCharacter[];
};

export type { SceneCharacter };
