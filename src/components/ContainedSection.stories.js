import { expect, within } from 'storybook/test';
import ContainedSection from './ContainedSection.vue';
import { buttonColors } from '../design/buttonColors.js';

const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;
const isTransparent = level => level === null || level === 'transparent';
const expectedSurface = (theme, level) => isTransparent(level) ? 'rgba(0, 0, 0, 0)' : asRgb(buttonColors[theme].neutralByLevel[level].background);
const surfaceLevelAttribute = level => isTransparent(level) ? 'transparent' : String(level);

const sampleContent = '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero.</p><p>Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.</p>';

export default {
  title: 'CONTAINERS/Contained Section',
  component: ContainedSection,
  args: { theme: undefined, surfaceLevel: 1, padded: true, content: sampleContent },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Surface background level from 0 (deepest) to 5 (lightest), or transparent.' },
    padded: { control: 'boolean', description: 'Adds 12px of padding around the content.' },
    content: { control: 'text', description: 'HTML content rendered inside the section.' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'surfaceLevel', 'padded', 'content'] },
    docs: { description: { component: 'Draft. A generic full-width section for content inside another container. It has a 1px bottom border unless it is the last child of its container.' } },
  },
  render: (args, { globals }) => ({
    components: { ContainedSection },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<ContainedSection v-bind="args" :theme="args.theme || globalTheme" />',
  }),
  play: async ({ canvasElement, args, globals }) => {
    const section = within(canvasElement).getByText(/Lorem ipsum/).parentElement;
    const theme = args.theme || globals.theme || 'light';
    await expect(section).toHaveClass('contained-section');
    await expect(section).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
    await expect(window.getComputedStyle(section).backgroundColor).toBe(expectedSurface(theme, args.surfaceLevel));
    await expect(section.classList.contains('contained-section--padded')).toBe(args.padded);
    await expect(section.querySelectorAll('p')).toHaveLength(2);
    await expect(window.getComputedStyle(section).width).toBe(`${canvasElement.clientWidth}px`);
  },
};

export const WithPadding = { name: 'With padding', args: { padded: true } };
export const WithoutPadding = { name: 'Without padding', args: { padded: false } };
