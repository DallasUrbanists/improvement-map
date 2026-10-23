import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import MapTray from './MapTray.vue';
export default {
  title: 'REFERENCE/Components/Panels/Map tray', component: MapTray,
  args: { title: 'Browse ideas', open: true, animate: true, scrollable: true, closeDisabled: false, contentDisabled: false, onClose: fn() },
  parameters: { layout: 'fullscreen', docs: { story: { inline: false, height: 640 }, description: { component: 'Draft. Nonmodal workspace region. Place inside a positioned workspace; it uses the production tray clearances. Raw stories use the preview viewport itself, without a workspace wrapper. Props control open, animate, scrollable, closeDisabled and contentDisabled. Emits close and scroll; the owner handles navigation. Slots: header, header-actions, handle, controls, default, footer. Exposes content/element refs for restoration. Busy content is inert; closing can be disabled separately. Retain animation/focus behavior in app integration tests.' } } },
  render: args => ({ components: { MapTray }, setup: () => ({ args }), template: '<MapTray v-bind="args" />' }),
};
export const Default = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('region', { name: 'Browse ideas' })).toBeVisible());
  await userEvent.click(canvas.getByRole('button', { name: 'Close Browse ideas' }));
  await expect(args.onClose).toHaveBeenCalledOnce();
} };
export const Busy = { args: { contentDisabled: true, closeDisabled: true }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole('region')).toHaveAttribute('aria-busy', 'true');
  await expect(canvas.getByRole('button')).toBeDisabled();
  await expect(canvasElement.querySelector('.map-tray-content')).toHaveAttribute('inert');
  await expect(canvasElement.querySelector('.map-tray-content')).not.toHaveAttribute('tabindex');
} };
export const LongContent = { render: args => ({ components: { MapTray }, setup: () => ({ args, content: 'Improve this crossing and connect the neighborhood to the bus stop. '.repeat(180) }), template: '<MapTray v-bind="args">{{ content }}</MapTray>' }) };
export const WithSlots = { render: args => ({ components: { MapTray }, setup: () => ({ args }), template: '<MapTray v-bind="args"><template #controls>Shared controls area</template>Idea list content<template #footer>Optional footer</template></MapTray>' }) };
export const Closed = { args: { open: false } };
export const FixedContent = { args: { scrollable: false }, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('.map-tray-content')).not.toHaveAttribute('tabindex');
} };
