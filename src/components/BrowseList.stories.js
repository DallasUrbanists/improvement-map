import { expect, fn, userEvent, within } from 'storybook/test';
import { ref } from 'vue';
import BrowseList from './BrowseList.vue';
import { idea } from '../../stories/support/fixtures.js';

const items = [
  {
    id: idea.id,
    summary: idea.content.summary,
    photo: idea.content.photos[0].url,
    emoji: idea.emoji,
    addressText: 'Elm Street, Dallas, TX',
    dateText: 'Oct 1',
    distanceText: '0.2 mi',
    bookmarked: false,
  },
  {
    id: 'shade-2',
    summary: 'Add shade and seating near the bus stop',
    photo: '',
    emoji: '🌳',
    addressText: 'Commerce Street, Dallas, TX',
    dateText: 'Sep 28',
    distanceText: '0.5 mi',
    bookmarked: true,
  },
];

export default {
  title: 'MENUS/Browse List',
  component: BrowseList,
  args: { items, theme: undefined, variant: 'neutral', surfaceLevel: 1, open: true, sortIndex: 0, onBookmarkToggle: fn(), onIdeaClick: fn(), onSortChange: fn(), onClose: fn() },
  argTypes: {
    items: { control: 'object', description: 'Browse rows with item text, optional image/emoji, and bookmark state.' },
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Shared row surface and text treatment.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Surface level passed to the modal, header, Tab Navigation, and neutral idea rows.' },
    open: { control: 'boolean', description: 'Whether the Floating Modal is open.' },
    sortIndex: { control: false, table: { disable: true } },
    onBookmarkToggle: { table: { disable: true } },
    onIdeaClick: { table: { disable: true } },
    onSortChange: { table: { disable: true } },
    onClose: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'variant', 'surfaceLevel', 'items', 'open'] },
    docs: { description: { component: 'Draft. Browse ideas presented inside a Floating Modal. The modal Header Bar includes its close action; Tab Navigation provides the Newest/Nearby tabs and wraps the semantic idea list in its unpadded Contained Section. surfaceLevel controls the neutral surface colors of the modal, header, Tab Navigation and idea rows. Each item supplies its display fields and bookmark state; the parent updates bookmark state in response to bookmark-toggle. Row navigation emits idea-click, while sortIndex is controllable and sort-change reports the selected sort.' } },
  },
  render: (args, { globals }) => ({
    components: { BrowseList },
    setup: () => {
      const storyItems = ref(args.items.map(item => ({ ...item })));
      function onBookmarkToggle(payload) {
        args.onBookmarkToggle(payload);
        storyItems.value = storyItems.value.map(item => item.id === payload.item.id
          ? { ...item, bookmarked: payload.bookmarked }
          : item);
      }
      return { args, globalTheme: globals.theme, storyItems, onBookmarkToggle };
    },
    template: '<BrowseList v-bind="args" :items="storyItems" v-model:open="args.open" v-model:sort-index="args.sortIndex" :theme="args.theme || globalTheme" @bookmark-toggle="onBookmarkToggle" @idea-click="args.onIdeaClick" @sort-change="args.onSortChange" @close="args.onClose" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const modal = canvas.getByRole('dialog', { name: 'Browse ideas' });
    await expect(modal.querySelector('.tab-navigation')).toBeTruthy();
    await expect(modal.querySelector('.header-bar')).toHaveTextContent('Browse ideas');
    await expect(modal.querySelector('.header-bar')).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
    await expect(within(modal).getByRole('button', { name: 'Close' })).toBeVisible();
    const newestTab = within(modal).getByRole('tab', { name: 'Newest' });
    const nearbyTab = within(modal).getByRole('tab', { name: 'Nearby' });
    await expect(newestTab).toHaveAttribute('aria-selected', 'true');
    await nearbyTab.click();
    await expect(nearbyTab).toHaveAttribute('aria-selected', 'true');
    await expect(args.onSortChange).toHaveBeenCalledWith({ sort: 'nearby', index: 1 });
    await expect(modal.querySelector('.tabbar')).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
    const list = canvas.getByRole('list');
    const section = modal.querySelector('.contained-section');
    await expect(section).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
    await expect(section).not.toHaveClass(/contained-section--padded/);
    const rows = list.querySelectorAll('.idea-row');
    await expect(rows).toHaveLength(args.items.length);
    for (const [index, item] of args.items.entries()) {
      const row = rows[index];
      const link = row.querySelector('.idea-row-link');
      const bookmark = within(row).getByRole('button', { name: item.bookmarked ? 'Remove bookmark' : 'Bookmark idea' });
      await expect(link).toHaveAttribute('href', `/suggestion/${encodeURIComponent(item.id)}`);
      await expect(row).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
      await userEvent.click(bookmark);
      await expect(args.onBookmarkToggle).toHaveBeenCalledWith({ item, bookmarked: !item.bookmarked });
      await expect(bookmark).toHaveAttribute('aria-pressed', String(!item.bookmarked));
    }
  },
};

export const Default = {};
export const Empty = { args: { items: [] } };
