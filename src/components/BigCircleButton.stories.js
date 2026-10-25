import { expect, fn, userEvent, within } from 'storybook/test';
import BigCircleButton from './BigCircleButton.vue';

export default {
  title: 'BUTTONS/Big Circle Button', component: BigCircleButton,
  args: { icon: 'list-ul', disabled: false, label: 'List', variant: 'neutral', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Color treatment from the shared app palette.' },
    icon: { control: 'select', options: ['list-ul', 'plus', 'bars', 'layer-group', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'] },
    disabled: { control: 'boolean' },
    label: { control: 'text', description: 'Visible button label, accessible name and native hover tooltip.' },
    onClick: { table: { disable: true } },
  },
  parameters: {
    controls: { include: ['variant', 'icon', 'disabled', 'label'] },
    docs: { description: { component: 'Draft. A 72px circular icon-and-label action, composed from MapControlButton. Choose Neutral, Primary or Secondary with the variant control; the shared app palette is documented on Colors. Use the Pseudo states toolbar: no selection = default, hover = hover, active = press, focus-visible = keyboard focus. Floating uses a 4px margin and component shadow.' } },
  },
  render: (args, { globals }) => ({ components: { BigCircleButton }, setup: () => ({ args, globalTheme: globals.theme }), template: '<BigCircleButton v-bind="args" :theme="globalTheme" />' }),
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: args.label });
    await expect(button).toHaveAttribute('title', args.label);
    await expect(button).toHaveTextContent(args.label);
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
export const Floating = { args: { variant: 'neutral', icon: 'list-ul', label: 'List' } };
