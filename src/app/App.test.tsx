import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App workstation shell', () => {
  it('renders the redesigned workstation navigation and prep board copy', () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain('Spectral painting workstation');
    expect(markup).toContain('Painting Prep');
    expect(markup).toContain('Reference Sampler');
    expect(markup).toContain('Active Painting');
  });
});
