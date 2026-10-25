import { expect, fn, userEvent, within } from 'storybook/test';
import SquareIconButton from './SquareIconButton.vue';
import { buttonColors } from '../design/buttonColors.js';
import { ref } from 'vue';

export default {
  title: 'BUTTONS/Square Icon Button', component: SquareIconButton,
  args: { icon: 'bars', disabled: false, isActive: false, surfaceLevel: 1, label: 'Open menu', variant: 'neutral', layout: 'floating', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Color treatment from the shared app palette.' },
    icon: { control: 'select', options: ['bars', 'layer-group', 'plus', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'] },
    disabled: { control: 'boolean' },
    isActive: { control: 'boolean', description: 'Uses the active surface color at surfaceLevel while preserving other interaction feedback.' },
    surfaceLevel: { control: false, table: { disable: true }, description: 'Inherited surface depth used by neutral backgrounds and interaction states.' },
    label: { control: 'text', description: 'Accessible name and native hover tooltip. Not visible button text.' },
    layout: { control: false, table: { disable: true } },
    onClick: { table: { disable: true } },
  },
  parameters: {
    controls: { include: ['variant', 'icon', 'disabled', 'isActive', 'label'] },
    docs: { description: { component: 'Draft. A 48px square icon-only action, composed from MapControlButton. Choose Neutral, Primary or Secondary with the variant control; the shared app palette is documented on Colors. label supplies the accessible name and native hover tooltip; no label text is printed. Neutral background, hover and press colors use the inherited surfaceLevel (default 1). isActive uses the active surface color at that same level. Use the Pseudo states toolbar: no selection = default, hover = hover, active = press, focus-visible = keyboard focus. Floating uses a 4px margin, 8px corner radius and component shadow. Tight removes the margin, radius and shadow.' } },
  },
  render: (args, { globals }) => ({ components: { SquareIconButton }, setup: () => ({ args, globalTheme: globals.theme }), template: '<SquareIconButton v-bind="args" :theme="globalTheme" />' }),
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: args.label });
    const theme = button.dataset.theme || 'light';
    const variant = button.dataset.variant || 'neutral';
    const level = args.surfaceLevel === undefined || args.surfaceLevel === null ? 1 : args.surfaceLevel;
    const palette = args.disabled
      ? variant === 'neutral' ? buttonColors[theme].disabled.neutralByLevel[level] : buttonColors[theme].disabled[variant]
      : variant === 'neutral' ? buttonColors[theme].neutralByLevel[level] : buttonColors[theme][variant];
    const expectedBackground = variant === 'neutral' && args.surfaceLevel === null ? 'transparent' : palette.backgroundGradient || palette.background;
    await expect(button.style.getPropertyValue('--square-background')).toBe(expectedBackground);
    await expect(button).toHaveAttribute('title', args.label);
    await expect(button).toHaveTextContent('');
    if (args.disabled) {
      await expect(button).toBeDisabled();
      await userEvent.click(button);
      await expect(args.onClick).not.toHaveBeenCalled();
    } else {
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
export const SurfaceLevelFive = { args: { surfaceLevel: 5 }, parameters: { docs: { description: { story: 'Neutral button colors inherit surface level 5 from the parent container.' } } } };

export const Bookmark = {
  args: { icon: 'bookmark', label: 'Save bookmark', layout: 'tight' },
  render: (args, { globals }) => ({
    components: { SquareIconButton },
    setup: () => ({ args, globalTheme: globals.theme, saved: ref(false) }),
    template: '<SquareIconButton v-bind="args" :theme="globalTheme" :is-active="saved" :aria-pressed="saved" @click="saved = !saved" />',
  }),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save bookmark' });
    await expect(button.querySelector('i')).toHaveClass('fa-regular');
    await userEvent.click(button);
    await userEvent.unhover(button);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button.querySelector('i')).toHaveClass('fa-solid');
    const selected = getComputedStyle(button).backgroundColor;
    await userEvent.hover(button);
    await expect(getComputedStyle(button).backgroundColor).toBe(selected);
    await expect(getComputedStyle(button).backgroundImage).toBe('none');
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button.querySelector('i')).toHaveClass('fa-regular');
  },
};
