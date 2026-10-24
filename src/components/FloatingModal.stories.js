import { expect, userEvent, within } from 'storybook/test';
import ContainedSection from './ContainedSection.vue';
import FloatingModal from './FloatingModal.vue';
import { buttonColors } from '../design/buttonColors.js';

const asRgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;
const isTransparent = level => level === null || level === 'transparent';
const expectedSurface = (theme, level) => isTransparent(level) ? 'rgba(0, 0, 0, 0)' : asRgb(buttonColors[theme].neutralByLevel[level].background);
const surfaceLevelAttribute = level => isTransparent(level) ? 'transparent' : String(level);

const sections = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  content: `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Section ${index + 1} demonstrates the modal's independently scrolling content.</p><p>Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.</p>`,
}));

export default {
  title: 'CONTAINERS/Floating Modal',
  component: FloatingModal,
  args: {
    theme: undefined,
    surfaceLevel: 5,
    open: true,
    position: 'center',
    label: 'Floating Modal',
    subtitle: 'Scrollable content stays beneath the header',
    sections,
  },
  argTypes: {
    theme: { control: false },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Surface background level from 0 (deepest) to 5 (lightest), or transparent.' },
    open: { control: 'boolean', description: 'Controls whether the modal is rendered; the component defaults to closed.' },
    position: { control: 'inline-radio', options: ['left', 'center', 'right'], description: 'Horizontal viewport position.' },
    label: { control: false },
    subtitle: { control: false },
    sections: { control: false },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['surfaceLevel', 'open', 'position'] },
    docs: { description: { component: 'Draft. A floating, full-height modal with 4px viewport margins, 8px rounded corners, a fixed Header Bar, and independently scrolling Contained Sections.' } },
  },
  render: (args, { globals }) => ({
    components: { FloatingModal, ContainedSection },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<FloatingModal v-bind="args" v-model:open="args.open" :theme="args.theme || globalTheme" @close="args.onClose"><ContainedSection v-for="section in args.sections" :key="section.id" :theme="args.theme || globalTheme" :surface-level="args.surfaceLevel" :padded="true" :content="section.content" /></FloatingModal>',
  }),
};

const checkModal = async ({ canvasElement, args, globals }) => {
  const canvas = within(canvasElement);
  const modal = canvas.getByRole('dialog', { name: args.label });
  const header = canvas.getByRole('banner');
  const content = modal.querySelector('.floating-modal__content');
  await expect(modal).toHaveClass(`floating-modal--${args.position}`);
  const theme = args.theme || globals.theme || 'light';
  await expect(modal).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
  await expect(window.getComputedStyle(modal).backgroundColor).toBe(expectedSurface(theme, args.surfaceLevel));
  await expect(modal).toHaveStyle({ maxWidth: '1024px', borderRadius: '8px' });
  await expect(header).toHaveTextContent(args.label);
  await expect(header).toHaveTextContent(args.subtitle);
  await expect(modal.querySelectorAll('.contained-section')).toHaveLength(args.sections.length);
  for (const section of modal.querySelectorAll('.contained-section')) {
    await expect(section).toHaveClass('contained-section--padded');
  }
  await expect(window.getComputedStyle(content).overflowY).toBe('auto');
  await expect(window.getComputedStyle(header).flexShrink).toBe('0');
  return { canvas, modal };
};

export const CenterPosition = {
  name: 'Center position',
  args: { position: 'center' },
  play: async context => {
    const { canvas, modal } = await checkModal(context);
    const box = modal.getBoundingClientRect();
    await expect(Math.abs(box.left + box.width / 2 - window.innerWidth / 2)).toBeLessThanOrEqual(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};

export const LeftPosition = { name: 'Left position', args: { position: 'left' }, play: checkModal };
export const RightPosition = { name: 'Right position', args: { position: 'right' }, play: checkModal };
