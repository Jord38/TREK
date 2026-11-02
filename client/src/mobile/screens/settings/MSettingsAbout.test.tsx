import { describe, expect, it } from 'vitest';
import { render, screen } from '../../../../tests/helpers/render';
import MSettingsAbout from './MSettingsAbout';

describe('MSettingsAbout', () => {
  it("FE-MOBILE-ABOUT-001: links to the what's new page inside the app", () => {
    render(<MSettingsAbout appVersion="1.2.3" />);
    const link = screen.getByText("What's new").closest('a');
    expect(link).toHaveAttribute('href', '/whats-new');
    expect(link).not.toHaveAttribute('target');
  });
});
