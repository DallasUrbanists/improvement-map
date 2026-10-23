import { ref, watch } from 'vue';
import { expect, userEvent, within } from 'storybook/test';
import BookmarkToggle from './BookmarkToggle.vue';
export default {
  title: 'REFERENCE/Components/Controls/Bookmark toggle', component: BookmarkToggle,
  args: { bookmarked: false, disabled: false },
  parameters: { docs: { description: { component: 'Draft. Stateless save/remove control. Props: bookmarked and disabled. Emits toggle(MouseEvent); update state only after the operation succeeds. Native aria-describedby can link the control to the idea summary. Use BookmarkButton in the app for persistence and its existing changed(button, previousEntry) event.' } } },
  render: args => ({ components: { BookmarkToggle }, setup() { const saved = ref(args.bookmarked); watch(() => args.bookmarked, value => { saved.value = value; }); return { args, saved }; }, template: '<BookmarkToggle :bookmarked="saved" :disabled="args.disabled" @toggle="saved = !saved" />' }),
};
export const Default = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Bookmark idea' }));
  await expect(canvas.getByRole('button', { name: 'Remove bookmark' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(canvas.getByRole('button', { name: 'Remove bookmark' }));
  await expect(canvas.getByRole('button', { name: 'Bookmark idea' })).toHaveAttribute('aria-pressed', 'false');
} };
export const Bookmarked = { args: { bookmarked: true } };
export const Disabled = { args: { disabled: true } };
