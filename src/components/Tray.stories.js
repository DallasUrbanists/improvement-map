import { expect, userEvent, waitFor, within } from 'storybook/test';
import Tray from './Tray.vue';
import HeaderBar from './HeaderBar.vue';
import Toolbar from './Toolbar.vue';
import ContainedSection from './ContainedSection.vue';
const isTransparent = level => level === null || level === 'transparent';
const surfaceLevelAttribute = level => isTransparent(level) ? 'transparent' : String(level);

const sharedArgs = {
  theme: undefined,
  surfaceLevel: 1,
  open: true,
  maximize: false,
  canDragClose: true,
  canDragOpen: true,
  mediumHeight: 320,
  maxHeight: 520,
};

export default {
  title: 'CONTAINERS/Tray', component: Tray,
  args: sharedArgs,
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'], description: 'Overrides the theme toolbar; when unset, follows it.' },
    surfaceLevel: { control: { type: 'select', labels: { transparent: 'Transparent' } }, options: ['transparent', 0, 1, 2, 3, 4, 5], mapping: { transparent: null }, description: 'Surface background level from 0 (deepest) to 5 (lightest), or transparent.' },
    open: { control: 'boolean', description: 'Whether the tray is open.' },
    maximize: { control: 'boolean', description: 'Open to maxHeight instead of mediumHeight.' },
    canDragClose: { control: 'boolean', description: 'Allow dragging or activating the handle to close an open tray.' },
    canDragOpen: { control: 'boolean', description: 'Allow dragging or activating the handle to open a closed tray.' },
    mediumHeight: { control: { type: 'number', min: 120, max: 900, step: 8 }, description: 'Target open height that leaves room visible above the tray.' },
    maxHeight: { control: { type: 'number', min: 160, max: 1000, step: 8 }, description: 'Target height when maximize is true.' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'surfaceLevel', 'open', 'maximize', 'mediumHeight', 'maxHeight', 'canDragClose', 'canDragOpen'] },
    docs: { story: { inline: false, height: 568 }, description: { component: 'Draft. Full-width panel that slides up from below the viewport and closes by sliding down. It has closed, mediumHeight and maxHeight positions. Drag release snaps to the nearest allowed position; a quick flick moves one position in its direction. maximize selects the maxHeight position. The horizontal handle sits just above the top border; when closed, it remains at the bottom edge only when canDragOpen is enabled. The theme-aware panel uses the shared neutral surface colors and the same dimmed, blurred backdrop as Drawer.' } },
  },
  render: (args, { globals }) => ({
    components: { Tray, HeaderBar, Toolbar },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<Tray v-model:open="args.open" v-model:maximize="args.maximize" :surface-level="args.surfaceLevel" :medium-height="args.mediumHeight" :max-height="args.maxHeight" :can-drag-close="args.canDragClose" :can-drag-open="args.canDragOpen" :theme="args.theme || globalTheme" />',
  }),
};

const verifyOpenTray = async (canvasElement, args) => {
  const canvas = within(canvasElement);
  const tray = canvas.getByRole('complementary', { name: 'Tray' });
  await expect(tray).toHaveAttribute('data-surface-level', surfaceLevelAttribute(args.surfaceLevel));
  await expect(tray).toBeVisible();
  await expect(canvasElement.querySelector('.tray-layer')).toHaveAttribute('data-position', 'medium');
  const expectedMediumHeight = Math.min(args.mediumHeight, args.maxHeight);
  const visibleHeight = canvasElement.ownerDocument.defaultView.innerHeight - tray.getBoundingClientRect().top;
  expect(visibleHeight).toBeCloseTo(expectedMediumHeight, 0);
  const handle = canvasElement.querySelector('.tray__handle');
  await expect(handle).toBeTruthy();
  await userEvent.click(handle);
  await expect(tray).toHaveAttribute('data-open', 'false');
  const openHandle = canvas.getByRole('button', { name: 'Open tray' });
  await expect(openHandle).toBeVisible();
  await userEvent.click(openHandle);
  await expect(tray).toHaveAttribute('data-open', 'true');
  await expect(canvasElement.querySelector('.tray-layer')).toHaveAttribute('data-position', 'medium');
  return { canvas, tray };
};

const flickHandle = async (canvasElement, delta, startPosition) => {
  const trayLayer = canvasElement.querySelector('.tray-layer');
  await waitFor(() => expect(trayLayer).toHaveAttribute('data-position', startPosition));
  const handle = canvasElement.querySelector('.tray__handle');
  const expectedLabel = startPosition === 'closed' ? 'Open tray' : 'Close tray';
  await waitFor(() => expect(handle).toHaveAttribute('aria-label', expectedLabel));
  const y = 300;
  const dispatch = (type, clientY, timeStamp, buttons = 0) => {
    const event = new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons, clientY });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    handle.dispatchEvent(event);
  };
  dispatch('pointerdown', y, 10);
  dispatch('pointermove', y + delta, 12, 1);
  dispatch('pointerup', y + delta, 14);
};

