import React, { useState, useEffect } from 'react';

function AgencyNotesTab({ agency }) {
  const [notes, setNotes] = useState([]);
  const [communicationHistory, setCommunicationHistory] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newCommunication, setNewCommunication] = useState({
    type: 'email',
    date: new Date().toISOString().split('T')[0],
    summary: '',
    notes: ''
  });
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddCommunication, setShowAddCommunication] = useState(false);

  useEffect(() => {
    if (agency) {
      loadNotes();
      loadCommunicationHistory();
    }
  }, [agency]);

  const loadNotes = async () => {
    // TODO: Load from extended agency data
    // For now, use placeholder data structure
    const agencyNotes = agency?.notes || [];
    setNotes(agencyNotes);
  };

  const loadCommunicationHistory = async () => {
    // TODO: Load from extended agency data
    // For now, use placeholder data structure
    const history = agency?.communicationHistory || [];
    setCommunicationHistory(history);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const note = {
      id: `note-${Date.now()}`,
      content: newNote,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User' // TODO: Get from user context
    };

    const updatedNotes = [note, ...notes];
    setNotes(updatedNotes);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        notes: updatedNotes
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note: ' + error.message);
      // Revert on error
      setNotes(notes);
      return;
    }

    setNewNote('');
    setShowAddNote(false);
  };

  const handleAddCommunication = async () => {
    if (!newCommunication.summary.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const communication = {
      id: `comm-${Date.now()}`,
      ...newCommunication,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User' // TODO: Get from user context
    };

    const updatedHistory = [communication, ...communicationHistory];
    setCommunicationHistory(updatedHistory);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        communicationHistory: updatedHistory
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save communication');
      }
    } catch (error) {
      console.error('Error saving communication:', error);
      alert('Failed to save communication: ' + error.message);
      // Revert on error
      setCommunicationHistory(communicationHistory);
      return;
    }

    setNewCommunication({
      type: 'email',
      date: new Date().toISOString().split('T')[0],
      summary: '',
      notes: ''
    });
    setShowAddCommunication(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const getCommunicationIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'email': return '✉️';
      case 'call': return '📞';
      case 'meeting': return '🤝';
      default: return '📝';
    }
  };

  return (
    <div className="space-y-6">
      {/* Internal Notes Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Internal Notes</h2>
          <button
            onClick={() => setShowAddNote(!showAddNote)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Note</span>
          </button>
        </div>

        {showAddNote && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter your note here..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows="4"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
              >
                Save Note
              </button>
              <button
                onClick={() => {
                  setNewNote('');
                  setShowAddNote(false);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No notes yet. Click "Add Note" to create one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <div
                key={note.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(note.createdAt)}
                  </p>
                  {note.createdBy && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      by {note.createdBy}
                    </span>
                  )}
                </div>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Communication History Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Communication History</h2>
          <button
            onClick={() => setShowAddCommunication(!showAddCommunication)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Communication</span>
          </button>
        </div>

        {showAddCommunication && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={newCommunication.type}
                    onChange={(e) => setNewCommunication({ ...newCommunication, type: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="email">Email</option>
                    <option value="call">Call</option>
                    <option value="meeting">Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newCommunication.date}
                    onChange={(e) => setNewCommunication({ ...newCommunication, date: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Summary
                </label>
                <input
                  type="text"
                  value={newCommunication.summary}
                  onChange={(e) => setNewCommunication({ ...newCommunication, summary: e.target.value })}
                  placeholder="Brief summary of the communication..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newCommunication.notes}
                  onChange={(e) => setNewCommunication({ ...newCommunication, notes: e.target.value })}
                  placeholder="Additional notes or details..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows="3"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddCommunication}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
                >
                  Save Communication
                </button>
                <button
                  onClick={() => {
                    setNewCommunication({
                      type: 'email',
                      date: new Date().toISOString().split('T')[0],
                      summary: '',
                      notes: ''
                    });
                    setShowAddCommunication(false);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {communicationHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No communication history yet. Click "Add Communication" to log one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {communicationHistory.map(comm => (
              <div
                key={comm.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getCommunicationIcon(comm.type)}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{comm.summary}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(comm.date || comm.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium capitalize">
                    {comm.type}
                  </span>
                </div>
                {comm.notes && (
                  <p className="text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{comm.notes}</p>
                )}
                {comm.createdBy && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Logged by {comm.createdBy}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgencyNotesTab;

