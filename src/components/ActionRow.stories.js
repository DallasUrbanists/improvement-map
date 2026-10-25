import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import { ref } from 'vue';
import ActionRow from './ActionRow.vue';
import { buttonColors } from '../design/buttonColors.js';
import { surfaceColors } from '../design/surfaceColors.js';

export default {
  title: 'BARS/Action Row',
  component: ActionRow,
  args: {
    action: {
      key: 'sample-action', summary: 'Document crossing and sidewalk conditions',
      description: 'A description shown only in the details dialog.',
      instructions: 'Record missing curb ramps and visibility issues from a safe public location.',
      reason: 'Specific observations help explain barriers to walking.',
      status: 'suggested', sourceUrl: '',
    },
    saved: false, hidden: false, surfaceLevel: 1, onSave: fn(), onHide: fn(),
  },
  argTypes: {
    action: { control: 'object', description: 'Summary is the only row text. Other action details appear in the dialog.' },
    saved: { control: 'boolean' }, hidden: { control: 'boolean' },
    surfaceLevel: { control: 'select', options: [null, 0, 1, 2, 3, 4, 5] },
    onSave: { table: { disable: true } }, onHide: { table: { disable: true } },
  },
  parameters: { docs: { description: { component: 'Draft. Full wrapping summary and independent bookmark/eye-slash controls, without thumbnails or photos. Clicking anywhere on the row outside the controls opens Action details. Saved rows use the active surface; hidden rows shown for review use 75% opacity, italic summary text and omit Save. Save/Hide emit the native click event; persistence belongs to the consumer. Icon labels appear as hover or keyboard-focus tooltips. Theme follows the global toolbar.' } } },
  render: (args, { globals }) => ({
    components: { ActionRow },
    setup() {
      const saved = ref(args.saved), hidden = ref(args.hidden);
      return { args, saved, hidden, theme: globals.theme,
        save: event => { saved.value = !saved.value; args.onSave(event); },
        hide: event => { hidden.value = !hidden.value; if (hidden.value) saved.value = false; args.onHide(event); },
      };
    },
    template: '<ActionRow :action="args.action" :theme="theme" :surface-level="args.surfaceLevel" :saved="saved" :hidden="hidden" @save="save" @hide="hide" />',
  }),
  play: async ({ canvasElement, args, globals }) => {
    const canvas = within(canvasElement), page = within(canvasElement.ownerDocument.body);
    const summaryLabel = `${args.hidden ? '(Hidden action) ' : ''}${args.action.summary.trim()}`;
    const opener = canvas.getByRole('button', { name: summaryLabel, exact: true });
    await userEvent.hover(opener);
    await expect(window.getComputedStyle(opener).cursor).toBe('pointer');
    await expect(canvas.getByText(summaryLabel, { exact: true })).toBeVisible();
    await expect(canvas.queryByText(args.action.description)).toBeNull();
    await expect(canvas.queryByText(args.action.instructions)).toBeNull();
    const summary = canvasElement.querySelector('.action-row-summary');
    await expect(summary.scrollHeight).toBeLessThanOrEqual(summary.clientHeight + 1);
    await expect(summary.scrollWidth).toBeLessThanOrEqual(summary.clientWidth + 1);
    const row = canvasElement.querySelector('.action-row');
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
    const neutralBackground = args.surfaceLevel === null ? 'transparent' : buttonColors[globals.theme].neutralByLevel[args.surfaceLevel].background;
    const activeBackground = args.surfaceLevel === null ? 'transparent' : surfaceColors[globals.theme].active[`level${args.surfaceLevel}`];
    await expect(window.getComputedStyle(row).opacity).toBe(args.hidden ? '0.75' : '1');
    await expect(window.getComputedStyle(summary).fontStyle).toBe(args.hidden ? 'italic' : 'normal');
    await expect(row.style.getPropertyValue('--action-row-background')).toBe(args.saved && !args.hidden ? activeBackground : neutralBackground);
    const save = args.hidden ? null : canvas.getByRole('button', { name: args.saved ? 'Unsave' : 'Save', exact: true });
    if (save) {
      await userEvent.click(save);
      await expect(args.onSave).toHaveBeenCalledTimes(1);
      await expect(save).toHaveAttribute('aria-pressed', String(!args.saved));
      await expect(save).toHaveFocus();
      await expect(row.style.getPropertyValue('--action-row-background')).toBe(args.saved ? neutralBackground : activeBackground);
    } else await expect(canvas.queryByRole('button', { name: 'Save', exact: true })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: args.hidden ? 'Unhide' : 'Hide', exact: true }));
    await expect(args.onHide).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.getComputedStyle(row).opacity).toBe(args.hidden ? '1' : '0.75'));
    await expect(window.getComputedStyle(summary).fontStyle).toBe(args.hidden ? 'normal' : 'italic');
    await expect(canvas.getByText(`${args.hidden ? '' : '(Hidden action) '}${args.action.summary.trim()}`, { exact: true })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Save', exact: true }) !== null).toBe(args.hidden);
    if (!args.hidden) await expect(row.style.getPropertyValue('--action-row-background')).toBe(neutralBackground);
    await expect(page.queryByRole('dialog', { name: 'Action details' })).toBeNull();
    opener.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await page.findByRole('dialog', { name: 'Action details' });
    await expect(within(dialog).getByText(args.action.description)).toBeVisible();
    await expect(within(dialog).getByText(args.action.instructions)).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close Action details' }));
    await waitFor(() => expect(opener).toHaveFocus());
  },
};
const sample = { key: 'sample-action', summary: 'Request a safer pedestrian crossing', description: 'Review the proposed location and access needs.', instructions: 'Include the location and explain the crossing concerns.', reason: 'Make the walking connection easier to review.', status: 'suggested', sourceUrl: '' };
export const Recommended = {};
export const LongSummary = { args: { action: { ...sample, summary: 'Create a safer and more accessible walking connection between the neighborhood, the bus stop, and the grocery store, including accessible curb ramps and improved visibility at every crossing. '.repeat(3) } } };
export const Saved = { args: { saved: true } };
export const Hidden = { args: { hidden: true } };
