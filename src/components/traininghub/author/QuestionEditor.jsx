import React from 'react';

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const BOOLEAN_CHOICES = () => [
  { id: 'true', text: 'True', correct: true },
  { id: 'false', text: 'False', correct: false }
];

const QuestionEditor = ({ question, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const choices = question.choices || [];

  const setType = (type) => {
    if (type === 'boolean') {
      onChange({ ...question, type, choices: BOOLEAN_CHOICES() });
    } else {
      onChange({ ...question, type });
    }
  };

  const setChoice = (i, patch) => {
    const next = choices.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...question, choices: next });
  };

  const toggleCorrect = (i) => {
    if (question.type === 'multi') {
      setChoice(i, { correct: !choices[i].correct });
    } else {
      // single / boolean: exactly one correct
      onChange({ ...question, choices: choices.map((c, idx) => ({ ...c, correct: idx === i })) });
    }
  };

  const addChoice = () => {
    const id = String.fromCharCode(97 + choices.length);
    onChange({ ...question, choices: [...choices, { id, text: '', correct: false }] });
  };

  const removeChoice = (i) => {
    onChange({ ...question, choices: choices.filter((_, idx) => idx !== i) });
  };

  const isBoolean = question.type === 'boolean';
  const isMulti = question.type === 'multi';

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-semibold flex items-center justify-center">{index + 1}</span>
        <select value={question.type} onChange={(e) => setType(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200">
          <option value="single">Single choice</option>
          <option value="multi">Multi select</option>
          <option value="boolean">True / False</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst} className="px-2 py-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30" title="Move up">↑</button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className="px-2 py-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30" title="Move down">↓</button>
          <button type="button" onClick={onRemove} className="px-2 py-1 text-red-400 hover:text-red-600" title="Remove question">🗑</button>
        </div>
      </div>

      <textarea
        value={question.prompt || ''}
        onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        rows={2}
        placeholder="Question prompt…"
        className={`${inputClass} mb-3`}
      />

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
        {isMulti ? 'Tick all correct answers' : 'Tick the one correct answer'}
      </p>
      <div className="space-y-2">
        {choices.map((choice, i) => (
          <div key={choice.id || i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(i)}
              title="Mark correct"
              className={`flex-shrink-0 h-6 w-6 flex items-center justify-center border-2 ${isMulti ? 'rounded' : 'rounded-full'} ${choice.correct ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 dark:border-gray-500 text-transparent'}`}
            >
              ✓
            </button>
            <input
              value={choice.text || ''}
              onChange={(e) => setChoice(i, { text: e.target.value })}
              placeholder={`Choice ${i + 1}`}
              disabled={isBoolean}
              className={inputClass}
            />
            {!isBoolean && choices.length > 2 && (
              <button type="button" onClick={() => removeChoice(i)} className="px-1.5 text-red-400 hover:text-red-600" title="Remove choice">✕</button>
            )}
          </div>
        ))}
      </div>

      {!isBoolean && (
        <button type="button" onClick={addChoice} className="mt-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">+ Add choice</button>
      )}

      <textarea
        value={question.explanation || ''}
        onChange={(e) => onChange({ ...question, explanation: e.target.value })}
        rows={2}
        placeholder="Explanation shown after answering (optional)"
        className={`${inputClass} mt-3`}
      />
    </div>
  );
};

export default QuestionEditor;
