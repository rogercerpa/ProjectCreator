import React, { useState, useEffect, useMemo } from 'react';
import AiGeneratePanel from './AiGeneratePanel';
import LessonEditor from './LessonEditor';
import QuizEditor from './QuizEditor';
import CoursePlayer from '../CoursePlayer';

const { electronAPI } = window;

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

function genCourseId() {
  return `course-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyCourse(categories) {
  return {
    id: genCourseId(),
    title: '',
    summary: '',
    category: categories?.[0]?.id || 'process-qc',
    difficulty: 1,
    estimatedMinutes: 8,
    passScore: 80,
    tags: [],
    lessons: [],
    quiz: { questions: [] }
  };
}

// Reassign clean, stable ids before saving.
function normalizeForSave(course) {
  const lessons = (course.lessons || []).map((lesson, li) => ({
    ...lesson,
    id: `l${li + 1}`,
    title: lesson.title || `Lesson ${li + 1}`,
    blocks: (lesson.blocks || []).filter(b => {
      if (b.type === 'text' || b.type === 'callout') return (b.content || '').trim().length > 0;
      if (b.type === 'link') return (b.url || '').trim().length > 0;
      if (b.type === 'image') return !!b.assetId || !!b.url;
      if (b.type === 'video') return !!b.assetId || !!b.url;
      return false;
    })
  }));

  const questions = (course.quiz?.questions || []).map((q, qi) => {
    let choices;
    if (q.type === 'boolean') {
      const correctIsTrue = (q.choices || []).find(c => c.correct)?.id !== 'false';
      choices = [
        { id: 'true', text: 'True', correct: correctIsTrue },
        { id: 'false', text: 'False', correct: !correctIsTrue }
      ];
    } else {
      choices = (q.choices || []).map((c, ci) => ({ id: String.fromCharCode(97 + ci), text: c.text, correct: !!c.correct }));
      if (choices.length && !choices.some(c => c.correct)) choices[0].correct = true;
    }
    return { id: `q${qi + 1}`, type: q.type, prompt: q.prompt, choices, explanation: q.explanation || '' };
  });

  return {
    ...course,
    tags: Array.isArray(course.tags) ? course.tags : [],
    lessons,
    quiz: { questions }
  };
}

function validate(course) {
  const errors = [];
  if (!course.title || !course.title.trim()) errors.push('Add a course title.');
  if (!course.category) errors.push('Choose a category.');
  const lessons = course.lessons || [];
  if (lessons.length === 0) errors.push('Add at least one lesson.');
  if (lessons.some(l => (l.blocks || []).length === 0)) errors.push('Every lesson needs at least one content block.');
  const questions = course.quiz?.questions || [];
  if (questions.length < 2) errors.push('Add at least two quiz questions.');
  questions.forEach((q, i) => {
    if (!q.prompt || !q.prompt.trim()) errors.push(`Question ${i + 1} needs a prompt.`);
    const filled = (q.choices || []).filter(c => (c.text || '').trim());
    if (q.type !== 'boolean' && filled.length < 2) errors.push(`Question ${i + 1} needs at least two choices.`);
    if (!(q.choices || []).some(c => c.correct)) errors.push(`Question ${i + 1} needs a correct answer.`);
  });
  return errors;
}

const NEW_LESSON = () => ({ title: '', blocks: [{ type: 'text', content: '' }] });

const CourseEditor = ({ courseId, catalog, aiReady, onClose, onSaved }) => {
  const categories = catalog?.categories || [];
  const [course, setCourse] = useState(() => emptyCourse(categories));
  const [loading, setLoading] = useState(!!courseId);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let active = true;
    if (courseId) {
      setLoading(true);
      electronAPI.trainingHubGetCourse(courseId)
        .then(res => {
          if (!active) return;
          if (res?.success) {
            setCourse({ ...emptyCourse(categories), ...res.course, quiz: res.course.quiz || { questions: [] } });
          }
        })
        .finally(() => active && setLoading(false));
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const set = (patch) => setCourse(prev => ({ ...prev, ...patch }));

  const applyGenerated = (draft) => {
    const hasContent = (course.lessons || []).length > 0 || (course.quiz?.questions || []).length > 0;
    if (hasContent && !window.confirm('Replace the current lessons and quiz with the AI-generated draft?')) {
      return;
    }
    setCourse(prev => ({
      ...prev,
      title: prev.title || draft.title || '',
      summary: draft.summary || prev.summary,
      estimatedMinutes: draft.estimatedMinutes || prev.estimatedMinutes,
      tags: (draft.tags && draft.tags.length) ? draft.tags : prev.tags,
      lessons: draft.lessons || [],
      quiz: draft.quiz || { questions: [] }
    }));
  };

  // Lessons
  const setLesson = (i, next) => setCourse(prev => {
    const lessons = prev.lessons.slice(); lessons[i] = next; return { ...prev, lessons };
  });
  const removeLesson = (i) => setCourse(prev => ({ ...prev, lessons: prev.lessons.filter((_, idx) => idx !== i) }));
  const moveLesson = (i, dir) => setCourse(prev => {
    const j = i + dir; if (j < 0 || j >= prev.lessons.length) return prev;
    const lessons = prev.lessons.slice(); [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
    return { ...prev, lessons };
  });
  const addLesson = () => setCourse(prev => ({ ...prev, lessons: [...prev.lessons, NEW_LESSON()] }));

  const previewCourse = useMemo(() => normalizeForSave(course), [course]);

  const handleSave = async () => {
    const normalized = normalizeForSave(course);
    const errs = validate(normalized);
    setErrors(errs);
    if (errs.length > 0) { window.scrollTo?.({ top: 0, behavior: 'smooth' }); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await electronAPI.trainingHubSaveCourse(normalized);
      if (res?.success) {
        onSaved?.(res.courseId);
      } else {
        setSaveError(res?.error || 'Failed to save course');
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await electronAPI.trainingHubDeleteCourse(course.id);
      if (res?.success) onSaved?.(null);
      else setSaveError(res?.error || 'Failed to delete course');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const setTagsFromString = (str) => set({ tags: str.split(',').map(s => s.trim()).filter(Boolean) });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (preview) {
    return (
      <div>
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Preview mode — attempts are not recorded</span>
          <button onClick={() => setPreview(false)} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">
            Back to editor
          </button>
        </div>
        <CoursePlayer courseOverride={previewCourse} previewMode onExit={() => setPreview(false)} />
      </div>
    );
  }

  const isExisting = !!courseId;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 inline-flex items-center gap-1">
          ← Cancel
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreview(true)} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">
            Preview
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white">
            {saving ? 'Saving…' : 'Publish course'}
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{isExisting ? 'Edit course' : 'Create course'}</h1>

      {(errors.length > 0 || saveError) && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
          {saveError && <p className="text-sm text-red-700 dark:text-red-300 font-medium">{saveError}</p>}
          {errors.map((e, i) => <p key={i} className="text-sm text-red-700 dark:text-red-300">• {e}</p>)}
        </div>
      )}

      {/* AI generation */}
      <div className="mb-8">
        <AiGeneratePanel
          aiReady={aiReady}
          category={course.category}
          difficulty={course.difficulty}
          onGenerated={applyGenerated}
        />
      </div>

      {/* Metadata */}
      <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-8 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Course details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input value={course.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. nLight Air Commissioning Basics" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
          <textarea value={course.summary} onChange={(e) => set({ summary: e.target.value })} rows={2} placeholder="Short description shown on the course card" className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select value={course.category} onChange={(e) => set({ category: e.target.value })} className={inputClass}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
            <select value={course.difficulty} onChange={(e) => set({ difficulty: parseInt(e.target.value, 10) })} className={inputClass}>
              <option value={1}>Introductory</option>
              <option value={2}>Intermediate</option>
              <option value={3}>Advanced</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. minutes</label>
            <input type="number" min={1} value={course.estimatedMinutes} onChange={(e) => set({ estimatedMinutes: parseInt(e.target.value, 10) || 1 })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pass score %</label>
            <input type="number" min={0} max={100} value={course.passScore} onChange={(e) => set({ passScore: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma separated)</label>
          <input value={(course.tags || []).join(', ')} onChange={(e) => setTagsFromString(e.target.value)} placeholder="occupancy, DALI, commissioning" className={inputClass} />
        </div>
      </div>

      {/* Lessons */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Lessons</h2>
          <button onClick={addLesson} className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white">+ Add lesson</button>
        </div>
        <div className="space-y-4">
          {(course.lessons || []).map((lesson, i) => (
            <LessonEditor
              key={i}
              lesson={lesson}
              index={i}
              courseId={course.id}
              onChange={(next) => setLesson(i, next)}
              onRemove={() => removeLesson(i)}
              onMoveUp={() => moveLesson(i, -1)}
              onMoveDown={() => moveLesson(i, 1)}
              isFirst={i === 0}
              isLast={i === (course.lessons.length - 1)}
            />
          ))}
          {(course.lessons || []).length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No lessons yet. Add one manually or generate a draft with AI above.</p>
          )}
        </div>
      </div>

      {/* Quiz */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Quiz</h2>
        <QuizEditor quiz={course.quiz} onChange={(quiz) => set({ quiz })} />
      </div>

      {/* Delete (existing only) */}
      {isExisting && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-700 dark:text-red-300">Delete this course for everyone?</span>
              <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white">Yes, delete</button>
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-sm font-medium text-red-600 hover:text-red-700">Delete course</button>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseEditor;
