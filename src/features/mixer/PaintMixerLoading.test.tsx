import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaintMixerLoading } from './PaintMixerLoading';

describe('PaintMixerLoading', () => {
  it('renders the painterly loading copy', () => {
    const markup = renderToStaticMarkup(<PaintMixerLoading />);

    expect(markup).toContain('Mixing spectral swatches…');
    expect(markup).toContain('result feels deliberate');
  });
});
