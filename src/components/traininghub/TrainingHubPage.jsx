import React, { useState, useEffect, useCallback } from 'react';
import CourseCatalog from './CourseCatalog';
import CoursePlayer from './CoursePlayer';
import ProgressDashboard from './ProgressDashboard';
import CourseEditor from './author/CourseEditor';

const { electronAPI } = window;

const TABS = [
  { id: 'catalog', label: 'Course Catalog', icon: '📚' },
  { id: 'progress', label: 'My Progress', icon: '📈' }
];

const TrainingHubPage = () => {
  const [activeTab, setActiveTab] = useState('catalog');
  const [catalog, setCatalog] = useState(null);
  const [progress, setProgress] = useState({ courses: {}, topicScores: {} });
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState(null); // catalog entry being played
  const [editorTarget, setEditorTarget] = useState(null); // 'new' | courseId | null
  const [aiReady, setAiReady] = useState(false);

  const loadProgress = useCallback(async () => {
    try {
      const res = await electronAPI.trainingHubGetProgress();
      if (res?.success) setProgress(res.progress || { courses: {}, topicScores: {} });
    } catch (err) {
      console.error('Failed to load training progress:', err);
    }
  }, []);

  const loadCatalog = useCallback(async (forceRefresh = false) => {
    try {
      const res = await electronAPI.trainingHubGetCatalog(forceRefresh);
      if (res?.success) setCatalog(res.catalog);
    } catch (err) {
      console.error('Failed to load Training Hub catalog:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadCatalog(false), loadProgress()]);
        try {
          const key = await electronAPI.aiHasKey?.();
          if (active) setAiReady(!!key?.hasKey);
        } catch { /* AI optional */ }
      } catch (err) {
        console.error('Failed to load Training Hub:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadCatalog, loadProgress]);

  const handleStart = useCallback((course) => {
    setActiveCourse(course);
  }, []);

  const handleExitCourse = useCallback(() => {
    setActiveCourse(null);
    loadProgress();
  }, [loadProgress]);

  const handleEdit = useCallback((course) => {
    setEditorTarget(course?.id || 'new');
  }, []);

  const handleEditorSaved = useCallback(async () => {
    setEditorTarget(null);
    await loadCatalog(true);
  }, [loadCatalog]);

  if (editorTarget) {
    return (
      <div className="h-full overflow-y-auto">
        <CourseEditor
          courseId={editorTarget === 'new' ? null : editorTarget}
          catalog={catalog}
          aiReady={aiReady}
          onClose={() => setEditorTarget(null)}
          onSaved={handleEditorSaved}
        />
      </div>
    );
  }

  if (activeCourse) {
    return (
      <div className="h-full overflow-y-auto">
        <CoursePlayer
          courseId={activeCourse.id}
          catalogCourse={activeCourse}
          onExit={handleExitCourse}
          onCompleted={loadProgress}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Hub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Short interactive courses and quizzes to sharpen your design &amp; application skills
          </p>
        </div>
        <div className="flex items-center gap-4">
          {catalog && (
            <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{catalog.courses?.length || 0} courses</span>
              <span>{catalog.categories?.length || 0} topics</span>
            </div>
          )}
          <button
            onClick={() => setEditorTarget('new')}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white"
          >
            + Create course
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : activeTab === 'catalog' ? (
          <CourseCatalog
            catalog={catalog}
            progressCourses={progress.courses}
            onStart={handleStart}
            onEdit={handleEdit}
          />
        ) : (
          <ProgressDashboard
            catalog={catalog}
            progress={progress}
            onStart={handleStart}
          />
        )}
      </div>
    </div>
  );
};

export default TrainingHubPage;
