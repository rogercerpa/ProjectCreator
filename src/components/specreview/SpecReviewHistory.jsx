import React, { useState, useEffect, useCallback } from 'react';

const { electronAPI } = window;

const SpecReviewHistory = ({ onLoadReview, onDeleteReview, currentReviewId }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const result = await electronAPI.specReviewList();
      if (result.success) {
        setReviews(result.reviews || []);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleDelete = async (reviewId) => {
    await onDeleteReview(reviewId);
    setConfirmDelete(null);
    loadReviews();
  };

  const filtered = reviews.filter(r =>
    (r.sourceFile || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.projectSummary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.linkedProjectName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return dateStr; }
  };

  return (
    <div className="p-6">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search reviews..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading reviews...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p>{reviews.length === 0 ? 'No spec reviews yet. Upload a specification document to get started.' : 'No matching reviews found.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => {
            const scoreColor = (review.complianceScore ?? 0) >= 80 ? 'text-green-600' :
              (review.complianceScore ?? 0) >= 60 ? 'text-amber-600' : 'text-red-600';
            const isActive = currentReviewId === review.reviewId;

            return (
              <div
                key={review.reviewId}
                className={`border rounded-lg p-4 transition-colors ${
                  isActive
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => onLoadReview(review.reviewId)}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {review.sourceFile || 'Unknown File'}
                      </span>
                      {review.complianceScore != null && (
                        <span className={`text-sm font-bold ${scoreColor}`}>{review.complianceScore}%</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDate(review.analyzedAt)}</span>
                      <span>{review.requirementCount || 0} requirements</span>
                      {review.metCount > 0 && <span className="text-green-600">{review.metCount} met</span>}
                      {review.gapCount > 0 && <span className="text-red-600">{review.gapCount} gaps</span>}
                    </div>

                    {review.linkedProjectName && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-primary-600 dark:text-primary-400">🔗 {review.linkedProjectName}</span>
                      </div>
                    )}

                    {review.projectSummary && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 line-clamp-1">{review.projectSummary}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onLoadReview(review.reviewId)}
                      className="px-3 py-1.5 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                    >
                      View
                    </button>

                    {confirmDelete === review.reviewId ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(review.reviewId)}
                          className="px-2 py-1.5 text-xs bg-red-600 text-white rounded-lg"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1.5 text-xs text-gray-500 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(review.reviewId)}
                        className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SpecReviewHistory;
