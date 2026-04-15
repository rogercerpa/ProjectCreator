import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AssistantPanel from './AssistantPanel';

describe('AssistantPanel', () => {
  const baseProps = {
    isWelcomeView: true,
    isLoading: false,
    status: 'ready',
    context: {
      type: 'project',
      label: 'Project Context',
      detail: 'Alpha Medical Tower'
    },
    scopeMode: 'page',
    draftMessage: '',
    messages: [],
    onDraftChange: jest.fn(),
    onSubmit: jest.fn(),
    onNewChat: jest.fn(),
    onClose: jest.fn(),
    onScopeChange: jest.fn(),
    onPromptSelect: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders context-aware prompt starters', () => {
    render(<AssistantPanel {...baseProps} />);

    expect(screen.getByText('Project Creator AI')).toBeInTheDocument();
    expect(screen.getByText('Project Context')).toBeInTheDocument();
    expect(screen.getByText('What is the current status of this project?')).toBeInTheDocument();
  });

  test('invokes prompt callback when starter is selected', () => {
    render(<AssistantPanel {...baseProps} />);

    fireEvent.click(screen.getByText('What is the current status of this project?'));
    expect(baseProps.onPromptSelect).toHaveBeenCalledWith('What is the current status of this project?');
  });

  test('renders assistant sources for grounded responses', () => {
    render(
      <AssistantPanel
        {...baseProps}
        messages={[
          {
            id: 'assistant-1',
            role: 'assistant',
            timestamp: '9:30 AM',
            sections: [{ title: 'Project summary', content: 'Alpha Medical Tower is in progress.' }],
            sources: [{ type: 'project', title: 'Alpha Medical Tower', snippet: 'Matched saved project record.' }]
          }
        ]}
      />
    );

    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha Medical Tower').length).toBeGreaterThan(0);
  });
});
