import { expect, fn, userEvent, within } from 'storybook/test';
import { ref, watch } from 'vue';
import NewIdeaSpecialButton from './NewIdeaSpecialButton.vue';
import { buttonColors } from '../design/buttonColors.js';

const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

export default {
  title: 'BUTTONS/New Idea Special Button',
  component: NewIdeaSpecialButton,
  args: {
    state: 'new',
    theme: undefined,
    variant: 'primary',
    pinTop: '50%',
    pinReady: true,
    onNew: fn(),
    onSetPin: fn(),
    onCancelPin: fn(),
    onClose: fn(),
  },
  argTypes: {
    state: { control: 'inline-radio', options: ['new', 'pin', 'close'], description: 'Shows the New circle, pin confirmation actions, or the submission Close circle.' },
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Palette for the New and Set pin and continue actions.' },
    pinTop: { control: false, table: { disable: true }, description: 'Map-calculated vertical position for pin confirmation.' },
    pinReady: { control: 'boolean', description: 'Disables Set pin and continue until the pin entrance animation is ready.' },
    onNew: { table: { disable: true } },
    onSetPin: { table: { disable: true } },
    onCancelPin: { table: { disable: true } },
    onClose: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['state', 'theme', 'variant', 'pinReady'] },
    docs: { description: { component: 'Draft. A map-positioned action derived from Big Circle Button. New opens pin selection; the circle becomes Set pin and continue with a separate Cancel pin action. The confirm and cancel actions are instances of Text Button. After pin confirmation, the Close circle returns to the map. Events: new, set-pin, cancel-pin and close.' } },
  },
  render: (args, { globals }) => ({
    components: { NewIdeaSpecialButton },
    setup() {
      const state = ref(args.state);
      watch(() => args.state, value => { state.value = value; });
      const enterPin = () => { state.value = 'pin'; args.onNew(); };
      const setPin = () => { state.value = 'close'; args.onSetPin(); };
      const cancelPin = () => { state.value = 'new'; args.onCancelPin(); };
      const close = () => { state.value = 'new'; args.onClose(); };
      return { args, globalTheme: globals.theme, state, enterPin, setPin, cancelPin, close };
    },
    template: '<NewIdeaSpecialButton :state="state" :theme="args.theme || globalTheme" :variant="args.variant" :pin-top="args.pinTop" :pin-ready="args.pinReady" @new="enterPin" @set-pin="setPin" @cancel-pin="cancelPin" @close="close" />',
  }),
  play: async ({ canvasElement, args, globals }) => {
    const canvas = within(canvasElement);
    const theme = args.theme || globals.theme || 'light';
    const button = label => canvas.getByRole('button', { name: label, exact: true });
    const mainLabel = args.state === 'new' ? 'New' : args.state === 'pin' ? 'Set pin and continue' : 'Close';
    const main = button(mainLabel);
    const variant = args.state === 'close' ? 'neutral' : args.variant;
    const palette = args.state === 'pin' && !args.pinReady
      ? buttonColors[theme].disabled[variant]
      : buttonColors[theme][variant];
    await expect(main).toBeVisible();
    await expect(main).toHaveCSS('color', asRgb(palette.foreground));
    if (args.state === 'new' || args.state === 'close') {
      await expect(main).toHaveClass('big-circle-button');
      await userEvent.click(main);
      if (args.state === 'new') {
        await expect(button('Set pin and continue')).toBeVisible();
        await expect(button('Cancel pin')).toHaveClass('text-button');
        await userEvent.click(button('Cancel pin'));
        await expect(button('New')).toBeVisible();
        await expect(args.onNew).toHaveBeenCalledTimes(1);
        await expect(args.onCancelPin).toHaveBeenCalledTimes(1);
      } else {
        await expect(button('New')).toBeVisible();
        await expect(args.onClose).toHaveBeenCalledTimes(1);
      }
    } else {
      await expect(main).toHaveClass('text-button');
      await expect(button('Cancel pin')).toHaveClass('text-button');
      if (!args.pinReady) await expect(main).toBeDisabled();
      else {
        await userEvent.click(main);
        await expect(button('Close')).toBeVisible();
        await userEvent.click(button('Close'));
        await expect(args.onSetPin).toHaveBeenCalledTimes(1);
        await expect(args.onClose).toHaveBeenCalledTimes(1);
      }
    }
  },
};

export const New = {};
export const PinSelection = { name: 'Pin selection', args: { state: 'pin' } };
export const PinPending = { name: 'Pin pending', args: { state: 'pin', pinReady: false } };
export const Close = { args: { state: 'close' } };
