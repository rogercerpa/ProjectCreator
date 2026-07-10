import React, { useState, useEffect } from 'react';
import LessonBlock from './components/LessonBlock';
import QuestionCard from './components/QuestionCard';
import { levelLabel, levelBadgeClass } from './utils';

const { electronAPI } = window;

const gradeQuiz = (questions, answers) => {
  let correct = 0;
  questions.forEach(q => {
    const selected = new Set(answers[q.id] || []);
    const correctIds = new Set(q.choices.filter(c => c.correct).map(c => c.id));
    const isRight = selected.size === correctIds.size && [...selected].every(id => correctIds.has(id));
    if (isRight) correct += 1;
  });
  const total = questions.length || 1;
  return { correct, total: questions.length, score: Math.round((correct / total) * 100) };
};

const CoursePlayer = ({ courseId, catalogCourse, courseOverride = null, previewMode = false, onExit, onCompleted }) => {
  const [course, setCourse] = useState(courseOverride || null);
  const [loading, setLoading] = useState(!courseOverride);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState('lessons'); // lessons | quiz | results
  const [lessonIndex, setLessonIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (courseOverride) {
      setCourse(courseOverride);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    electronAPI.trainingHubGetCourse(courseId)
      .then(res => {
        if (!active) return;
        if (res?.success) {
          setCourse(res.course);
        } else {
          setError(res?.error || 'Failed to load course');
        }
      })
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseId, courseOverride]);

  const questions = course?.quiz?.questions || [];
  const passScore = course?.passScore ?? 80;

  const allAnswered = questions.length > 0 && questions.every(q => (answers[q.id] || []).length > 0);

  const handleSubmitQuiz = async () => {
    const graded = gradeQuiz(questions, answers);
    setSubmitted(true);

    let saved = null;
    if (!previewMode) {
      const attempt = {
        score: graded.score,
        passScore,
        courseVersion: course.version || catalogCourse?.version || 1,
        category: course.category || catalogCourse?.category,
        total: graded.total,
        correct: graded.correct
      };
      try {
        saved = await electronAPI.trainingHubSubmitAttempt(courseId, attempt);
      } catch (err) {
        console.error('Failed to save attempt:', err);
      }
      onCompleted?.();
    }

    const passed = graded.score >= passScore;
    setResult({ ...graded, passed, passScore, topicScores: saved?.topicScores });
    setPhase('results');
  };

  const restart = () => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setLessonIndex(0);
    setPhase('lessons');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-2xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="text-red-700 dark:text-red-300">{error || 'Course unavailable.'}</p>
        <button onClick={onExit} className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600">
          Back to catalog
        </button>
      </div>
    );
  }

  const lessons = course.lessons || [];
  const currentLesson = lessons[lessonIndex];
  const totalSteps = lessons.length;

  return (
    <div className="max-w-3xl mx-auto py-6 px-2">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 inline-flex items-center gap-1">
          ← Catalog
        </button>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          {phase === 'lessons' ? `Lesson ${lessonIndex + 1} of ${totalSteps}` : phase === 'quiz' ? 'Quiz' : 'Results'}
        </span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{course.title}</h1>
      {course.summary && phase === 'lessons' && lessonIndex === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{course.summary}</p>
      )}

      {/* Progress bar */}
      {phase === 'lessons' && (
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full mb-8 mt-4 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${((lessonIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      )}

      {/* Lessons */}
      {phase === 'lessons' && currentLesson && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{currentLesson.title}</h2>
          <div className="space-y-4">
            {(currentLesson.blocks || []).map((block, i) => (
              <LessonBlock key={i} block={block} courseId={courseId} />
            ))}
          </div>

          <div className="flex items-center justify-between mt-10">
            <button
              onClick={() => setLessonIndex(i => Math.max(0, i - 1))}
              disabled={lessonIndex === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {lessonIndex < totalSteps - 1 ? (
              <button
                onClick={() => setLessonIndex(i => i + 1)}
                className="px-6 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => setPhase('quiz')}
                className="px-6 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white"
              >
                Start quiz →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quiz */}
      {phase === 'quiz' && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Answer all {questions.length} questions. You need {passScore}% to pass.
          </p>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                selected={answers[q.id] || []}
                onChange={(sel) => setAnswers(prev => ({ ...prev, [q.id]: sel }))}
                submitted={submitted}
              />
            ))}
          </div>

          {!submitted && (
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setPhase('lessons')}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
              >
                ← Review lessons
              </button>
              <button
                onClick={handleSubmitQuiz}
                disabled={!allAnswered}
                className="px-6 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white"
              >
                Submit quiz
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {phase === 'results' && result && (
        <div className="max-w-xl mx-auto text-center">
          <div className={`mx-auto h-24 w-24 rounded-full flex items-center justify-center text-4xl mb-4 ${
            result.passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {result.passed ? '🎉' : '📚'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {result.passed ? 'Course passed!' : 'Almost there'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            You scored <span className="font-semibold text-gray-800 dark:text-gray-100">{result.score}%</span> ({result.correct}/{result.total} correct). Passing is {result.passScore}%.
          </p>

          {result.passed && result.topicScores && course.category && result.topicScores[course.category] && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Topic proficiency:</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${levelBadgeClass(result.topicScores[course.category].level)}`}>
                {levelLabel(result.topicScores[course.category].level)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => { setSubmitted(false); setPhase('quiz'); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
            >
              Review answers
            </button>
            {!result.passed && (
              <button onClick={restart} className="px-5 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white">
                Retake course
              </button>
            )}
            <button onClick={onExit} className="px-5 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white">
              Back to catalog
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursePlayer;
