import { expect, fn, userEvent, within } from 'storybook/test';
import Toolbar from './Toolbar.vue';

export default {
  title: 'BARS/Toolbar', component: Toolbar,
  args: { variant: 'neutral', buttons: [], buttonType: 'icon', onButtonClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Shared color treatment for each button.' },
    leftButtons: { control: 'object', description: 'Button list for the left side. Each item accepts icon, label and optional disabled.' },
    rightButtons: { control: 'object', description: 'Button list for the right side. Each item accepts icon, label and optional disabled.' },
    buttonType: { control: false, table: { disable: true } },
    onButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['variant', 'leftButtons', 'rightButtons'] },
    docs: { description: { component: 'Draft. Full-width, palette-themed bar with a 1px bottom border, composed from Square Icon Button or Text Button. Buttons always use their Tight treatment: zero margin, corner radius and shadow. Button definitions provide icon, visible or accessible label, and optional disabled state. Activations emit button-click with the selected button and its index.' } },
  },
  render: (args, { globals }) => ({
    components: { Toolbar },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<Toolbar v-bind="args" :theme="globalTheme" @button-click="args.onButtonClick" />',
  }),
  play: async ({ canvasElement, args }) => {
    const leftButtons = within(canvasElement.querySelector('.toolbar__left')).queryAllByRole('button');
    const rightButtons = within(canvasElement.querySelector('.toolbar__right')).queryAllByRole('button');
    await expect(leftButtons).toHaveLength(args.leftButtons.length);
    await expect(rightButtons).toHaveLength(args.rightButtons.length);
    for (const [index, item] of args.leftButtons.entries()) {
      const button = leftButtons[index];
      await expect(button).toHaveAttribute('data-layout', 'tight');
      await expect(button).toHaveAccessibleName(item.label);
      if (args.buttonType === 'text') await expect(button).toHaveTextContent(item.label);
      else await expect(button).toHaveTextContent('');
      if (item.disabled) await expect(button).toBeDisabled();
      else {
        await userEvent.click(button);
        await expect(args.onButtonClick).toHaveBeenLastCalledWith({ button: item, index });
      }
    }
    for (const [index, item] of args.rightButtons.entries()) {
      const button = rightButtons[index];
      await expect(button).toHaveAttribute('data-layout', 'tight');
      await expect(button).toHaveAccessibleName(item.label);
      if (args.buttonType === 'text') await expect(button).toHaveTextContent(item.label);
      else await expect(button).toHaveTextContent('');
      if (item.disabled) await expect(button).toBeDisabled();
      else {
        await userEvent.click(button);
        await expect(args.onButtonClick).toHaveBeenLastCalledWith({ button: item, index });
      }
    }
  },
};

export const AllTextButtons = {
  args: {
    buttonType: 'text', variant: 'neutral',
    leftButtons: [
      { icon: 'plus', label: 'New' },
      { icon: 'location-crosshairs', label: 'Locate' },
      { icon: '', label: 'Browse' },
    ],
    rightButtons: [
      { icon: 'bars', label: 'Menu' },
      { icon: 'magnifying-glass', label: 'Search' },
      { icon: 'bookmark', label: 'Saved' },
    ],
  },
};
