import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import Drawer from './Drawer.vue';
import HeaderBar from './HeaderBar.vue';
import RowButton from './RowButton.vue';
import { buttonColors } from '../design/buttonColors.js';

const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;
const isTransparent = level => level === null || level === 'transparent';
const expectedSurface = (theme, level) => isTransparent(level) ? 'rgba(0, 0, 0, 0)' : asRgb(buttonColors[theme].neutralByLevel[level].background);
const surfaceLevelAttribute = level => isTransparent(level) ? 'transparent' : String(level);

export default {
  title: 'CONTAINERS/Drawer', component: Drawer,
  args: { theme: undefined, surfaceLevel: 1, open: true, canDragClose: true, canDragOpen: true, menuItems: [], onMenuItemClick: fn() },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Surface background level from 0 (deepest) to 5 (lightest), or transparent.' },
    side: { control: false, table: { disable: true } },
    open: { control: 'boolean', description: 'Whether the drawer is open.' },
    canDragClose: { control: 'boolean', description: 'Allow dragging or activating the handle to close an open drawer.' },
    canDragOpen: { control: 'boolean', description: 'Allow dragging or activating the handle to open a closed drawer.' },
    menuItems: { control: 'object', description: 'Menu drawer rows. Each item accepts icon, label, disabled and optional variant.' },
    onMenuItemClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'surfaceLevel', 'open', 'canDragClose', 'canDragOpen'] },
    docs: { description: { component: 'Draft. Full-height, 320px maximum-width drawer surface. Each story anchors to its named edge and demonstrates the existing Header Bar With Buttons component at the top, with one xmark action that closes the drawer. The default slot holds drawer content. open controls its position; canDragClose and canDragOpen independently enable close/open gestures. The 12px handle has a 6px grip at half the drawer height; it is white except when the theme is light and the drawer is closed with canDragOpen enabled, when it is black. It fades from 50% opacity to 80% on hover and 100% while dragging. Drag release snaps to the nearer endpoint; a quick flick selects its direction. A closed drawer moves fully off-screen; its handle remains visible only when canDragOpen is enabled. When open, a dimmed, blurred backdrop covers the underlying content.' } },
  },
  render: (args, { globals }) => ({
    components: { Drawer, HeaderBar, RowButton },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<Drawer v-model:open="args.open" :side="args.side" :surface-level="args.surfaceLevel" :can-drag-close="args.canDragClose" :can-drag-open="args.canDragOpen" :theme="args.theme || globalTheme"><HeaderBar label="Drawer" variant="neutral" :theme="args.theme || globalTheme" :buttons="[{ icon: \'xmark\', label: \'Close drawer\' }]" @button-click="args.open = false" /><RowButton v-for="(item, index) in args.menuItems || []" :key="`${item.label}-${index}`" :theme="args.theme || globalTheme" :variant="item.variant || \'neutral\'" :icon="item.icon" :disabled="item.disabled" :label="item.label" @click="args.onMenuItemClick(item, index)" /></Drawer>',
  }),
};

export const SlideFromLeft = {
  name: 'Slide from left',
  args: { side: 'left' },
  play: async ({ canvasElement, globals, args }) => {
    const drawer = within(canvasElement).getByRole('complementary', { name: 'Drawer' });
    const theme = args.theme || globals.theme || 'light';
    await expect(drawer).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
    await expect(window.getComputedStyle(drawer).backgroundColor).toBe(expectedSurface(theme, args.surfaceLevel));
    const shell = canvasElement.querySelector('.drawer-shell');
    await expect(drawer.querySelector('.header-bar')).toHaveTextContent('Drawer');
    await expect(drawer).toBeVisible();
    await waitFor(() => expect(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(window.getComputedStyle(drawer).transform)).toBe(true));
    await expect(window.getComputedStyle(shell).left).toBe('0px');
    const close = canvasElement.querySelector('.drawer__handle');
    const headerClose = canvasElement.querySelector('.header-bar .square-icon-button');
    await expect(headerClose).toBeVisible();
    await userEvent.click(close);
    await expect(drawer).toHaveAttribute('data-open', 'false');
    const open = within(canvasElement).getByRole('button', { name: 'Open drawer' });
    await expect(open).toBeVisible();
    await userEvent.click(open);
    await expect(drawer).toHaveAttribute('data-open', 'true');
    await userEvent.click(headerClose);
    await expect(drawer).toHaveAttribute('data-open', 'false');
  },
};

export const SlideFromRight = {
  name: 'Slide from right',
  args: { side: 'right' },
  play: async ({ canvasElement, globals, args }) => {
    const drawer = within(canvasElement).getByRole('complementary', { name: 'Drawer' });
    const theme = args.theme || globals.theme || 'light';
    await expect(drawer).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
    await expect(window.getComputedStyle(drawer).backgroundColor).toBe(expectedSurface(theme, args.surfaceLevel));
    const shell = canvasElement.querySelector('.drawer-shell');
    await expect(drawer.querySelector('.header-bar')).toHaveTextContent('Drawer');
    await expect(drawer).toBeVisible();
    await waitFor(() => expect(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(window.getComputedStyle(drawer).transform)).toBe(true));
    await expect(window.getComputedStyle(shell).right).toBe('0px');
    const close = canvasElement.querySelector('.drawer__handle');
    const headerClose = canvasElement.querySelector('.header-bar .square-icon-button');
    await expect(headerClose).toBeVisible();
    await userEvent.click(close);
    await expect(drawer).toHaveAttribute('data-open', 'false');
    const open = within(canvasElement).getByRole('button', { name: 'Open drawer' });
    await expect(open).toBeVisible();
    await userEvent.click(open);
    await expect(drawer).toHaveAttribute('data-open', 'true');
    await userEvent.click(headerClose);
    await expect(drawer).toHaveAttribute('data-open', 'false');
  },
};

export const MenuDrawer = {
  name: 'Menu drawer',
  args: {
    side: 'left',
    menuItems: [
      { icon: 'bars', label: 'Browse' },
      { icon: 'map', label: 'Map' },
      { icon: 'bookmark', label: 'Saved' },
      { icon: 'gear', label: 'Settings' },
    ],
  },
  parameters: {
    controls: { include: ['theme', 'surfaceLevel', 'open', 'canDragClose', 'canDragOpen', 'menuItems'] },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const drawer = canvas.getByRole('complementary', { name: 'Drawer' });
    await expect(drawer.querySelector('.header-bar')).toHaveTextContent('Drawer');
    for (const item of args.menuItems) {
      const button = canvas.getByRole('button', { name: item.label });
      await expect(button).toHaveTextContent(item.label);
      if (item.icon) await expect(button.querySelector('i')).toHaveClass(`fa-${item.icon}`);
    }
    if (args.menuItems.length) {
      await userEvent.click(canvas.getByRole('button', { name: args.menuItems[0].label }));
      await expect(args.onMenuItemClick).toHaveBeenCalledWith(args.menuItems[0], 0);
    }
  },
};
