import { expect, fn, userEvent, within } from 'storybook/test';
import TextButton from './TextButton.vue';
import { buttonColors } from '../design/buttonColors.js';
import { surfaceColors } from '../design/surfaceColors.js';

const icons = ['none', 'bars', 'layer-group', 'plus', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'];
const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

export default {
  title: 'BUTTONS/Text Button', component: TextButton,
  args: { icon: 'bars', disabled: false, isActive: false, surfaceLevel: 1, label: 'Open menu', variant: 'neutral', layout: 'floating', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Color treatment from the shared app palette.' },
    icon: { control: 'select', options: icons, mapping: { none: '' }, description: 'Optional leading icon; choose none to show text only.' },
    disabled: { control: 'boolean' },
    isActive: { control: 'boolean', description: 'Uses the active surface color at surfaceLevel while preserving other interaction feedback.' },
    surfaceLevel: { control: false, table: { disable: true }, description: 'Inherited surface depth used by the active state.' },
    label: { control: 'text', description: 'Always-visible button label, accessible name and native hover tooltip.' },
    layout: { control: false, table: { disable: true } },
    onClick: { table: { disable: true } },
  },
  parameters: {
    controls: { include: ['variant', 'icon', 'disabled', 'isActive', 'label'] },
    docs: { description: { component: 'Draft. A fit-content text action, composed from MapControlButton. Its label is always printed, and an optional icon appears to the left. Choose Neutral, Primary or Secondary with the variant control; the shared app palette is documented on Colors. isActive uses the active surface color at the inherited surfaceLevel (default 1), while hover and focus feedback remain available. Use the Pseudo states toolbar: no selection = default, hover = hover, active = press, focus-visible = keyboard focus. Floating uses a 4px margin, 8px corner radius and component shadow. Tight removes the margin, radius and shadow.' } },
  },
  render: (args, { globals }) => ({ components: { TextButton }, setup: () => ({ args, globalTheme: globals.theme }), template: '<TextButton v-bind="args" :theme="globalTheme" />' }),
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: args.label });
    const styles = window.getComputedStyle(button);
    const theme = button.dataset.theme || 'light';
    const variant = button.dataset.variant || 'neutral';
    const palette = args.disabled ? buttonColors[theme].disabled[variant] : buttonColors[theme][variant];
    const activeBackground = args.surfaceLevel === null ? 'transparent' : surfaceColors[theme].active[`level${args.surfaceLevel ?? 1}`];
    // Representative contract: theme tokens reach the shared button, including active surfaces.
    await expect(styles.color).toBe(asRgb(palette.foreground));
    if (args.isActive) {
      await expect(styles.backgroundColor).toBe(args.surfaceLevel === null ? 'rgba(0, 0, 0, 0)' : asRgb(activeBackground));
    }
    await expect(button).toHaveAttribute('title', args.label);
    await expect(button).toHaveTextContent(args.label);
    if (args.icon) await expect(button.querySelector('i')).toHaveClass(`fa-${args.icon}`);
    else await expect(button.querySelector('i')).toBeNull();
    if (args.disabled) {
      await expect(button).toBeDisabled();
      await userEvent.click(button);
      await expect(args.onClick).not.toHaveBeenCalled();
    } else {
      if (args.isActive) {
        await userEvent.hover(button);
        await expect(window.getComputedStyle(button).backgroundColor).toBe(asRgb(activeBackground));
        await userEvent.unhover(button);
      }
      await userEvent.click(button);
      await expect(args.onClick).toHaveBeenCalledTimes(1);
      button.focus();
      await userEvent.keyboard('{Enter}');
      await expect(args.onClick).toHaveBeenCalledTimes(2);
      button.blur();
      await userEvent.unhover(button);
    }
  },
};
export const Floating = { args: { layout: 'floating' } };
export const Tight = { args: { layout: 'tight' } };
export const Active = { args: { layout: 'tight', isActive: true }, parameters: { docs: { description: { story: 'Tight button shown in its active-surface state. Toggle isActive to compare the state.' } } } };
