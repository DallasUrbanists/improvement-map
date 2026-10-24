import { expect, within } from 'storybook/test';
import TextWithInlineButton from './TextWithInlineButton.vue';

const icons = ['none', 'bars', 'layer-group', 'plus', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'];

export default {
  title: 'FORM/Text With Inline Button',
  component: TextWithInlineButton,
  args: {
    theme: undefined,
    variant: 'neutral',
    placeholder: 'Search ideas',
    icon: '',
    buttonIcon: 'magnifying-glass',
    buttonText: '',
    buttonLabel: 'Search',
    layout: 'floating',
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'] },
    placeholder: { control: 'text', description: 'Optional empty-state hint inside the input.' },
    icon: { control: 'select', options: icons, mapping: { none: '' }, description: 'Optional decorative icon inside the input.' },
    buttonIcon: { control: 'select', options: icons, mapping: { none: '' }, description: 'Action icon. With no button text this selects Square Icon Button; with button text it appears before the label.' },
    buttonText: { control: 'text', description: 'Optional visible action label. When provided, selects Text Button.' },
    buttonLabel: { control: 'text', description: 'Accessible name for the icon-only action.' },
    layout: { control: false, table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'variant', 'placeholder', 'icon', 'buttonIcon', 'buttonText', 'buttonLabel'] },
    docs: { description: { component: 'Draft. A full-width text input joined edge-to-edge with an action. Supply at least one of buttonIcon or buttonText. An icon alone uses Square Icon Button; buttonText uses Text Button, with buttonIcon optionally displayed to its left. The input and button share a seam: square input corners on the right, square button corners and no left border on the left. Floating keeps 4px of outer margin; Tight removes it.' } },
  },
  render: (args, { globals }) => ({
    components: { TextWithInlineButton },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<TextWithInlineButton v-bind="args" :theme="args.theme || globalTheme" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: args.placeholder || '' });
    const button = args.buttonText
      ? canvas.getByRole('button', { name: args.buttonText })
      : canvas.getByRole('button', { name: args.buttonLabel || args.buttonIcon });
    await expect(canvasElement.querySelectorAll('.text-with-inline-button')).toHaveLength(1);
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input.parentElement).toBe(button.parentElement);
    const inputRect = input.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    expect(inputRect.right).toBeCloseTo(buttonRect.left, 0);
    expect(inputRect.width + buttonRect.width).toBeCloseTo(input.parentElement.getBoundingClientRect().width, 0);
    expect(input.parentElement).toHaveAttribute('data-layout', args.layout);
    expect(button.classList.contains('square-icon-button')).toBe(!args.buttonText);
    expect(button.classList.contains('text-button')).toBe(Boolean(args.buttonText));
  },
};

export const FloatingWithSquareIconButton = {
  name: 'Floating w/ Square Icon Button',
  args: { layout: 'floating', buttonIcon: 'magnifying-glass', buttonText: '', buttonLabel: 'Search' },
};
export const TightWithSquareIconButton = {
  name: 'Tight w/ Square Icon Button',
  args: { layout: 'tight', buttonIcon: 'magnifying-glass', buttonText: '', buttonLabel: 'Search' },
};
export const TightWithTextButton = {
  name: 'Tight w/ Text Button',
  args: { layout: 'tight', buttonIcon: '', buttonText: 'Search', buttonLabel: 'Search' },
};
export const FloatingWithTextButton = {
  name: 'Floating w/ Text Button',
  args: { layout: 'floating', buttonIcon: '', buttonText: 'Search', buttonLabel: 'Search' },
};
