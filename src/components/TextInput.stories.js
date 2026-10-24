import { expect, userEvent, within } from 'storybook/test';
import TextInput from './TextInput.vue';

const icons = ['none', 'bars', 'layer-group', 'plus', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'];

export default {
  title: 'FORM/Text Input', component: TextInput,
  args: { theme: undefined, placeholder: 'Search ideas', icon: '', layout: 'floating' },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    placeholder: { control: 'text', description: 'Optional empty-state hint; also supplies the input accessible name when present.' },
    icon: { control: 'select', options: icons, mapping: { none: '' }, description: 'Optional decorative leading icon; choose none to omit it.' },
    layout: { control: false, table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'placeholder', 'icon'] },
    docs: { description: { component: 'Draft. A raw full-width <input type="text"> with no label or surrounding wrapper. Placeholder is optional; the optional icon is decorative and displayed inside the input at the leading edge. Floating uses the Text Button Floating treatment (4px margin, 8px radius and shadow). Tight removes the margin, radius and shadow. Use the Pseudo states toolbar to inspect default, hover, press and keyboard focus.' } },
  },
  render: (args, { globals }) => ({
    components: { TextInput },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<TextInput v-bind="args" :theme="args.theme || globalTheme" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: args.placeholder || '' });
    await expect(canvasElement.querySelectorAll('.text-input')).toHaveLength(1);
    await expect(input).toHaveAttribute('type', 'text');
    if (args.placeholder) await expect(input).toHaveAttribute('placeholder', args.placeholder);
    else await expect(input).not.toHaveAttribute('placeholder');
    await expect(input).toHaveAttribute('data-layout', args.layout);
    // The input must fit its available space; decorative margins may change.
    expect(input.getBoundingClientRect().right).toBeLessThanOrEqual(input.parentElement.getBoundingClientRect().right + 1);
    if (args.icon) {
      await expect(input).toHaveClass('text-input--with-icon');
    } else {
      await expect(input).not.toHaveClass('text-input--with-icon');
    }
    await userEvent.type(input, 'Dallas');
    await expect(input).toHaveValue('Dallas');
    await userEvent.clear(input);
    await expect(input).toHaveValue('');
    input.blur();
  },
};

export const Floating = { args: { layout: 'floating', placeholder: 'Search ideas', icon: '' } };
export const Tight = { args: { layout: 'tight', placeholder: 'Search ideas', icon: '' } };
