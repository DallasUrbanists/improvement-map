import { principalColors, principalHues } from './principalColors.js';
import { colorAtHueSaturationLuminance, colorAtLuminance, luminance } from './colorMath.js';
import { surfaceColors } from './surfaceColors.js';
import { textColors } from './textColors.js';

const clampLuminance = value => Math.max(0, Math.min(1, value));
const adjustedLuminance = (baseLuminance, percent) => clampLuminance(baseLuminance * (1 + percent));
const gradient = (reference, baseLuminance, offset = 0, reverse = false, hue = null, saturation = null) => {
  const stops = [0.05, 0, -0.05].map(step => offset === 0 && step === 0
    ? reference
    : hue === null
      ? colorAtLuminance(reference, adjustedLuminance(baseLuminance, offset + step), saturation)
      : colorAtHueSaturationLuminance(hue, adjustedLuminance(baseLuminance, offset + step), saturation ?? 1));
  if (reverse) stops.reverse();
  return `linear-gradient(to bottom, ${stops[0]} 0% 10%, ${stops[1]} 90%, ${stops[2]} 100%)`;
};
const adjustBrightness = (hex, percent) => colorAtLuminance(hex, adjustedLuminance(luminance(hex), percent));

function variant(theme, name, surfaceLevel = 1) {
  const isNeutral = name === 'neutral';
  const reference = isNeutral ? surfaceColors[theme].neutral[`level${surfaceLevel}`] : principalColors[theme][name];
  const hue = isNeutral ? null : principalHues[name];
  const baseLuminance = luminance(reference);
  const foreground = theme === 'light' ? '#000000' : '#ffffff';
  const border = theme === 'dark' ? 'rgb(0 0 0 / 50%)' : 'rgb(255 255 255 / 50%)';
  const focus = isNeutral ? principalColors[theme].primary : foreground;
  const gradientTop = hue === null ? colorAtLuminance(reference, adjustedLuminance(baseLuminance, 0.05)) : colorAtHueSaturationLuminance(hue, adjustedLuminance(baseLuminance, 0.05), 1);
  const gradientMiddle = reference;
  const gradientBottom = hue === null ? colorAtLuminance(reference, adjustedLuminance(baseLuminance, -0.05)) : colorAtHueSaturationLuminance(hue, adjustedLuminance(baseLuminance, -0.05), 1);
  return {
    background: reference,
    gradientTop,
    gradientMiddle,
    gradientBottom,
    backgroundGradient: gradient(reference, baseLuminance, 0, false, hue),
    foreground,
    border,
    hover: adjustBrightness(reference, 0.05),
    hoverGradient: gradient(reference, baseLuminance, 0.05, false, hue),
    press: adjustBrightness(reference, -0.05),
    pressGradient: gradient(reference, baseLuminance, -0.05, true, hue),
    focus,
  };
}

function disabledVariant(theme, name) {
  const isNeutral = name === 'neutral';
  const reference = isNeutral ? surfaceColors[theme].neutral.level1 : principalColors[theme][name];
  const hue = isNeutral ? principalHues.primary : principalHues[name];
  const background = colorAtHueSaturationLuminance(hue, luminance(reference), 0.05);
  const foreground = theme === 'light' ? '#000000' : '#f2f2f2';
  return {
    background,
    foreground,
    border: 'transparent',
    focus: principalColors[theme].primary,
  };
}

// Solid colors remain available to non-button components that share theme variants.
export const buttonColors = Object.fromEntries(['light', 'dark'].map(theme => [theme, {
  neutral: variant(theme, 'neutral'),
  neutralByLevel: Object.fromEntries(Array.from({ length: 6 }, (_, level) => [level, variant(theme, 'neutral', level)])),
  primary: variant(theme, 'primary'),
  secondary: variant(theme, 'secondary'),
  disabled: {
    neutral: disabledVariant(theme, 'neutral'),
    primary: disabledVariant(theme, 'primary'),
    secondary: disabledVariant(theme, 'secondary'),
  },
}]));
