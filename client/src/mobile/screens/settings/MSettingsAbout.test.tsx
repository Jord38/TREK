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

  it('FE-MOBILE-ABOUT-002: shows the build name instead of the version when there is one', () => {
    render(<MSettingsAbout appVersion="1.2.3" build="1.2.3-fork.4" />);
    expect(screen.getByText('1.2.3-fork.4')).toBeInTheDocument();
    expect(screen.queryByText('v1.2.3')).not.toBeInTheDocument();
  });

  it('FE-MOBILE-ABOUT-003: shows v<version> without a build', () => {
    render(<MSettingsAbout appVersion="1.2.3" />);
    expect(screen.getByText('v1.2.3')).toBeInTheDocument();
  });
});
