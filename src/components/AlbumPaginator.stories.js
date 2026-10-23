import { ref, watch } from 'vue';
import { expect, userEvent, within } from 'storybook/test';
import AlbumPaginator from './AlbumPaginator.vue';
export default {
  title: 'REFERENCE/Components/Navigation/Album paginator', component: AlbumPaginator,
  args: { index: 0, total: 3, label: 'Idea navigation', itemLabel: 'idea' },
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Draft. Previous/next navigation for an ordered collection. index is zero-based; total is nonnegative. Required label names the group; itemLabel names each action. Emits previous/next; the parent updates index. Empty and edge states disable unavailable navigation. buttonClass is the existing consumer styling hook; prefer the default. Does not fetch data or change routes. Stories use fullscreen layout with no preview card, extra canvas spacing or width constraint; the divider, internal spacing and button styling belong to the component.' } } },
  render: args => ({ components: { AlbumPaginator }, setup() { const current = ref(args.index); watch(() => args.index, value => { current.value = value; }); return { args, current }; }, template: '<AlbumPaginator v-bind="args" :index="current" @previous="current--" @next="current++" />' }),
};
export const First = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole('button', { name: 'Previous idea' })).toBeDisabled();
  await userEvent.click(canvas.getByRole('button', { name: 'Next idea' }));
  await expect(canvas.getByText('2 / 3')).toBeVisible();
  // Exercise both directions, then leave this visual example at its named state.
  await userEvent.click(canvas.getByRole('button', { name: 'Previous idea' }));
  await expect(canvas.getByText('1 / 3')).toBeVisible();
  await expect(canvas.getByRole('button', { name: 'Previous idea' })).toBeDisabled();
  await expect(canvas.getByRole('button', { name: 'Next idea' })).toBeEnabled();
} };
export const Middle = { args: { index: 1 } };
export const Last = { args: { index: 2 } };
export const Empty = { args: { total: 0 }, play: async ({ canvasElement }) => {
  for (const button of within(canvasElement).getAllByRole('button')) await expect(button).toBeDisabled();
} };
