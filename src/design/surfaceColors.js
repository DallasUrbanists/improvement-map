import { principalHues } from './principalColors.js';
import { colorAtHueSaturationLuminance, luminance } from './colorMath.js';

const lightNeutral = ['#d1d1d1', '#d7d7d7', '#dddddd', '#e2e2e2', '#e8e8e8', '#eeeeee'];
const darkNeutral = Array.from({ length: 6 }, (_, level) => {
  const gray = Math.round(0x33 + ((0x76 - 0x33) * level) / 5);
  return `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
});

function activeSurfaceColors(theme, neutralLevels) {
  return Object.fromEntries(neutralLevels.map((neutral, level) => [
    `level${level}`,
    colorAtHueSaturationLuminance(principalHues.primary, luminance(neutral), 1),
  ]));
}

const asLevels = colors => Object.fromEntries(colors.map((color, level) => [`level${level}`, color]));

/** Non-button surfaces. Level 0 is deepest; level 5 is closest to the viewer. */
export const surfaceColors = {
  light: {
    neutral: asLevels(lightNeutral),
    active: activeSurfaceColors('light', lightNeutral),
  },
  dark: {
    neutral: asLevels(darkNeutral),
    active: activeSurfaceColors('dark', darkNeutral),
  },
};
