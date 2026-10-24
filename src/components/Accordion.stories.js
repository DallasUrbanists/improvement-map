import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import Accordion from './Accordion.vue';
import { textColors } from '../design/textColors.js';
import { buttonColors } from '../design/buttonColors.js';

const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;
const isTransparent = level => level === null || level === 'transparent';
const expectedSurface = (theme, level) => isTransparent(level) ? 'rgba(0, 0, 0, 0)' : asRgb(buttonColors[theme].neutralByLevel[level].background);
const surfaceLevelAttribute = level => isTransparent(level) ? 'transparent' : String(level);

const paragraph = '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero.</p>';

export default {
  title: 'CONTAINERS/Accordion',
  component: Accordion,
  args: {
    theme: undefined,
    surfaceLevel: 1,
    locked: false,
    open: true,
    header: { label: 'Accordion section', variant: 'neutral', subtitle: '', buttons: [] },
    headerTextButton: null,
    padded: true,
    content: paragraph,
    onHeaderButtonClick: fn(),
    onHeaderTextButtonClick: fn(),
  },
  argTypes: {
    theme: { control: false },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Surface background level from 0 (deepest) to 5 (lightest), or transparent.' },
    locked: { control: 'boolean', description: 'Prevents opening or closing through the caret; header actions remain usable.' },
    open: { control: false, description: 'Story state, not a user-facing control.' },
    header: { control: false },
    headerTextButton: { control: false },
    padded: { control: false },
    content: { control: false },
    onHeaderButtonClick: { table: { disable: true } },
    onHeaderTextButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['surfaceLevel', 'locked'] },
    docs: { description: { component: 'Draft. Composes a tight Square Icon Button caret, a Header Bar with its bottom border removed, and a Contained Section. The optional header Text Button is an independent action, so it remains clickable when the accordion is locked.' } },
  },
  render: (args, { globals }) => ({
    components: { Accordion },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<Accordion v-bind="args" v-model:open="args.open" :theme="args.theme || globalTheme" @header-button-click="args.onHeaderButtonClick" @header-text-button-click="args.onHeaderTextButtonClick" />',
  }),
};

export const WithSimpleHeader = {
  name: 'With simple header',
  args: {
    open: true,
    header: { label: 'About this place', variant: 'neutral', subtitle: '', buttons: [] },
    content: paragraph,
  },
  play: async ({ canvasElement, globals, args }) => {
    const canvas = within(canvasElement);
    const accordion = canvasElement.querySelector('.accordion');
    const theme = args.theme || globals.theme || 'light';
    await expect(accordion).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
    await expect(window.getComputedStyle(accordion).backgroundColor).toBe(expectedSurface(theme, args.surfaceLevel));
    await expect(window.getComputedStyle(accordion).borderTopWidth).toBe('1px');
    await expect(window.getComputedStyle(accordion).borderBottomWidth).toBe('1px');
    await expect(window.getComputedStyle(accordion).transition).toContain('background-color');
    const header = canvas.getByRole('banner');
    await expect(header).toHaveTextContent('About this place');
    await expect(window.getComputedStyle(header).borderBottomWidth).toBe('0px');
    await expect(canvas.getByText(/Lorem ipsum/)).toBeVisible();
    const caret = canvas.getByRole('button', { name: 'Collapse About this place' });
    await expect(window.getComputedStyle(caret).borderLeftWidth).toBe('0px');
    await expect(window.getComputedStyle(caret).borderRightWidth).toBe('0px');
    await userEvent.click(caret);
    await waitFor(() => expect(window.getComputedStyle(accordion).backgroundColor).toBe('rgba(0, 0, 0, 0)'));
    await waitFor(() => expect(canvas.queryByText(/Lorem ipsum/)).toBeNull());
    await expect(canvas.getByRole('button', { name: 'Expand About this place' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Expand About this place' }));
    await waitFor(() => expect(canvas.getByText(/Lorem ipsum/)).toBeVisible());
  },
};

export const TextButtonInHeader = {
  name: 'Text button in header',
  args: {
    open: true,
    header: { label: 'About this place', variant: 'neutral', subtitle: '', buttons: [] },
    headerTextButton: { label: 'Edit', icon: '', variant: 'primary' },
    content: paragraph,
    onHeaderTextButtonClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }));
    await expect(args.onHeaderTextButtonClick).toHaveBeenCalledTimes(1);
    await expect(canvas.getByText(/Lorem ipsum/)).toBeVisible();
  },
};

export const Locked = {
  args: {
    locked: true,
    open: false,
    header: { label: 'Unavailable section', variant: 'neutral', subtitle: '', buttons: [] },
    content: paragraph,
  },
  play: async ({ canvasElement, globals, args }) => {
    const canvas = within(canvasElement);
    const accordion = canvasElement.querySelector('.accordion');
    const caret = canvas.getByRole('button', { name: 'Expand Unavailable section' });
    const theme = args.theme || globals.theme || 'light';
    await expect(caret).toHaveAttribute('aria-disabled', 'true');
    await expect(accordion).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
    await expect(window.getComputedStyle(accordion).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(window.getComputedStyle(caret).borderTopWidth).toBe('0px');
    await expect(window.getComputedStyle(caret).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(window.getComputedStyle(caret.querySelector('i')).color).toBe(asRgb(textColors.muted[theme].neutral.level1));
    await userEvent.click(caret);
    await expect(canvas.queryByText(/Lorem ipsum/)).toBeNull();
  },
};

export const LockedWithButton = {
  name: 'Locked with button',
  args: {
    locked: true,
    open: false,
    header: { label: 'Unavailable section', variant: 'neutral', subtitle: '', buttons: [] },
    headerTextButton: { label: 'Learn more', icon: '', variant: 'primary' },
    content: paragraph,
    onHeaderTextButtonClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Expand Unavailable section' }));
    await expect(canvas.queryByText(/Lorem ipsum/)).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Learn more' }));
    await expect(args.onHeaderTextButtonClick).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByText(/Lorem ipsum/)).toBeNull();
  },
};
