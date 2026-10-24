import { expect, within, waitFor } from 'storybook/test';
import GoogleMap from './GoogleMap.vue';

export default {
  title: 'EMBEDDABLES/Google Map',
  component: GoogleMap,
  args: {
    theme: 'dark',
    style: 'road',
    railsEnabled: true,
    railsThickness: 2,
    width: '100%',
    height: '33vh',
    coverViewport: false,
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'] },
    style: { control: 'inline-radio', options: ['road', 'satellite'] },
    railsEnabled: { control: 'boolean' },
    railsThickness: { control: { type: 'number', min: 1, max: 9, step: 1 } },
    width: { control: 'text', description: 'Any CSS width value; defaults to 100%.' },
    height: { control: 'text', description: 'Any CSS height value; defaults to 33vh.' },
    coverViewport: { control: 'boolean', description: 'Fixes the map edge-to-edge behind other page elements. This does not change surface depth.' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['theme', 'style', 'railsEnabled', 'railsThickness', 'width', 'height', 'coverViewport'] },
    docs: { description: { component: 'Draft. An embeddable, interactive Google Map centered on Dallas. It supports road and satellite map types, the shared rail overlay, explicit dimensions, and an optional fixed full-viewport background. Google Maps credentials are supplied by the host app; the catalog does not embed API keys.' } },
  },
  render: (args) => ({
    components: { GoogleMap },
    setup: () => ({ args }),
    template: '<GoogleMap :theme="args.theme" :map-style="args.style" :rails-enabled="args.railsEnabled" :rails-thickness="args.railsThickness" :width="args.width" :height="args.height" :cover-viewport="args.coverViewport" />',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const map = canvas.getByRole('region', { name: 'Google map of Dallas' });
    await expect(map).toHaveAttribute('data-theme', args.theme);
    await expect(map).toHaveAttribute('data-map-style', args.style);
    await expect(map).toHaveAttribute('data-rails-enabled', String(args.railsEnabled));
    await expect(map).toHaveAttribute('data-rails-thickness', String(args.railsThickness));
    await expect(map).toHaveAttribute('data-cover-viewport', String(args.coverViewport));
    await expect(map.querySelector('.google-map__canvas')).not.toBeNull();
    if (__LOCAL_DEPENDENCY_MODES__.maps === 'mock') {
      await waitFor(() => expect(map.querySelector('[data-local-map="ready"]')).not.toBeNull());
      await waitFor(() => expect(map.querySelectorAll('.gm-style > svg polyline').length).toBeGreaterThan(0));
    }
    const style = window.getComputedStyle(map);
    if (args.coverViewport) {
      await expect(style.position).toBe('fixed');
      await expect(style.zIndex).toBe('0');
    } else {
      await expect(style.width).toBe(args.width === '100%' ? `${canvasElement.clientWidth}px` : args.width);
      await expect(map.style.height).toBe(args.height);
    }
  },
};

export const DarkRoads = { name: 'Dark roads', args: { theme: 'dark', style: 'road' } };
export const LightRoads = { name: 'Light roads', args: { theme: 'light', style: 'road' } };
export const SatelliteFullViewport = {
  name: 'Satellite, full viewport',
  args: { theme: 'dark', style: 'satellite', coverViewport: true },
};
