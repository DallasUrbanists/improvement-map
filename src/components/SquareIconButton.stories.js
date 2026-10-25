import { expect, fn, userEvent, within } from 'storybook/test';
import SquareIconButton from './SquareIconButton.vue';

export default {
  title: 'BUTTONS/Square Icon Button', component: SquareIconButton,
  args: { icon: 'bars', disabled: false, isActive: false, surfaceLevel: 1, label: 'Open menu', variant: 'neutral', layout: 'floating', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Color treatment from the shared app palette.' },
    icon: { control: 'select', options: ['bars', 'layer-group', 'plus', 'xmark', 'magnifying-glass', 'location-crosshairs', 'bookmark', 'arrow-left', 'arrow-right'] },
    disabled: { control: 'boolean' },
    isActive: { control: 'boolean', description: 'Uses the active surface color at surfaceLevel while preserving other interaction feedback.' },
    surfaceLevel: { control: false, table: { disable: true }, description: 'Inherited surface depth used by the active state.' },
    label: { control: 'text', description: 'Accessible name and native hover tooltip. Not visible button text.' },
    layout: { control: false, table: { disable: true } },
    onClick: { table: { disable: true } },
  },
  parameters: {
    controls: { include: ['variant', 'icon', 'disabled', 'isActive', 'label'] },
    docs: { description: { component: 'Draft. A 48px square icon-only action, composed from MapControlButton. Choose Neutral, Primary or Secondary with the variant control; the shared app palette is documented on Colors. label supplies the accessible name and native hover tooltip; no label text is printed. isActive uses the active surface color at the inherited surfaceLevel (default 1), while hover and focus feedback remain available. Use the Pseudo states toolbar: no selection = default, hover = hover, active = press, focus-visible = keyboard focus. Floating uses a 4px margin, 8px corner radius and component shadow. Tight removes the margin, radius and shadow.' } },
  },
  render: (args, { globals }) => ({ components: { SquareIconButton }, setup: () => ({ args, globalTheme: globals.theme }), template: '<SquareIconButton v-bind="args" :theme="globalTheme" />' }),
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: args.label });
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
