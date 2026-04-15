import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';

jest.mock('../services/FeatureFlagService', () => ({
  isEnabled: jest.fn(() => true)
}));

describe('Sidebar', () => {
  test('renders expanded navigation labels', () => {
    render(
      <Sidebar
        currentView="welcome"
        onViewChange={jest.fn()}
        projectCount={3}
        isCollapsed={false}
        onToggleCollapse={jest.fn()}
      />
    );

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  test('renders collapsed navigation and toggle control', () => {
    const onToggleCollapse = jest.fn();

    render(
      <Sidebar
        currentView="welcome"
        onViewChange={jest.fn()}
        projectCount={3}
        isCollapsed={true}
        onToggleCollapse={onToggleCollapse}
      />
    );

    expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Expand navigation'));
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});
