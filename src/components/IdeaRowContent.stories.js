import { expect, fn, userEvent, within } from 'storybook/test';
import { ref, watch } from 'vue';
import IdeaRowContent from './IdeaRowContent.vue';
import BookmarkToggle from './BookmarkToggle.vue';
import { idea } from '../../stories/support/fixtures.js';


export default {
  title: 'BARS/Idea row',
  component: IdeaRowContent,
  args: {
    id: idea.id,
    summary: idea.content.summary,
    photo: idea.content.photos[0].url,
    emoji: idea.emoji,
    addressText: 'Elm Street, Dallas, TX',
    dateText: 'Oct 1',
    distanceText: idea._formattedDistance,
    variant: 'neutral',
    surfaceLevel: 1,
    bookmarked: false,
    onBookmarkToggle: fn(),
  },
  argTypes: {
    id: { control: 'text', description: 'Idea identifier used in the suggestion route.' },
    summary: { control: 'text', description: 'Bold idea title; clamped to two lines.' },
    photo: { control: 'text', description: 'Optional photo URL. An empty or failed photo uses the emoji fallback when available.' },
    emoji: { control: 'text', description: 'Optional emoji used as the full thumbnail fallback, and as a small photo badge when a photo is present.' },
    addressText: { control: 'text', description: 'Formatted address shown on one truncated line.' },
    dateText: { control: 'text', description: 'Formatted creation date.' },
    distanceText: { control: 'text', description: 'Optional distance appended after the date.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Sets row background, text and border from the shared app palette.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Neutral row surface depth.' },
    bookmarked: { control: 'boolean', description: 'Preview state for the bookmark action.' },
    onBookmarkToggle: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['variant', 'surfaceLevel', 'id', 'summary', 'photo', 'emoji', 'addressText', 'dateText', 'distanceText', 'bookmarked'] },
    docs: { description: { component: 'Draft. Full-width BARS item with thumbnail, two-line bold summary, single-line address, date/distance metadata and a bookmark action. Requires a ul parent and Vue Router. Theme and variant match Header Bar and Row Item. id, summary, photo, emoji, addressText, dateText and distanceText are presentation props; address/date are formatted by the consumer. The bookmark slot receives summaryId for aria-describedby. Missing or failed photos use the idea emoji as a full-thumbnail fallback, or a camera glyph when no emoji is available. The app IdeaRow adapter keeps workspace formatting and persisted bookmarks.' } },
  },
  render: (args, { globals }) => ({
    components: { IdeaRowContent, BookmarkToggle },
    setup() {
      const bookmarked = ref(args.bookmarked);
      watch(() => args.bookmarked, value => { bookmarked.value = value; });
      const toggleBookmark = () => {
        bookmarked.value = !bookmarked.value;
        args.onBookmarkToggle(bookmarked.value);
      };
      return { args, globalTheme: globals.theme, bookmarked, toggleBookmark };
    },
    // li requires a semantic list host; it adds no visual treatment.
    template: '<ul class="idea-list"><IdeaRowContent :id="args.id" :summary="args.summary" :photo="args.photo" :emoji="args.emoji" :address-text="args.addressText" :date-text="args.dateText" :distance-text="args.distanceText" :theme="globalTheme" :variant="args.variant" :surface-level="args.surfaceLevel"><template #bookmark="{ summaryId }"><BookmarkToggle :bookmarked="bookmarked" :aria-describedby="summaryId" @toggle="toggleBookmark" /></template></IdeaRowContent></ul>',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvasElement.querySelector('.idea-row');
    const link = canvas.getByRole('link');
    const bookmark = canvas.getByRole('button', { name: args.bookmarked ? 'Remove bookmark' : 'Bookmark idea' });
    const computed = element => window.getComputedStyle(element);
    await expect(row).toBeTruthy();
    await expect(row).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
    await expect(link).toHaveAttribute('href', `/suggestion/${encodeURIComponent(args.id)}`);
    await expect(bookmark).toHaveAttribute('aria-describedby', row.querySelector('.idea-summary').id);
    const image = row.querySelector('.idea-thumbnail img');
    if (args.photo) await expect(image).toBeTruthy();
    else if (args.emoji) await expect(row.querySelector('.idea-thumbnail-fallback')).toHaveTextContent(args.emoji);
    else await expect(row.querySelector('.idea-thumbnail .fa-camera')).toBeTruthy();
    if (args.photo && args.emoji) await expect(row.querySelector('.idea-emoji')).toHaveTextContent(args.emoji);
    if (args.photo === 'data:image/png;base64,invalid') {
      const failedImage = row.querySelector('.idea-thumbnail img');
      if (failedImage && !failedImage.complete) await new Promise(resolve => failedImage.addEventListener('error', resolve, { once: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
      await expect(row.querySelector('.idea-thumbnail img')).toBeNull();
      await expect(row.querySelector('.idea-thumbnail-fallback')).toHaveTextContent(args.emoji);
    }
    await userEvent.tab();
    await expect(link).toHaveFocus();
    // Keyboard focus must have a visible indicator; its decorative color may change.
    await expect(computed(link).outlineStyle).not.toBe('none');
    await expect(parseFloat(computed(link).outlineWidth)).toBeGreaterThan(0);
    await userEvent.click(bookmark);
    await expect(canvas.getByRole('button', { name: args.bookmarked ? 'Bookmark idea' : 'Remove bookmark' })).toHaveAttribute('aria-pressed', String(!args.bookmarked));
    await expect(args.onBookmarkToggle).toHaveBeenCalledWith(!args.bookmarked);
  },
};

export const Default = {};
export const LongContent = { args: { summary: 'Create a safer, more accessible connection between the neighborhood, the bus stop, and the nearby grocery store'.repeat(2), addressText: 'A very long neighborhood address in the Dallas metropolitan area'.repeat(2) } };
export const NoPhoto = { args: { photo: '' } };
// A local invalid image is intentional; no third-party request is made.
export const BrokenPhoto = { args: { photo: 'data:image/png;base64,invalid' } };
export const MissingAddress = { args: { addressText: '' } };
