import React from 'react';
import QuestionEditor from './QuestionEditor';

const newQuestion = () => ({
  type: 'single',
  prompt: '',
  choices: [
    { id: 'a', text: '', correct: true },
    { id: 'b', text: '', correct: false }
  ],
  explanation: ''
});

const QuizEditor = ({ quiz, onChange }) => {
  const questions = quiz?.questions || [];

  const setQuestion = (i, next) => {
    const nextQuestions = questions.slice();
    nextQuestions[i] = next;
    onChange({ questions: nextQuestions });
  };

  const removeQuestion = (i) => onChange({ questions: questions.filter((_, idx) => idx !== i) });

  const moveQuestion = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = questions.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ questions: next });
  };

  const addQuestion = () => onChange({ questions: [...questions, newQuestion()] });

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">No questions yet. Add at least 2 questions for a meaningful quiz.</p>
      )}
      {questions.map((q, i) => (
        <QuestionEditor
          key={i}
          question={q}
          index={i}
          onChange={(next) => setQuestion(i, next)}
          onRemove={() => removeQuestion(i)}
          onMoveUp={() => moveQuestion(i, -1)}
          onMoveDown={() => moveQuestion(i, 1)}
          isFirst={i === 0}
          isLast={i === questions.length - 1}
        />
      ))}
      <button
        type="button"
        onClick={addQuestion}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white"
      >
        + Add question
      </button>
    </div>
  );
};

export default QuizEditor;
