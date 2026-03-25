import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App workstation shell', () => {
  it('renders the compact control strip navigation and project controls', () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain('Paint Mix Matcher');
    expect(markup).toContain('Paint');
    expect(markup).toContain('Mixer');
    expect(markup).toContain('Projects');
    expect(markup).toContain('My Paints');
    expect(markup).toContain('Save');
    expect(markup).not.toContain('Current project status');
    expect(markup).not.toContain('Project notes');
  });
});
