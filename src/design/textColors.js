import { principalColors } from './principalColors.js';
import { mutedTextForSurface } from './colorMath.js';
import { surfaceColors } from './surfaceColors.js';

function mutedSurfaces(theme) {
  return Object.fromEntries(Object.entries(surfaceColors[theme]).map(([tone, levels]) => {
    let previousGray = -1;
    const muted = Object.fromEntries(Object.entries(levels).map(([level, surface]) => {
      const color = mutedTextForSurface(theme, surface, 4.5, theme === 'dark' ? previousGray + 1 : 0);
      if (theme === 'dark') previousGray = Number.parseInt(color.slice(1, 3), 16);
      return [level, color];
    }));
    return [tone, muted];
  }));
}

export const textColors = {
  default: { light: '#fefefe', dark: '#010101' },
  bold: { light: '#ffffff', dark: '#000000' },
  heading: { light: principalColors.dark.primary, dark: principalColors.light.primary },
  link: { light: principalColors.dark.secondary, dark: principalColors.light.secondary },
  muted: { light: mutedSurfaces('light'), dark: mutedSurfaces('dark') },
};
