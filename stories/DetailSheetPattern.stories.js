import { ref } from 'vue';
import { expect, userEvent, within } from 'storybook/test';
import DetailSheet from '../src/components/DetailSheet.vue';
import MapControlButton from '../src/components/MapControlButton.vue';
export default {
  title: 'REFERENCE/Patterns/Detail sheet with opener', component: DetailSheet,
  parameters: { docs: { story: { inline: false, height: 720 }, description: { component: 'Draft integration example. The opener is a separate MapControlButton, not part of DetailSheet. This pattern preserves keyboard and focus-restoration coverage while REFERENCE/Components/Panels/Detail sheet shows only the raw sheet.' } } },
  render: () => ({ components: { DetailSheet, MapControlButton }, setup: () => ({ open: ref(false) }), template: '<MapControlButton @click="open = true">Open details</MapControlButton><DetailSheet title="Idea details" v-model="open" />' }),
};
export const OpenAndClose = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole('button', { name: 'Open details' });
  await userEvent.click(trigger);
  await expect(body.getByRole('dialog', { name: 'Idea details' })).toBeVisible();
  await expect(body.getByRole('button', { name: 'Close Idea details' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
  await expect(trigger).toHaveFocus();
} };
export const Open = { play: async ({ canvasElement }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open details' })); } };
