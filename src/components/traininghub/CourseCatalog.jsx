import React, { useMemo, useState } from 'react';
import CourseCard from './components/CourseCard';

const CourseCatalog = ({ catalog, progressCourses, onStart }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');

  const categories = catalog?.categories || [];
  const courses = catalog?.courses || [];

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach(c => { map[c.id] = c; });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter(course => {
      if (activeCategory !== 'all' && course.category !== activeCategory) return false;
      if (!q) return true;
      const haystack = [course.title, course.summary, ...(course.tags || [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [courses, activeCategory, query]);

  return (
    <div className="p-6">
      {/* Search + category chips */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, topics, products…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All courses
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-3">🗂️</div>
          <p className="text-sm">No courses match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              categoryMeta={categoryMap[course.category]}
              courseProgress={progressCourses?.[course.id]}
              onStart={onStart}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseCatalog;
