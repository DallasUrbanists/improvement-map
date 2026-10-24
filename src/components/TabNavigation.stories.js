import { expect, userEvent, within } from 'storybook/test';
import TabNavigation from './TabNavigation.vue';

const tabs = [
  { id: 'overview', label: 'Overview', content: '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero.</p>' },
  { id: 'details', label: 'Details', content: '<p>Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.</p>' },
  { id: 'activity', label: 'Activity', content: '<p>Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta.</p>' },
];

export default {
  title: 'CONTAINERS/Tab Navigation',
  component: TabNavigation,
  args: { theme: undefined, surfaceLevel: 1, padded: true, tabs, selectedIndex: 0 },
  argTypes: {
    theme: { control: false },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Neutral surface depth for the selected tab, section and root background. Other tabs are transparent; the root background is shown at half brightness.' },
    padded: { control: 'boolean', description: 'Whether the selected Contained Section adds interior padding.' },
    tabs: { control: false },
    selectedIndex: { control: false },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['surfaceLevel', 'padded'] },
    docs: { description: { component: 'Draft. A full-width tab container. Its selected tab and Contained Section use the neutral surface at surfaceLevel; the root background uses that surface at half brightness, and other tabs are transparent. The padded control sets interior spacing on the selected Contained Section. Tab definitions provide id, label and HTML content. The selectedIndex model can be controlled by the parent; tab-change emits the selected tab and its index. Tab buttons support Left/Right Arrow and Home/End navigation.' } },
  },
  render: (args, { globals }) => ({
    components: { TabNavigation },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<TabNavigation v-bind="args" v-model:selected-index="args.selectedIndex" :theme="args.theme || globalTheme" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const tablist = canvas.getByRole('tablist', { name: 'Sections' });
    const buttons = within(tablist);
    const firstTab = buttons.getByRole('tab', { name: tabs[0].label });
    const secondTab = buttons.getByRole('tab', { name: tabs[1].label });
    const thirdTab = buttons.getByRole('tab', { name: tabs[2].label });

    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Lorem ipsum');
    if (args.padded) await expect(canvas.getByRole('tabpanel')).toHaveClass(/contained-section--padded/);
    else await expect(canvas.getByRole('tabpanel')).not.toHaveClass(/contained-section--padded/);
    await expect(canvas.getByRole('tabpanel')).toHaveAttribute('data-surface-level', args.surfaceLevel === null ? 'transparent' : String(args.surfaceLevel));
    await secondTab.click();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Sed cursus ante');
    secondTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(thirdTab).toHaveAttribute('aria-selected', 'true');
    await expect(thirdTab).toHaveFocus();
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Duis sagittis ipsum');
    await firstTab.click();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Lorem ipsum');
  },
};

export const AtSurfaceLevel1 = { name: 'At surface level 1', args: { surfaceLevel: 1, selectedIndex: 0 } };
export const AtSurfaceLevel2 = { name: 'At surface level 2', args: { surfaceLevel: 2, selectedIndex: 0 } };
export const AtSurfaceLevel3 = { name: 'At surface level 3', args: { surfaceLevel: 3, selectedIndex: 0 } };
