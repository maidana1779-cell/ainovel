export type PlayerFontOption = {
  id: string;
  label: string;
  cssFamily: string;
  googleFont?: string;
};

export const DEFAULT_PLAYER_FONT_ID = "noto-sans-kr";

export const PLAYER_FONT_OPTIONS: PlayerFontOption[] = [
  {
    id: "system-sans",
    label: "System Sans",
    cssFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  },
  {
    id: "noto-sans-kr",
    label: "Noto Sans KR",
    cssFamily: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    googleFont: "Noto+Sans+KR:wght@400;500;700"
  },
  {
    id: "noto-serif-kr",
    label: "Noto Serif KR",
    cssFamily: '"Noto Serif KR", "Apple SD Gothic Neo", "Malgun Gothic", serif',
    googleFont: "Noto+Serif+KR:wght@400;500;700"
  },
  {
    id: "pretendard",
    label: "Pretendard",
    cssFamily: 'Pretendard, "Pretendard Variable", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  },
  {
    id: "nanum-myeongjo",
    label: "Nanum Myeongjo",
    cssFamily: '"Nanum Myeongjo", "Noto Serif KR", "Apple SD Gothic Neo", "Malgun Gothic", serif',
    googleFont: "Nanum+Myeongjo:wght@400;700"
  },
  {
    id: "gowun-batang",
    label: "Gowun Batang",
    cssFamily: '"Gowun Batang", "Noto Serif KR", "Apple SD Gothic Neo", "Malgun Gothic", serif',
    googleFont: "Gowun+Batang"
  }
];

export function getPlayerFontOption(fontId?: string) {
  return PLAYER_FONT_OPTIONS.find((option) => option.id === fontId) ?? PLAYER_FONT_OPTIONS.find((option) => option.id === DEFAULT_PLAYER_FONT_ID) ?? PLAYER_FONT_OPTIONS[0];
}
