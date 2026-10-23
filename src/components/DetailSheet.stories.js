import { ref, watch } from 'vue';
import { expect, within } from 'storybook/test';
import DetailSheet from './DetailSheet.vue';
export default {
  title: 'REFERENCE/Components/Panels/Detail sheet', component: DetailSheet,
  args: { title: 'Idea details', modelValue: true },
  parameters: { docs: { story: { inline: false, height: 720 }, description: { component: 'Draft. Modal native dialog teleported to body. Required title provides its accessible name; v-model controls visibility. Default slot mounts only while open; footer is optional. Escape, outside click, and close request update:modelValue(false). Use MapTray for nonmodal workspace content. Stories render only the sheet; REFERENCE/Patterns/Detail sheet with opener demonstrates focus restoration. Interactions query the document because the dialog is teleported.' } } },
  render: args => ({ components: { DetailSheet }, setup() { const open = ref(args.modelValue); watch(() => args.modelValue, value => { open.value = value; }); return { args, open }; }, template: '<DetailSheet v-bind="args" v-model="open" />' }),
};
export const Open = { play: async ({ canvasElement }) => {
  await expect(within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Idea details' })).toBeVisible();
} };
export const Closed = { args: { modelValue: false } };
export const WithSlots = { render: args => ({ components: { DetailSheet }, setup() { const open = ref(args.modelValue); watch(() => args.modelValue, value => { open.value = value; }); return { args, open }; }, template: '<DetailSheet v-bind="args" v-model="open">A safer crossing connects the bus stop and neighborhood.<template #footer>Optional actions</template></DetailSheet>' }) };
