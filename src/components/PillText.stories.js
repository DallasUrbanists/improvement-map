import { expect, fn, userEvent, within } from 'storybook/test';
import { reactive } from 'vue';
import PillText from './PillText.vue';

const sizes = ['small', 'regular', 'large'];
const variants = ['neutral', 'primary', 'secondary'];
const choices = [1, 2, 3];

export default {
  title: 'BUTTONS/Pill text',
  component: PillText,
  args: { size: 'regular', variant: 'neutral', label: 'Pill text', selectable: false, onclick: undefined },
  argTypes: {
    size: { control: 'inline-radio', options: sizes, description: 'Text size relative to the inherited font size.' },
    variant: { control: 'inline-radio', options: variants, description: 'Color treatment from the shared app palette.' },
    label: { control: 'text' },
    selectable: { control: 'boolean', description: 'Tracks selected state when clicked.' },
    onclick: { control: false, table: { disable: true } },
    selected: { control: false, table: { disable: true } },
    'onUpdate:selected': { control: false, table: { disable: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['size', 'variant', 'label', 'selectable'] },
    docs: { description: { component: 'Draft. A compact, rounded text label in the Neutral, Primary or Secondary palette. Size is 0.75em, 1em or 1.5em relative to its parent. Supplying onclick renders a native button; without it the pill is a span. Selectable pills track and expose their selected state, and can bind `selected` for exclusive groups. Theme follows the global toolbar.' } },
  },
};

const renderSizes = (args, { globals }) => ({
  components: { PillText },
  setup: () => ({ args, globalTheme: globals.theme, sizes }),
  template: '<PillText v-for="size in sizes" :key="size" :size="size" :variant="args.variant" :label="size" :selectable="args.selectable" :theme="globalTheme" />',
});

export const Neutral = {
  args: { variant: 'neutral', selectable: false },
  render: renderSizes,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const size of sizes) {
      const pill = canvas.getByText(size);
      await expect(pill).toHaveAttribute('data-size', size);
      await expect(pill.tagName).toBe('SPAN');
    }
  },
};

export const Primary = { args: { variant: 'primary', selectable: false }, render: renderSizes };
export const Secondary = { args: { variant: 'secondary', selectable: false }, render: renderSizes };

export const Clickable = {
  args: { onclick: fn() },
  render: (args, { globals }) => ({
    components: { PillText },
    setup: () => ({ args, globalTheme: globals.theme, variants }),
    template: '<PillText v-for="variant in variants" :key="variant" :variant="variant" :label="variant" :onclick="args.onclick" :theme="globalTheme" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    for (const variant of variants) {
      const pill = canvas.getByRole('button', { name: variant });
      expect(getComputedStyle(pill).backgroundImage).not.toBe('none');
      await userEvent.click(pill);
    }
    await expect(args.onclick).toHaveBeenCalledTimes(variants.length);
  },
};

export const Selectable = {
  args: { selectable: true, onclick: fn() },
  render: (args, { globals }) => {
    const selectedByVariant = reactive({ neutral: null, primary: null, secondary: null });
    const updateSelection = (variant, choice, selected) => {
      if (selected) selectedByVariant[variant] = choice;
      else if (selectedByVariant[variant] === choice) selectedByVariant[variant] = null;
    };
    return {
      components: { PillText },
      setup: () => ({ args, globalTheme: globals.theme, variants, choices, selectedByVariant, updateSelection }),
      template: `
        <template v-for="variant in variants" :key="variant">
          <p>
            <PillText
              v-for="choice in choices"
              :key="variant + '-' + choice"
              :variant="variant"
              size="regular"
              :label="variant + ' ' + choice"
              :selectable="args.selectable"
              :onclick="args.onclick"
              :selected="selectedByVariant[variant] === choice"
              :theme="globalTheme"
              @update:selected="updateSelection(variant, choice, $event)"
            />
          </p>
        </template>
      `,
    };
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selection = Object.fromEntries(variants.map(variant => [variant, null]));
    const getPill = (variant, choice) => canvas.getByRole('button', { name: `${variant} ${choice}` });
    const expectSelection = async () => {
      for (const variant of variants) {
        for (const choice of choices) {
          const pill = getPill(variant, choice);
          const selected = selection[variant] === choice;
          await expect(getPill(variant, choice)).toHaveAttribute(
            'aria-pressed',
            String(selected),
          );
          expect(getComputedStyle(pill).backgroundImage === 'none').toBe(!selected);
        }
      }
    };

    // Each variant group is exclusive, and selection in one group leaves the others alone.
    await expectSelection();
    const firstVariant = variants[0];
    for (const choice of choices) {
      await userEvent.click(getPill(firstVariant, choice));
      await userEvent.unhover(getPill(firstVariant, choice));
      selection[firstVariant] = choice;
      await expectSelection();
    }
    for (const variant of variants.slice(1)) {
      const choice = choices[0];
      await userEvent.click(getPill(variant, choice));
      await userEvent.unhover(getPill(variant, choice));
      selection[variant] = choice;
      await expectSelection();
    }
    // Clicking the selected pill again clears its selection.
    const lastChoice = choices[choices.length - 1];
    await userEvent.click(getPill(firstVariant, lastChoice));
    selection[firstVariant] = null;
    await expectSelection();
    await expect(args.onclick).toHaveBeenCalledTimes(choices.length + variants.length);
  },
};
