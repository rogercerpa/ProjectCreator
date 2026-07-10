import React from 'react';

const TYPE_HINT = {
  single: 'Select one answer',
  boolean: 'Select one answer',
  multi: 'Select all that apply'
};

const QuestionCard = ({ question, index, selected = [], onChange, submitted }) => {
  const isMulti = question.type === 'multi';

  const toggle = (choiceId) => {
    if (submitted) return;
    if (isMulti) {
      onChange(selected.includes(choiceId)
        ? selected.filter(id => id !== choiceId)
        : [...selected, choiceId]);
    } else {
      onChange([choiceId]);
    }
  };

  const isCorrectChoice = (choice) => !!choice.correct;

  return (
    <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-1">
        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold flex items-center justify-center">
          {index + 1}
        </span>
        <div>
          <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white leading-snug">{question.prompt}</h4>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{TYPE_HINT[question.type] || TYPE_HINT.single}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 pl-9">
        {question.choices.map(choice => {
          const isSelected = selected.includes(choice.id);
          let stateClass = 'border-gray-200 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500';

          if (submitted) {
            if (isCorrectChoice(choice)) {
              stateClass = 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600';
            } else if (isSelected && !isCorrectChoice(choice)) {
              stateClass = 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-600';
            } else {
              stateClass = 'border-gray-200 dark:border-gray-700 opacity-70';
            }
          } else if (isSelected) {
            stateClass = 'border-primary-500 bg-primary-50 dark:bg-primary-900/20';
          }

          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => toggle(choice.id)}
              disabled={submitted}
              className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${stateClass} ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className={`flex-shrink-0 h-4 w-4 border-2 flex items-center justify-center ${isMulti ? 'rounded' : 'rounded-full'} ${isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300 dark:border-gray-500'}`}>
                {isSelected && <span className="h-1.5 w-1.5 bg-white rounded-sm" />}
              </span>
              <span className="text-gray-700 dark:text-gray-200">{choice.text}</span>
              {submitted && isCorrectChoice(choice) && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-medium">Correct</span>}
            </button>
          );
        })}
      </div>

      {submitted && question.explanation && (
        <div className="mt-3 ml-9 rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-gray-700 dark:text-gray-200">Why: </span>{question.explanation}
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
