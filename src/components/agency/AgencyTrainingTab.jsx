import React, { useState, useEffect } from 'react';

function AgencyTrainingTab({ agency }) {
  const [trainingNeeds, setTrainingNeeds] = useState([]);
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [trainingMaterials, setTrainingMaterials] = useState([]);
  const [newTrainingNeed, setNewTrainingNeed] = useState({
    topic: '',
    priority: 'medium',
    notes: '',
    requestedDate: new Date().toISOString().split('T')[0]
  });
  const [newSession, setNewSession] = useState({
    topic: '',
    date: '',
    time: '',
    duration: '',
    location: '',
    notes: ''
  });
  const [showAddNeed, setShowAddNeed] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);

  useEffect(() => {
    if (agency) {
      loadTrainingData();
    }
  }, [agency]);

  const loadTrainingData = async () => {
    // TODO: Load from extended agency data
    const needs = agency?.trainingNeeds || [];
    const history = agency?.trainingHistory || [];
    const sessions = agency?.trainingSchedule || [];
    const materials = agency?.trainingMaterials || [];

    setTrainingNeeds(needs);
    setTrainingHistory(history);
    setUpcomingSessions(sessions.filter(s => new Date(s.date) >= new Date()));
    setTrainingMaterials(materials);
  };

  const handleAddTrainingNeed = async () => {
    if (!newTrainingNeed.topic.trim()) return;

    const need = {
      id: `need-${Date.now()}`,
      ...newTrainingNeed,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // TODO: Save to extended agency data
    setTrainingNeeds([...trainingNeeds, need]);
    setNewTrainingNeed({
      topic: '',
      priority: 'medium',
      notes: '',
      requestedDate: new Date().toISOString().split('T')[0]
    });
    setShowAddNeed(false);
  };

  const handleAddSession = async () => {
    if (!newSession.topic.trim() || !newSession.date) return;

    const session = {
      id: `session-${Date.now()}`,
      ...newSession,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    // TODO: Save to extended agency data
    setUpcomingSessions([...upcomingSessions, session]);
    setNewSession({
      topic: '',
      date: '',
      time: '',
      duration: '',
      location: '',
      notes: ''
    });
    setShowAddSession(false);
  };

  const handleCompleteTraining = (trainingId) => {
    const training = trainingNeeds.find(t => t.id === trainingId);
    if (!training) return;

    const completed = {
      id: `history-${Date.now()}`,
      topic: training.topic,
      completedDate: new Date().toISOString(),
      notes: training.notes
    };

    setTrainingHistory([completed, ...trainingHistory]);
    setTrainingNeeds(trainingNeeds.filter(t => t.id !== trainingId));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Training Needs Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Training Needs</h2>
          <button
            onClick={() => setShowAddNeed(!showAddNeed)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Training Need</span>
          </button>
        </div>

        {showAddNeed && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Training Topic *
                </label>
                <input
                  type="text"
                  value={newTrainingNeed.topic}
                  onChange={(e) => setNewTrainingNeed({ ...newTrainingNeed, topic: e.target.value })}
                  placeholder="Enter training topic..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTrainingNeed.priority}
                    onChange={(e) => setNewTrainingNeed({ ...newTrainingNeed, priority: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Requested Date
                  </label>
                  <input
                    type="date"
                    value={newTrainingNeed.requestedDate}
                    onChange={(e) => setNewTrainingNeed({ ...newTrainingNeed, requestedDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newTrainingNeed.notes}
                  onChange={(e) => setNewTrainingNeed({ ...newTrainingNeed, notes: e.target.value })}
                  placeholder="Additional notes about this training need..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows="3"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddTrainingNeed}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
                >
                  Add Training Need
                </button>
                <button
                  onClick={() => {
                    setNewTrainingNeed({
                      topic: '',
                      priority: 'medium',
                      notes: '',
                      requestedDate: new Date().toISOString().split('T')[0]
                    });
                    setShowAddNeed(false);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {trainingNeeds.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No training needs identified yet. Click "Add Training Need" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trainingNeeds.map(need => (
              <div
                key={need.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{need.topic}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(need.priority)}`}>
                      {need.priority}
                    </span>
                  </div>
                  {need.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{need.notes}</p>
                  )}
                  {need.requestedDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Requested: {formatDate(need.requestedDate)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleCompleteTraining(need.id)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all ml-4"
                  title="Mark as completed"
                >
                  Complete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Training Sessions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upcoming Training Sessions</h2>
          <button
            onClick={() => setShowAddSession(!showAddSession)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span>+</span>
            <span>Schedule Session</span>
          </button>
        </div>

        {showAddSession && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Topic *
                </label>
                <input
                  type="text"
                  value={newSession.topic}
                  onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })}
                  placeholder="Training topic..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={newSession.date}
                    onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newSession.time}
                    onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={newSession.duration}
                    onChange={(e) => setNewSession({ ...newSession, duration: e.target.value })}
                    placeholder="e.g., 2 hours"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newSession.location}
                    onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                    placeholder="Location or video link"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newSession.notes}
                  onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                  placeholder="Additional notes..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows="2"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddSession}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
                >
                  Schedule Session
                </button>
                <button
                  onClick={() => {
                    setNewSession({
                      topic: '',
                      date: '',
                      time: '',
                      duration: '',
                      location: '',
                      notes: ''
                    });
                    setShowAddSession(false);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {upcomingSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No upcoming training sessions scheduled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map(session => (
              <div
                key={session.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{session.topic}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>📅 {formatDate(session.date)}</span>
                      {session.time && <span>🕐 {session.time}</span>}
                      {session.duration && <span>⏱️ {session.duration}</span>}
                      {session.location && <span>📍 {session.location}</span>}
                    </div>
                    {session.notes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{session.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training History */}
      {trainingHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Training History</h2>
          <div className="space-y-3">
            {trainingHistory.slice(0, 10).map(training => (
              <div
                key={training.id}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{training.topic}</p>
                    {training.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{training.notes}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(training.completedDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training Materials */}
      {trainingMaterials.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Training Materials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingMaterials.map((material, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{material.title || 'Training Material'}</h3>
                {material.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{material.description}</p>
                )}
                {material.link && (
                  <a
                    href={material.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 hover:underline text-sm mt-2 inline-block"
                  >
                    View Material →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgencyTrainingTab;

