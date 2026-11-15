import type { CSSProperties } from 'react';

const original = [
  [45, 70, 260, 205],
  [370, 45, 195, 230],
  [620, 48, 270, 228],
  [960, 44, 195, 230],
  [1220, 65, 280, 205],
  [68, 302, 220, 225],
  [355, 320, 215, 200],
  [610, 302, 300, 220],
  [960, 300, 190, 230],
  [1235, 292, 240, 235],
  [36, 575, 270, 170],
  [355, 570, 235, 175],
  [655, 540, 220, 225],
  [930, 585, 245, 160],
  [1248, 540, 220, 235],
  [32, 825, 276, 145],
  [384, 780, 180, 230],
  [610, 790, 275, 205],
  [975, 780, 170, 220],
  [1210, 800, 300, 205],
];
const expansion = [
  [42, 45, 250, 225],
  [388, 38, 159, 239],
  [609, 63, 278, 210],
  [944, 52, 249, 225],
  [1280, 51, 181, 215],
  [51, 299, 228, 222],
  [322, 310, 276, 196],
  [610, 325, 289, 194],
  [950, 300, 225, 224],
  [1240, 307, 253, 211],
  [44, 544, 251, 199],
  [357, 516, 211, 228],
  [617, 565, 267, 169],
  [950, 555, 231, 179],
  [1215, 555, 286, 185],
  [30, 772, 274, 221],
  [369, 792, 193, 203],
  [662, 766, 182, 232],
  [928, 793, 275, 181],
  [1245, 779, 227, 212],
];

export const thinkingIllustrations = [
  ...original.map((region) => ({ atlas: 'everyday-objects-transparent-v1', region })),
  ...expansion.map((region) => ({ atlas: 'everyday-objects-expansion-v1', region })),
];

export function illustrationStyle(index: number): CSSProperties {
  const {
    atlas,
    region: [x, y, width, height],
  } = thinkingIllustrations[index];
  return {
    width: `${Math.min(1, width / height / 1.2) * 100}%`,
    height: `${Math.min(1, (1.2 * height) / width) * 100}%`,
    backgroundImage: `url(/journal/illustrations/${atlas}.webp)`,
    backgroundSize: `${(1536 / width) * 100}% ${(1024 / height) * 100}%`,
    backgroundPosition: `${(x / (1536 - width)) * 100}% ${(y / (1024 - height)) * 100}%`,
  };
}
