import { expect, within } from 'storybook/test';
import ContainedSection from './ContainedSection.vue';
import FloatingModal from './FloatingModal.vue';
const isTransparent = level => level === null || level === 'transparent';
const surfaceLevelAttribute = level => isTransparent(level) ? 'transparent' : String(level);

const sections = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  content: `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Section ${index + 1} demonstrates the modal's independently scrolling content.</p><p>Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.</p>`,
}));

export default {
  title: 'CONTAINERS/Floating Modal',
  component: FloatingModal,
  args: {
    surfaceLevel: 5,
    open: true,
    formFactor: 'tall',
    blocking: false,
    position: 'center',
    label: 'Floating Modal',
    subtitle: 'Scrollable content stays beneath the header',
    headerButtons: [],
    footerButtons: [],
    sections,
  },
  argTypes: {
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Surface background level from 0 (deepest) to 5 (lightest), or transparent.' },
    open: { control: 'boolean', description: 'Controls whether the modal is rendered; the component defaults to closed.' },
    formFactor: { control: 'inline-radio', options: ['tall', 'full'], description: 'Tall leaves room above the modal; full fills the viewport with an 8px inset.' },
    blocking: { control: 'boolean', description: 'Adds a blurred backdrop and traps focus until the modal closes.' },
    position: { control: 'inline-radio', options: ['left', 'center', 'right'], description: 'Horizontal viewport position for the tall form factor.' },
    label: { control: false },
    subtitle: { control: false },
    headerButtons: { control: false, description: 'Tight Text Button or Square Icon Button props. Each entry has type `text` or `icon`.' },
    footerButtons: { control: false, description: 'Tight, neutral Text Button props rendered in equal-width columns.' },
    sections: { control: false },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['surfaceLevel', 'open', 'formFactor', 'blocking', 'position'] },
    docs: { description: { component: 'Draft. A floating modal with tall and full viewport form factors, optional blocking backdrop and focus trap, mixed header actions, a fixed Header Bar, independently scrolling content, and an optional sticky footer.' } },
  },
  render: (args, { globals }) => ({
    components: { FloatingModal, ContainedSection },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<FloatingModal v-bind="args" v-model:open="args.open" :theme="globalTheme" @close="args.onClose" @header-button-click="args.onHeaderButtonClick" @footer-button-click="args.onFooterButtonClick"><ContainedSection v-for="section in args.sections" :key="section.id" :theme="globalTheme" :surface-level="args.surfaceLevel" :padded="true" :content="section.content" /></FloatingModal>',
  }),
};

const checkModal = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  const modal = canvas.getByRole('dialog', { name: args.label });
  const header = canvas.getByRole('banner');
  const content = modal.querySelector('.floating-modal__content');
  await expect(modal).toHaveClass(`floating-modal--${args.position}`);
  await expect(modal).toHaveClass(`floating-modal--${args.formFactor}`);
  await expect(modal).toHaveAttribute('aria-modal', args.blocking ? 'true' : 'false');
  await expect(modal).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
  // Explicit component contract: the panel has a solid border on every side.
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    await expect(parseFloat(window.getComputedStyle(modal)[`border${side}Width`])).toBeGreaterThan(0);
    await expect(window.getComputedStyle(modal)[`border${side}Style`]).toBe('solid');
  }
  await expect(header).toHaveTextContent(args.label);
  await expect(header).toHaveTextContent(args.subtitle);
  await expect(modal.querySelectorAll('.contained-section')).toHaveLength(args.sections.length);
  for (const section of modal.querySelectorAll('.contained-section')) {
    await expect(section).toHaveClass('contained-section--padded');
  }
  await expect(window.getComputedStyle(content).overflowY).toBe('auto');
  return modal;
};

export const TallCenterNonBlocking = {
  name: 'Tall, center, non-blocking',
  args: { formFactor: 'tall', position: 'center', blocking: false, surfaceLevel: 1 },
  play: async context => {
    const modal = await checkModal(context);
    const box = modal.getBoundingClientRect();
    await expect(Math.abs(box.left + box.width / 2 - window.innerWidth / 2)).toBeLessThanOrEqual(1);
    await expect(box.top).toBe(64);
    await expect(box.width).toBeLessThanOrEqual(1024);
    await expect(context.canvasElement.querySelector('.floating-modal__backdrop')).toBeNull();
  },
};

export const FullBlockingFooter = {
  name: 'Full, blocking, footer buttons',
  args: {
    formFactor: 'full',
    blocking: true,
    footerButtons: [{ label: 'Cancel' }, { label: 'Save' }],
  },
  play: async context => {
    const modal = await checkModal(context);
    const box = modal.getBoundingClientRect();
    await expect(box.top).toBe(8);
    await expect(box.left).toBe(8);
    await expect(box.right).toBe(window.innerWidth - 8);
    await expect(box.bottom).toBe(window.innerHeight - 8);
    await expect(context.canvasElement.querySelector('.floating-modal__backdrop')).not.toBeNull();
    await expect(modal.querySelectorAll('.floating-modal__footer .text-button')).toHaveLength(2);
  },
};

export const FullBlockingHeaderFooter = {
  name: 'Full, blocking, header and footer buttons',
  args: {
    formFactor: 'full',
    blocking: true,
    headerButtons: [{ type: 'icon', icon: 'arrow-left', label: 'Back' }],
    footerButtons: [{ label: 'Continue' }],
  },
  play: async context => {
    const modal = await checkModal(context);
    const header = modal.querySelector('.floating-modal__header');
    const back = within(header).getByRole('button', { name: 'Back' });
    const close = within(header).getByRole('button', { name: 'Close' });
    await expect(back.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect(modal.querySelectorAll('.floating-modal__footer .text-button')).toHaveLength(1);
  },
};
