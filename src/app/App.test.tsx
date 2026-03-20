import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App workstation shell', () => {
  it('renders the simplified navigation', () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain('Artist-native spectral painting workflow');
    expect(markup).toContain('Prep');
    expect(markup).toContain('Paint');
    expect(markup).toContain('Mixer');
    expect(markup).toContain('Projects');
    expect(markup).toContain('My Paints');
  });
});
