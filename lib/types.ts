export type StandingAsset = {
  id: string;
  name: string;
  fileName: string;
  dataUrl: string;
};

export type BackgroundAsset = {
  id: string;
  name: string;
  fileName: string;
  dataUrl: string;
};

export type BgmAsset = {
  id: string;
  name: string;
  fileName: string;
  dataUrl: string;
};

export type SceneCharacter = {
  assetId: string;
  name: string;
  position: "left" | "center" | "right";
  isSpeaking: boolean;
};

export type SceneDisplayMode = "dialogue" | "narration" | "system" | "code" | "choice" | "cg";

export type ChoiceOption = {
  id: string;
  text: string;
  targetSceneId?: string;
};

export type VnEffect =
  | { id: string; type: "pause"; durationMs: number; position: "beforeText" | "afterText" }
  | { id: string; type: "textSpeed"; value: "slow" | "normal" | "fast" }
  | { id: string; type: "screenShake"; intensity: "soft" | "medium" }
  | { id: string; type: "fadeIn" | "fadeOut"; durationMs: number }
  | { id: string; type: "flash"; durationMs: number }
  | { id: string; type: "splitTextPage" }
  | { id: string; type: "emphasis"; value: string }
  | { id: string; type: "soundEffect"; placeholder: string };

export type Scene = {
  id: string;
  displayMode: SceneDisplayMode;
  speaker?: string;
  text: string;
  imageAsset?: string;
  imageFileName?: string;
  cgTransition?: "fade" | "instant";
  showDialogue?: boolean;
  choices?: ChoiceOption[];
  effects?: VnEffect[];
  directorNotes?: string[];
  nextSceneId?: string;
  backgroundAssetId?: string;
  bgmAssetId?: string;
  characters: SceneCharacter[];
};

export type AssetLibrary = {
  standingAssets: StandingAsset[];
  backgroundAssets: BackgroundAsset[];
  bgmAssets: BgmAsset[];
};
