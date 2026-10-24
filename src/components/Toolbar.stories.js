import { expect, fn, userEvent, within } from 'storybook/test';
import Toolbar from './Toolbar.vue';
import { buttonColors } from '../design/buttonColors.js';

const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

export default {
  title: 'BARS/Toolbar', component: Toolbar,
  args: { theme: undefined, variant: 'neutral', buttons: [], buttonType: 'icon', onButtonClick: fn() },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Shared color treatment for each button.' },
    buttons: { control: 'object', description: 'Button list. Each item accepts icon, label and optional disabled.' },
    buttonType: { control: false, table: { disable: true } },
    onButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'variant', 'buttons'] },
    docs: { description: { component: 'Draft. Full-width, palette-themed bar with a 1px bottom border, composed from Square Icon Button or Text Button. Buttons always use their Tight treatment: zero margin, corner radius and shadow. Button definitions provide icon, visible or accessible label, and optional disabled state. Activations emit button-click with the selected button and its index.' } },
  },
  render: (args, { globals }) => ({
    components: { Toolbar },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<Toolbar v-bind="args" :theme="args.theme || globalTheme" @button-click="args.onButtonClick" />',
  }),
  play: async ({ canvasElement, args, globals }) => {
    const canvas = within(canvasElement);
    const theme = args.theme || globals.theme || 'light';
    const palette = buttonColors[theme][args.variant];
    const toolbar = canvasElement.querySelector('.toolbar');
    const toolbarStyles = window.getComputedStyle(toolbar);
    expect(toolbarStyles.backgroundColor).toBe(asRgb(palette.background));
    expect(toolbarStyles.borderBottomColor).toBe(asRgb(palette.border));
    expect(toolbarStyles.borderBottomWidth).toBe('1px');
    const buttons = canvas.getAllByRole('button');
    await expect(buttons).toHaveLength(args.buttons.length);
    for (const [index, item] of args.buttons.entries()) {
      const button = buttons[index];
      await expect(button).toHaveAttribute('data-layout', 'tight');
      await expect(button).toHaveAccessibleName(item.label);
      const styles = window.getComputedStyle(button);
      expect(styles.margin).toBe('0px');
      expect(styles.borderRadius).toBe('0px');
      expect(styles.borderRightWidth).toBe('0px');
      expect(styles.borderTopWidth).toBe('0px');
      expect(styles.borderBottomWidth).toBe('0px');
      expect(styles.boxShadow).toBe('none');
      const buttonPalette = item.disabled ? buttonColors[theme].disabled[args.variant] : palette;
      if (item.disabled) {
        expect(styles.backgroundImage).toBe('none');
        expect(styles.backgroundColor).toBe(asRgb(buttonPalette.background));
      } else expect(styles.backgroundImage).toContain('linear-gradient');
      expect(styles.color).toBe(asRgb(buttonPalette.foreground));
      expect(styles.borderLeftColor).toBe(asRgb(buttonPalette.border));
      if (args.buttonType === 'text') await expect(button).toHaveTextContent(item.label);
      else await expect(button).toHaveTextContent('');
      if (item.disabled) await expect(button).toBeDisabled();
      else await userEvent.click(button);
    }
    await expect(args.onButtonClick).toHaveBeenCalledTimes(args.buttons.filter(button => !button.disabled).length);
  },
};

export const AllIconButtons = {
  args: {
    buttonType: 'icon', variant: 'neutral',
    buttons: [
      { icon: 'bars', label: 'Menu' },
      { icon: 'magnifying-glass', label: 'Search' },
      { icon: 'bookmark', label: 'Saved' },
    ],
  },
};

export const AllTextButtons = {
  args: {
    buttonType: 'text', variant: 'neutral',
    buttons: [
      { icon: 'plus', label: 'New' },
      { icon: 'location-crosshairs', label: 'Locate' },
      { icon: '', label: 'Browse' },
    ],
  },
};