const dragHandleSlowly = async (canvasElement, delta) => {
  const handle = canvasElement.querySelector('.tray__handle');
  const y = 300;
  const dispatch = (type, clientY, timeStamp, buttons = 0) => {
    const event = new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons, clientY });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    handle.dispatchEvent(event);
  };
  dispatch('pointerdown', y, 10);
  dispatch('pointermove', y + delta, 20, 1);
  await new Promise(resolve => setTimeout(resolve, 140));
  dispatch('pointerup', y + delta, 200);
};

const expectPosition = (canvasElement, position) =>
  expect(canvasElement.querySelector('.tray-layer')).toHaveAttribute('data-position', position);

export const WithHeader = {
  name: 'With Header',
  render: (args, { globals }) => ({
    components: { Tray, HeaderBar },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: '<Tray v-model:open="args.open" v-model:maximize="args.maximize" :surface-level="args.surfaceLevel" :medium-height="args.mediumHeight" :max-height="args.maxHeight" :can-drag-close="args.canDragClose" :can-drag-open="args.canDragOpen" :theme="args.theme || globalTheme"><HeaderBar label="Tray" :theme="args.theme || globalTheme" variant="neutral" :buttons="[{ icon: \'xmark\', label: \'Close tray\' }]" @button-click="args.open = false" /></Tray>',
  }),
  play: async ({ canvasElement, args }) => {
    const { canvas, tray } = await verifyOpenTray(canvasElement, args);
    await flickHandle(canvasElement, -24, 'medium');
    await expectPosition(canvasElement, 'max');
    await flickHandle(canvasElement, 24, 'max');
    await expectPosition(canvasElement, 'medium');
    await flickHandle(canvasElement, 24, 'medium');
    await expectPosition(canvasElement, 'closed');
    await flickHandle(canvasElement, -24, 'closed');
    await expectPosition(canvasElement, 'medium');
    await dragHandleSlowly(canvasElement, 80);
    await expectPosition(canvasElement, 'medium');
    await dragHandleSlowly(canvasElement, 180);
    await expectPosition(canvasElement, 'closed');
    await userEvent.click(canvas.getByRole('button', { name: 'Open tray' }));
    await expectPosition(canvasElement, 'medium');
    const headerClose = canvasElement.querySelector('.header-bar .square-icon-button');
    await expect(headerClose).toBeTruthy();
    await expect(headerClose).toBeVisible();
    await userEvent.click(headerClose);
    await expect(tray).toHaveAttribute('data-open', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Open tray' }));
    await expect(tray).toHaveAttribute('data-open', 'true');
  },
};

export const WithToolbar = {
  name: 'With Toolbar',
  render: (args, { globals }) => ({
    components: { Tray, Toolbar, ContainedSection },
    setup: () => ({ args, globalTheme: globals.theme }),
    template: `
      <Tray
        v-model:open="args.open"
        v-model:maximize="args.maximize"
        :surface-level="args.surfaceLevel"
        :medium-height="args.mediumHeight"
        :max-height="args.maxHeight"
        :can-drag-close="args.canDragClose"
        :can-drag-open="args.canDragOpen"
        :theme="args.theme || globalTheme"
      >
        <Toolbar
          :theme="args.theme || globalTheme"
          variant="neutral"
          :leftButtons="[
            { icon: 'arrow-left', label: 'Back' },
            { icon: 'arrow-right', label: 'Next' },
          ]"
          :rightButtons="[
            { icon: 'bookmark', label: 'Save' },
            { icon: 'xmark', label: 'Close tray' },
          ]"
          @button-click="({ button }) => {
            if (button.label === 'Close tray') args.open = false;
          }"
        />
        <ContainedSection :padded="true">
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        </ContainedSection>
      </Tray>
    `,
  }),
  play: async ({ canvasElement, args }) => {
    const { canvas, tray } = await verifyOpenTray(canvasElement, args);
    const toolbar = canvasElement.querySelector('.toolbar');
    await expect(toolbar).toBeTruthy();
    await expect(within(toolbar).getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(within(toolbar).getByRole('button', { name: 'Save' })).toBeVisible();
    for (const button of toolbar.querySelectorAll('button')) {
      await expect(button).toHaveAttribute('data-layout', 'tight');
    }
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Close tray' }));
    await expect(tray).toHaveAttribute('data-open', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Open tray' }));
    await expect(tray).toHaveAttribute('data-open', 'true');
  },
};
