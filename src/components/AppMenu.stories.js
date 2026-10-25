import { expect, userEvent, within } from 'storybook/test';
import AppMenu from './AppMenu.vue';

export default {
  title: 'MENUS/App Menu',
  component: AppMenu,
  args: { theme: undefined, surfaceLevel: 1, open: true },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null } },
    open: { control: 'boolean', description: 'Whether the menu drawer is open.' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'surfaceLevel', 'open'] },
    docs: { description: { component: 'Draft. App menu composition with a left-side Drawer, plain Idea Map Header Bar with a close action, and linked Menu Items for saved ideas, saved actions, the welcome guide, What’s new, and map settings.' } },
  },
  render: (args, { globals }) => ({
    components: { AppMenu },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<AppMenu v-model:open="args.open" :theme="args.theme || globalTheme" :surface-level="args.surfaceLevel" />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const drawer = canvas.getByRole('complementary', { name: 'Drawer' });
    await expect(canvasElement.querySelector('.drawer-shell--from-left')).toBeTruthy();
    await expect(drawer.querySelector('.header-bar')).toHaveTextContent('Idea Map');
    const labels = ['Saved ideas', 'Saved actions', 'Welcome guide', "What's new", 'Map settings'];
    const links = Array.from(drawer.querySelectorAll('.menu-item__link'));
    await expect(links).toHaveLength(labels.length);
    for (const [index, label] of labels.entries()) {
      await expect(links[index]).toHaveAccessibleName(label);
      await expect(links[index].closest('.menu-item')).toHaveTextContent(label);
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Close menu' }));
    await expect(drawer).toHaveAttribute('data-open', 'false');
  },
};

export const Default = {};
