import { expect, fn, userEvent, within } from 'storybook/test';
import RowButton from './RowButton.vue';

const icons = ['none', 'bars', 'layer-group', 'plus', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'];

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
    await expect(button).toHaveAttribute('title', args.label);
    await expect(button).toHaveTextContent(args.label);
    await expect(button).toHaveAttribute('data-layout', 'tight');
    const buttonBox = button.getBoundingClientRect();
    const parentBox = button.parentElement.getBoundingClientRect();
    expect(buttonBox.width).toBeCloseTo(parentBox.width, 0);
    if (args.icon) {
      const icon = button.querySelector('i');
      await expect(icon).toHaveClass(`fa-${args.icon}`);
      expect(icon.nextElementSibling).toHaveTextContent(args.label);
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
