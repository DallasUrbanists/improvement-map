import { expect, userEvent, within } from 'storybook/test';
import BrowseFixture from './support/BrowseFixture.vue';
export default {
  title: 'REFERENCE/Screens/Browse/List', component: BrowseFixture,
  args: { state: 'populated' },
  argTypes: { state: { control: 'select', options: ['populated', 'loading', 'empty', 'error', 'location-denied'] } },
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Draft. Renders the production BrowseView with an injected fixture workspace and in-memory bookmark/storage aliases. No map SDK, API calls, geolocation prompt, or application storage access. Sorting controls update fixture state; they do not simulate distance calculations. Routing, actual sorting, history and persistence remain application-test responsibilities. Use this composition to review tray/list layout and feedback together.' } } },
};
export const Populated = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getAllByRole('listitem')).toHaveLength(8);
  await userEvent.click(canvas.getAllByRole('button', { name: 'Bookmark idea' })[0]);
  await expect(canvas.getByRole('button', { name: 'Remove bookmark' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(canvas.getByRole('button', { name: 'Nearest to me' }));
  await expect(canvas.getByRole('button', { name: 'Nearest to me' })).toHaveAttribute('aria-pressed', 'true');
} };
export const Loading = { args: { state: 'loading' } };
export const Empty = { args: { state: 'empty' } };
export const ErrorWithRetry = { args: { state: 'error' }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Retry', exact: true }));
  await expect(canvas.getAllByRole('listitem')).toHaveLength(8);
} };
export const LocationDenied = { args: { state: 'location-denied' } };
