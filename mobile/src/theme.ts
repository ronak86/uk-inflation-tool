import { ColorSchemeName } from "react-native";

export const lightColors = {
  canvas: "#F3F6F9",
  panel: "#FFFFFF",
  panelMuted: "#EEF4F8",
  ink: "#10202A",
  muted: "#627481",
  line: "#D5E0E8",
  blue: "#1F5F9F",
  blueMid: "#9DC3E6",
  blueLight: "#DDEBF7",
  green: "#087F5B",
  red: "#D13A4A",
  amber: "#F5B700",
  selection: "#FFF2A8",
};

export const darkColors = {
  canvas: "#0E1720",
  panel: "#152331",
  panelMuted: "#1D3143",
  ink: "#EDF6FB",
  muted: "#9FB3C1",
  line: "#2A4254",
  blue: "#2A70AD",
  blueMid: "#164765",
  blueLight: "#19364B",
  green: "#63D79A",
  red: "#FF7185",
  amber: "#FFD166",
  selection: "#5C501F",
};

export function colorsFor(scheme: ColorSchemeName) {
  return scheme === "dark" ? darkColors : lightColors;
}

export type AppColors = typeof lightColors;
