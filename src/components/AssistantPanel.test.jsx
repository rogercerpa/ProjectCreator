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
    onScopeChange: jest.fn(),
    onPromptSelect: jest.fn(),
    onSourceSelect: jest.fn()
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
            sources: [{
              type: 'project',
              title: 'Alpha Medical Tower',
              snippet: 'Matched saved project record.',
              action: { type: 'open-project', entityId: 'project-1', view: 'project-management' }
            }]
          }
        ]}
      />
    );

    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha Medical Tower').length).toBeGreaterThan(0);
    expect(screen.getByText('Open project')).toBeInTheDocument();
  });

  test('shows response generation mode badge for assistant message', () => {
    render(
      <AssistantPanel
        {...baseProps}
        messages={[
          {
            id: 'assistant-2',
            role: 'assistant',
            timestamp: '9:31 AM',
            sections: [{ title: 'Project summary', content: 'Grounded summary.' }],
            sources: [],
            meta: {
              generationMode: 'grounded-ai-polished',
              reason: 'Local runtime ready'
            }
          }
        ]}
      />
    );

    expect(screen.getByText('AI rewrite')).toBeInTheDocument();
  });

  test('renders clickable buttons for referenced projects and fires onSourceSelect', () => {
    render(
      <AssistantPanel
        {...baseProps}
        messages={[
          {
            id: 'assistant-refs',
            role: 'assistant',
            timestamp: '10:00 AM',
            sections: [{ title: null, content: 'Two projects match: NYU Bobst Library and EMORY PERFORMING ARTS CENTER.' }],
            sources: [],
            referencedProjects: [
              { id: 'nyu', projectName: 'NYU Bobst Library', rfaNumber: '306687-0' },
              { id: 'emory', projectName: 'EMORY PERFORMING ARTS CENTER', rfaNumber: '301944-3' }
            ]
          }
        ]}
      />
    );

    expect(screen.getByText('Open referenced projects')).toBeInTheDocument();
    expect(screen.getByText('NYU Bobst Library')).toBeInTheDocument();
    expect(screen.getByText('EMORY PERFORMING ARTS CENTER')).toBeInTheDocument();

    fireEvent.click(screen.getByText('NYU Bobst Library'));
    expect(baseProps.onSourceSelect).toHaveBeenCalledWith(expect.objectContaining({
      type: 'project',
      title: 'NYU Bobst Library',
      action: expect.objectContaining({ type: 'open-project', entityId: 'nyu' })
    }));
  });

  test('renders clickable buttons for referenced agencies', () => {
    render(
      <AssistantPanel
        {...baseProps}
        messages={[
          {
            id: 'assistant-agency-refs',
            role: 'assistant',
            timestamp: '10:05 AM',
            sections: [{ title: null, content: 'Smith Agency is the rep.' }],
            sources: [],
            referencedProjects: [],
            referencedAgencies: [
              { id: 'agency-1', agencyName: 'Smith Agency', agencyNumber: 'A-22' }
            ]
          }
        ]}
      />
    );

    expect(screen.getByText('Open referenced agencies')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Smith Agency'));
    expect(baseProps.onSourceSelect).toHaveBeenCalledWith(expect.objectContaining({
      type: 'agency',
      action: expect.objectContaining({ type: 'open-agency', entityId: 'agency-1' })
    }));
  });

  test('calls source selection callback when source action button is clicked', () => {
    render(
      <AssistantPanel
        {...baseProps}
        messages={[
          {
            id: 'assistant-3',
            role: 'assistant',
            timestamp: '9:32 AM',
            sections: [{ title: 'Project summary', content: 'Grounded summary.' }],
            sources: [{
              type: 'project',
              title: 'Alpha Medical Tower',
              snippet: 'Matched saved project record.',
              action: { type: 'open-project', entityId: 'project-1', view: 'project-management' }
            }]
          }
        ]}
      />
    );

    fireEvent.click(screen.getByText('Open project'));
    expect(baseProps.onSourceSelect).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Alpha Medical Tower',
      action: expect.objectContaining({ type: 'open-project' })
    }));
  });
});
