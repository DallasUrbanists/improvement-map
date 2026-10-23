import { expect, fn, userEvent, within } from 'storybook/test';
import HeaderBar from './HeaderBar.vue';
import { buttonColors } from '../design/buttonColors.js';

const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

export default {
  title: 'BARS/Header Bar', component: HeaderBar,
  args: { label: 'Header', subtitle: '', theme: undefined, variant: 'neutral', buttons: [], onButtonClick: fn() },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Sets the bar background from the shared app palette.' },
    label: { control: 'text', description: 'Always-visible, left-aligned bold header text.' },
    subtitle: { control: 'text', description: 'Optional secondary line below the header label.' },
    buttons: { control: 'object', description: 'Square Icon Buttons to render at the right. Each item accepts icon, label, optional variant and disabled.' },
    onButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'variant', 'label', 'subtitle', 'buttons'] },
    docs: { description: { component: 'Draft. Full-width header bar with bold, left-aligned label, optional subtitle and a solid 1px bottom border. The variant control selects the shared palette background (Neutral, Primary or Secondary). With Buttons composes any number of existing Square Icon Buttons in Tight layout; each button inherits the bar variant unless it defines one.' } },
  },
  render: (args, { globals }) => ({
    components: { HeaderBar },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<HeaderBar v-bind="args" :theme="args.theme || globalTheme" @button-click="args.onButtonClick" />',
  }),
  play: async ({ canvasElement, args, globals }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('banner');
    const theme = args.theme || globals.theme || 'light';
    const computed = element => window.getComputedStyle(element);
    await expect(header).toHaveTextContent(args.label);
    if (args.subtitle) {
      const subtitle = canvas.getByText(args.subtitle);
      await expect(subtitle).toBeVisible();
      await expect(computed(subtitle).fontSize).toBe('10px');
    } else {
      await expect(header.querySelector('.header-bar__subtitle')).toBeNull();
    }
    await expect(computed(header).backgroundColor).toBe(asRgb(buttonColors[theme][args.variant].background));
    await expect(computed(header).color).toBe(asRgb(buttonColors[theme][args.variant].foreground));
    await expect(computed(header).borderBottomColor).toBe(asRgb(buttonColors[theme][args.variant].border));
    await expect(computed(header.querySelector('.header-bar__label')).fontWeight).toBe('700');
    await expect(computed(header).height).toBe('49px');
    await expect(computed(header).borderBottomWidth).toBe('1px');
    const buttons = Array.from(header.querySelectorAll('.header-bar__close'));
    await expect(buttons).toHaveLength(args.buttons.length);
    if (buttons.length) {
      const buttonStyles = computed(buttons[0]);
      await expect(buttonStyles.borderTopWidth).toBe('0px');
      await expect(buttonStyles.borderBottomWidth).toBe('0px');
      await expect(buttonStyles.borderLeftWidth).toBe('1px');
      await expect(buttonStyles.borderRightWidth).toBe('0px');
    }
    for (const [index, item] of args.buttons.entries()) {
      const button = buttons[index];
      const palette = item.disabled
        ? buttonColors[theme].disabled[item.variant || args.variant]
        : buttonColors[theme][item.variant || args.variant];
      const buttonStyles = computed(button);
      await expect(button).toHaveAccessibleName(item.label);
      await expect(buttonStyles.margin).toBe('0px');
      await expect(buttonStyles.borderRadius).toBe('0px');
      if (item.disabled) {
        await expect(buttonStyles.backgroundImage).toBe('none');
        await expect(buttonStyles.backgroundColor).toBe(asRgb(palette.background));
      } else await expect(buttonStyles.backgroundImage).toContain('linear-gradient');
      await expect(buttonStyles.color).toBe(asRgb(palette.foreground));
      await expect(buttonStyles.borderLeftColor).toBe(asRgb(palette.border));
      await expect(button.querySelector('i')).toHaveClass(`fa-${item.icon}`);
      if (item.disabled) await expect(button).toBeDisabled();
      else await userEvent.click(button);
    }
    await expect(args.onButtonClick).toHaveBeenCalledTimes(args.buttons.filter(item => !item.disabled).length);
    if (!args.buttons.length) await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const Plain = { args: { label: "Plain Header", buttons: [], variant: 'neutral' } };
export const WithButtons = { args: { label: "Header w/ Buttons", buttons: [{
  "icon": "bookmark",
  "label": "Save"
}, {
  "icon": "bars",
  "label": "Menu"
}], variant: 'neutral' } };
export const WithSubtitle = { args: { label: 'Header', subtitle: 'A short supporting description', buttons: [], variant: 'neutral' } };
export const WithButtonsAndSubtitle = { name: 'With Buttons & Subtitle', args: { label: 'Header', subtitle: 'A short supporting description', buttons: [{
  icon: 'bookmark', label: 'Save',
}, {
  icon: 'bars', label: 'Menu',
}], variant: 'neutral' } };
