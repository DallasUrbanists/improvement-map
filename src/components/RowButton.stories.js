import { expect, fn, userEvent, within } from 'storybook/test';
import RowButton from './RowButton.vue';
import { buttonColors } from '../design/buttonColors.js';

const icons = ['none', 'bars', 'layer-group', 'plus', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'];
const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

export default {
  title: 'BUTTONS/Row Button', component: RowButton,
  args: { icon: 'bars', disabled: false, label: 'Browse', variant: 'neutral', onClick: fn() },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Color treatment from the shared app palette.' },
    icon: { control: 'select', options: icons, mapping: { none: '' }, description: 'Optional leading icon; choose none to show text only.' },
    disabled: { control: 'boolean' },
    label: { control: 'text', description: 'Always-visible button label, accessible name and native hover tooltip.' },
    onClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'variant', 'icon', 'disabled', 'label'] },
    docs: { description: { component: 'Draft. Full-width, left-aligned row action based on Text Button Tight. It keeps the Tight treatment (no margin, corner radius or shadow), with an optional leading icon and always-visible label. Only the bottom border is shown. In With icon, a fixed icon column keeps labels aligned across rows. Choose Neutral, Primary or Secondary with the variant control. Use the Pseudo states toolbar to inspect default, hover, press and keyboard focus.' } },
  },
  render: (args, { globals }) => ({
    components: { RowButton },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<RowButton v-bind="args" :theme="args.theme || globalTheme" />',
  }),
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: args.label });
    const colorStyles = window.getComputedStyle(button);
    const theme = button.dataset.theme || 'light';
    const variant = button.dataset.variant || 'neutral';
    const palette = args.disabled ? buttonColors[theme].disabled[variant] : buttonColors[theme][variant];
    await expect(colorStyles.color).toBe(asRgb(palette.foreground));
    await expect(colorStyles.borderBottomColor).toBe(asRgb(palette.border));
    if (args.disabled) {
      await expect(colorStyles.backgroundImage).toBe('none');
      await expect(colorStyles.backgroundColor).toBe(asRgb(palette.background));
    } else await expect(colorStyles.backgroundImage).toContain('linear-gradient');
    await expect(button).toHaveAttribute('title', args.label);
    await expect(button).toHaveTextContent(args.label);
    await expect(button).toHaveAttribute('data-layout', 'tight');
    const styles = window.getComputedStyle(button);
    expect(styles.margin).toBe('0px');
    expect(styles.borderRadius).toBe('0px');
    expect(styles.boxShadow).toBe('none');
    expect(styles.justifyContent).toBe('flex-start');
    expect(styles.borderTopWidth).toBe('0px');
    expect(styles.borderRightWidth).toBe('0px');
    expect(styles.borderLeftWidth).toBe('0px');
    expect(styles.borderBottomWidth).toBe('1px');
    const buttonBox = button.getBoundingClientRect();
    const parentBox = button.parentElement.getBoundingClientRect();
    expect(buttonBox.width).toBeCloseTo(parentBox.width, 0);
    if (args.icon) {
      const icon = button.querySelector('i');
      await expect(icon).toHaveClass(`fa-${args.icon}`);
      expect(icon.nextElementSibling).toHaveTextContent(args.label);
      expect(window.getComputedStyle(icon).width).toBe('24px');
      expect(window.getComputedStyle(icon).flexBasis).toBe('24px');
    } else {
      await expect(button.querySelector('i')).toBeNull();
    }
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

export const WithIcon = { name: 'With icon', args: { icon: 'bars', label: 'Browse' } };
export const WithoutIcon = { name: 'Without icon', args: { icon: '', label: 'Browse' } };
