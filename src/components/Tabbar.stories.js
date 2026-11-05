import { expect, fn, userEvent, within } from 'storybook/test';
import Tabbar from './Tabbar.vue';

export default {
  title: 'BARS/Tabbar', component: Tabbar,
  args: { variant: 'neutral', surfaceLevel: 1, buttons: [], selectedIndex: 0, buttonType: 'icon', onButtonClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Shared color treatment for each button.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Neutral surface level used for the tabbar and its regular neutral button colors.' },
    buttons: { control: 'object', description: 'Button list. Each item accepts icon, label, disabled and optional tab selection semantics via isActive.' },
    selectedIndex: { control: false, table: { disable: true } },
    buttonType: { control: false, table: { disable: true } },
    onButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['variant', 'surfaceLevel', 'buttons'] },
    docs: { description: { component: 'Draft. Full-width tab bar with a 1px bottom border, composed from Square Icon Button or Text Button. Buttons always use their Tight treatment: zero margin, corner radius and shadow. Button definitions provide icon, visible or accessible label, and optional disabled and isActive states. surfaceLevel selects the regular neutral button colors; selected buttons do not use an active surface fill. Activations emit button-click with the selected button and its index.' } },
  },
  render: (args, { globals }) => ({
    components: { Tabbar },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<Tabbar v-bind="args" v-model:selected-index="args.selectedIndex" :theme="globalTheme" @button-click="args.onButtonClick" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const tabbar = canvasElement.querySelector('.tabbar');
    await expect(tabbar).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
    const buttons = canvas.queryAllByRole('button');
    await expect(buttons).toHaveLength(args.buttons.length);
    for (const [index, item] of args.buttons.entries()) {
      const button = buttons[index];
      await expect(button).toHaveAttribute('data-layout', 'tight');
      await expect(button).toHaveAccessibleName(item.label);
      await expect(button).toHaveAttribute('data-tabbar-selected', String(index === args.selectedIndex));
      if (args.buttonType === 'text') await expect(button).toHaveTextContent(item.label);
      else await expect(button).toHaveTextContent('');
      if (item.disabled) await expect(button).toBeDisabled();
      else {
        await userEvent.click(button);
        await expect(button).toHaveAttribute('data-tabbar-selected', 'true');
        await expect(args.onButtonClick).toHaveBeenLastCalledWith({ button: item, index });
      }
    }
    await expect(args.onButtonClick).toHaveBeenCalledTimes(args.buttons.filter(button => !button.disabled).length);
  },
};

export const AllIconButtons = {
  args: {
    buttonType: 'icon', variant: 'neutral',
    buttons: [
      { icon: 'bars', label: 'Menu', isActive: true },
      { icon: 'magnifying-glass', label: 'Search' },
      { icon: 'bookmark', label: 'Saved' },
    ],
  },
};

export const AllTextButtons = {
  args: {
    buttonType: 'text', variant: 'neutral',
    buttons: [
      { icon: 'plus', label: 'New', isActive: true },
      { icon: 'location-crosshairs', label: 'Locate' },
      { icon: '', label: 'Browse' },
    ],
  },
};
