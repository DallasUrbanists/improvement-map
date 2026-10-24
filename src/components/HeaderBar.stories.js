import { expect, fn, userEvent, within } from 'storybook/test';
import HeaderBar from './HeaderBar.vue';

export default {
  title: 'BARS/Header Bar', component: HeaderBar,
  args: { label: 'Header', subtitle: '', theme: undefined, variant: 'neutral', surfaceLevel: 1, buttons: [], onButtonClick: fn() },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Sets the bar background from the shared app palette.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Neutral surface level when variant is neutral.' },
    label: { control: 'text', description: 'Always-visible, left-aligned bold header text.' },
    subtitle: { control: 'text', description: 'Optional secondary line below the header label.' },
    buttons: { control: 'object', description: 'Square Icon Buttons to render at the right. Each item accepts icon, label, optional variant and disabled.' },
    onButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'variant', 'surfaceLevel', 'label', 'subtitle', 'buttons'] },
    docs: { description: { component: 'Draft. Full-width header bar with bold, left-aligned label, optional subtitle and a solid 1px bottom border. The variant control selects the shared palette background (Neutral, Primary or Secondary). With Buttons composes any number of existing Square Icon Buttons in Tight layout; each button inherits the bar variant unless it defines one.' } },
  },
  render: (args, { globals }) => ({
    components: { HeaderBar },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<HeaderBar v-bind="args" :theme="args.theme || globalTheme" @button-click="args.onButtonClick" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('banner');
    await expect(header).toHaveTextContent(args.label);
    if (args.subtitle) {
      const subtitle = canvas.getByText(args.subtitle);
      await expect(subtitle).toBeVisible();
    } else {
      await expect(header.querySelector('.header-bar__subtitle')).toBeNull();
    }
    await expect(header).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
    const buttons = Array.from(header.querySelectorAll('.header-bar__close'));
    await expect(buttons).toHaveLength(args.buttons.length);
    for (const [index, item] of args.buttons.entries()) {
      const button = buttons[index];
      await expect(button).toHaveAccessibleName(item.label);
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
