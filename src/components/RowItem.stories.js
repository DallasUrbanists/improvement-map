import { expect, fn, userEvent, within } from 'storybook/test';
import RowItem from './RowItem.vue';

export default {
  title: 'BARS/Row Item',
  component: RowItem,
  args: {
    label: 'Row item', subtitle: '', theme: undefined, variant: 'neutral', buttons: [],
    symbolType: 'none', emoji: '', icon: '', onButtonClick: fn(),
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    variant: { control: 'inline-radio', options: ['neutral', 'primary', 'secondary'], description: 'Sets the row background, text and border from the shared app palette.' },
    label: { control: 'text', description: 'Always-visible, left-aligned bold row text.' },
    subtitle: { control: 'text', description: 'Optional secondary line below the label.' },
    buttons: { control: 'object', description: 'Square Icon Buttons rendered at the right. Each item accepts icon, label, optional variant and disabled.' },
    symbolType: { control: 'inline-radio', options: ['none', 'emoji', 'icon', 'checkbox'] },
    emoji: { control: 'text', description: 'Required when symbolType is emoji.' },
    icon: { control: 'text', description: 'Font Awesome solid icon name; required when symbolType is icon.' },
    onButtonClick: { table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'variant', 'label', 'subtitle', 'buttons', 'symbolType', 'emoji', 'icon'] },
    docs: { description: { component: 'Draft. Full-width row styled like Header Bar with optional subtitle, right-side Square Icon Buttons, and an optional leading symbol. When exactly one action is present, its button fills the row hit area and applies its hover, press and focus styles across the row. With multiple actions, buttons remain separate. The symbol has a 12px gap before the label/subtitle block. Set emoji when symbolType is emoji and icon when symbolType is icon. Checkbox renders as an interactive native checkbox. Buttons inherit the row theme and variant unless an item sets its own variant.' } },
  },
  render: (args, { globals }) => ({
    components: { RowItem },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<RowItem v-bind="args" :theme="args.theme || globalTheme" @button-click="args.onButtonClick" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText(args.label).closest('.row-item');
    await expect(row).toBeTruthy();
    await expect(row).toHaveTextContent(args.label);
    const subtitle = row.querySelector('.row-item__subtitle');
    if (args.subtitle) {
      await expect(subtitle).toHaveTextContent(args.subtitle);
    } else await expect(subtitle).toBeNull();
    const symbol = row.querySelector('.row-item__symbol');
    if (args.symbolType === 'none') await expect(symbol).toBeNull();
    if (args.symbolType === 'emoji') {
      await expect(symbol).toHaveTextContent(args.emoji);
      await expect(args.emoji).toBeTruthy();
    }
    if (args.symbolType === 'icon') {
      await expect(symbol).toHaveClass(`fa-${args.icon}`);
      await expect(args.icon).toBeTruthy();
    }
    if (args.symbolType === 'checkbox') {
      const checkbox = canvas.getByRole('checkbox', { name: args.label });
      await expect(checkbox).toBeVisible();
      await userEvent.click(checkbox);
      await expect(checkbox).toBeChecked();
      await userEvent.click(checkbox);
      await expect(checkbox).not.toBeChecked();
    }
    const buttons = Array.from(row.querySelectorAll('.row-item__action'));
    await expect(buttons).toHaveLength(args.buttons.length);
    if (buttons.length === 1) {
      const button = buttons[0];
      const rowRect = row.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      expect(buttonRect.width).toBeCloseTo(rowRect.width, 0);
      expect(buttonRect.height).toBeCloseTo(rowRect.height, 0);
      expect(getComputedStyle(row, '::after').content).not.toBe('none');
      const leading = row.querySelector('.row-item__leading');
      expect(getComputedStyle(leading).zIndex).toBe('1');
      expect(getComputedStyle(leading).pointerEvents).toBe('none');
    }
    for (const [index, item] of args.buttons.entries()) {
      const button = buttons[index];
      await expect(button).toHaveAccessibleName(item.label);
      await expect(button.querySelector('i')).toHaveClass(`fa-${item.icon}`);
      if (item.disabled) await expect(button).toBeDisabled();
      else await userEvent.click(button);
    }
    const enabledCount = args.buttons.filter(item => !item.disabled).length;
    if (buttons.length === 1 && enabledCount) {
      buttons[0].focus();
      await userEvent.keyboard('{Enter}');
      await expect(buttons[0]).toHaveFocus();
    }
    await expect(args.onButtonClick).toHaveBeenCalledTimes(enabledCount + (buttons.length === 1 && enabledCount ? 1 : 0));
    if (!args.buttons.length) await expect(canvas.queryByRole('button')).toBeNull();
  },
};

const buttons = [{ icon: 'bookmark', label: 'Save' }, { icon: 'bars', label: 'Menu' }];
const singleButton = [{ icon: 'bookmark', label: 'Save' }];
export const Plain = { args: { label: 'Plain row', variant: 'neutral' } };
export const With1Button = { name: 'With 1 Button', args: { label: 'Row with one button', buttons: singleButton, variant: 'neutral' } };
export const With2Buttons = { name: 'With 2 Buttons', args: { label: 'Row with two buttons', buttons, variant: 'neutral' } };
export const WithSubtitle = { name: 'With Subtitle', args: { label: 'Row', subtitle: 'A short supporting description', variant: 'neutral' } };
export const ButtonsAndSubtitles = { name: 'Buttons + Subtitles', args: { label: 'Row', subtitle: 'A short supporting description', buttons, variant: 'neutral' } };
export const IconWithButtons = { name: 'Icon w/ Buttons', args: { label: 'Location', symbolType: 'icon', icon: 'location-dot', buttons, variant: 'neutral' } };
export const IconWithSubtitle = { name: 'Icon w/ Subtitle', args: { label: 'Location', subtitle: 'A short supporting description', symbolType: 'icon', icon: 'location-dot', variant: 'neutral' } };
export const IconWithButtonsAndSubtitle = { name: 'Icon w/ Buttons & Subtitle', args: { label: 'Location', subtitle: 'A short supporting description', symbolType: 'icon', icon: 'location-dot', buttons, variant: 'neutral' } };
export const EmojiWithButtons = { name: 'Emoji w/ Buttons', args: { label: 'New idea', symbolType: 'emoji', emoji: '💡', buttons, variant: 'neutral' } };
export const EmojiWithSubtitle = { name: 'Emoji w/ Subtitle', args: { label: 'New idea', subtitle: 'A short supporting description', symbolType: 'emoji', emoji: '💡', variant: 'neutral' } };
export const EmojiWithButtonsAndSubtitle = { name: 'Emoji w/ Buttons & Subtitle', args: { label: 'New idea', subtitle: 'A short supporting description', symbolType: 'emoji', emoji: '💡', buttons, variant: 'neutral' } };
export const CheckboxWithButtons = { name: 'Checkbox w/ Buttons', args: { label: 'Select row', symbolType: 'checkbox', buttons, variant: 'neutral' } };
export const CheckboxWithSubtitle = { name: 'Checkbox w/ Subtitle', args: { label: 'Select row', subtitle: 'A short supporting description', symbolType: 'checkbox', variant: 'neutral' } };
export const CheckboxWithButtonsAndSubtitle = { name: 'Checkbox w/ Buttons & Subtitle', args: { label: 'Select row', subtitle: 'A short supporting description', symbolType: 'checkbox', buttons, variant: 'neutral' } };
