import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AppInfoTab from './AppInfoTab';

const completeChecklist = [
  {
    id: 'profile',
    label: 'Complete your user profile',
    help: 'Profile is ready.',
    done: true,
    actionLabel: 'Open User Profile',
    action: jest.fn()
  }
];

const incompleteChecklist = [
  {
    id: 'profile',
    label: 'Complete your user profile',
    help: 'Add your role.',
    done: false,
    actionLabel: 'Open User Profile',
    action: jest.fn()
  }
];

describe('AppInfoTab first-run checklist', () => {
  test('defaults collapsed when all setup items are complete', () => {
    render(<AppInfoTab setupChecklist={completeChecklist} />);

    expect(screen.getByText('Ready to go')).toBeInTheDocument();
    expect(screen.queryByText('Profile is ready.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show'));

    expect(screen.getByText('Profile is ready.')).toBeInTheDocument();
  });

  test('defaults expanded when setup items remain', () => {
    render(<AppInfoTab setupChecklist={incompleteChecklist} />);

    expect(screen.getByText('1 setup item left')).toBeInTheDocument();
    expect(screen.getByText('Add your role.')).toBeInTheDocument();
  });
});
