import { http, HttpResponse } from 'msw';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../tests/helpers/msw/server';
import { render, screen, within } from '../../tests/helpers/render';
import WhatsNewPage from './WhatsNewPage';

vi.mock('../components/Layout/Navbar', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navbar' }),
}));

const OLDER = {
  id: 'older',
  date: '2030-01-05',
  title: 'Older made-up change',
  items: [{ kind: 'fixed', text: 'A fixed thing.' }],
};
const NEWER = {
  id: 'newer',
  date: '2030-03-09',
  title: 'Newer made-up change',
  items: [
    { kind: 'added', text: 'An added thing.' },
    { kind: 'changed', text: 'A changed thing.' },
  ],
};

describe('WhatsNewPage', () => {
  it('FE-PAGE-WHATSNEW-001: lists the entries in the order the server sends them, with title and date', async () => {
    server.use(http.get('/api/fork-changelog', () => HttpResponse.json({ entries: [NEWER, OLDER] })));
    render(<WhatsNewPage />);
    const titles = await screen.findAllByRole('heading', { level: 2 });
    expect(titles.map((h) => h.textContent)).toEqual(['Newer made-up change', 'Older made-up change']);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    const first = screen.getAllByRole('article')[0];
    expect(within(first).getByText(/2030/)).toBeInTheDocument();
    expect(within(first).getByText(/Mar/)).toBeInTheDocument();
  });

  it('FE-PAGE-WHATSNEW-002: labels every item with its kind', async () => {
    server.use(http.get('/api/fork-changelog', () => HttpResponse.json({ entries: [NEWER, OLDER] })));
    render(<WhatsNewPage />);
    const [newer, older] = await screen.findAllByRole('article');
    expect(within(newer).getByText('Added')).toBeInTheDocument();
    expect(within(newer).getByText('An added thing.')).toBeInTheDocument();
    expect(within(newer).getByText('Changed')).toBeInTheDocument();
    expect(within(newer).getByText('A changed thing.')).toBeInTheDocument();
    expect(within(older).getByText('Fixed')).toBeInTheDocument();
  });

  it('FE-PAGE-WHATSNEW-003: shows the empty state when there are no entries', async () => {
    server.use(http.get('/api/fork-changelog', () => HttpResponse.json({ entries: [] })));
    render(<WhatsNewPage />);
    expect(await screen.findByText('Nothing new to show yet.')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('FE-PAGE-WHATSNEW-004: shows the error state when the load fails', async () => {
    server.use(http.get('/api/fork-changelog', () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    render(<WhatsNewPage />);
    expect(await screen.findByText("Couldn't load what's new")).toBeInTheDocument();
    expect(screen.queryByText('Nothing new to show yet.')).toBeNull();
  });
});
