import React, { useState, useEffect } from 'react';
import CollapsibleSection from './CollapsibleSection';

function AgencyPlaybookTab({ agency }) {
  // Section expansion states
  const [expandedSections, setExpandedSections] = useState({
    notes: true,
    design: false,
    products: false,
    training: false,
    strategy: false
  });

  // Notes & Communication state
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
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editingCommId, setEditingCommId] = useState(null);
  const [editingCommData, setEditingCommData] = useState({});

  // Design Requirements state
  const [designRequirements, setDesignRequirements] = useState({
    specifications: '',
    preferredStandards: '',
    templates: '',
    customPreferences: '',
    bestPractices: ''
  });
  const [editingDesignField, setEditingDesignField] = useState(null);
  const [editingDesignValue, setEditingDesignValue] = useState('');

  // Product Focus state
  const [productFocus, setProductFocus] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', category: '', notes: '' });
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Training state
  const [trainingNeeds, setTrainingNeeds] = useState([]);
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
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
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionData, setEditingSessionData] = useState({});

  // Market Strategy state
  const [marketStrategy, setMarketStrategy] = useState({
    regionalStrategies: '',
    competitivePositioning: '',
    growthOpportunities: '',
    marketAnalysis: '',
    targets: '',
    insights: ''
  });
  const [editingStrategyField, setEditingStrategyField] = useState(null);
  const [editingStrategyValue, setEditingStrategyValue] = useState('');

  // General state
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load all data on mount
  useEffect(() => {
    if (agency) {
      loadAllData();
    }
  }, [agency]);

  const loadAllData = () => {
    // Notes & Communication
    setNotes(agency?.notes || []);
    setCommunicationHistory(agency?.communicationHistory || []);

    // Design Requirements
    const requirements = agency?.designRequirements || {};
    setDesignRequirements({
      specifications: requirements.specifications || '',
      preferredStandards: requirements.preferredStandards || '',
      templates: requirements.templates || '',
      customPreferences: requirements.customPreferences || '',
      bestPractices: requirements.bestPractices || ''
    });

    // Product Focus
    setProductFocus(agency?.productFocus || []);

    // Training
    setTrainingNeeds(agency?.trainingNeeds || []);
    setTrainingHistory(agency?.trainingHistory || []);
    const sessions = agency?.trainingSchedule || [];
    setUpcomingSessions(sessions.filter(s => new Date(s.date) >= new Date()));

    // Market Strategy
    const strategy = agency?.marketStrategy || {};
    setMarketStrategy({
      regionalStrategies: strategy.regionalStrategies || '',
      competitivePositioning: strategy.competitivePositioning || '',
      growthOpportunities: strategy.growthOpportunities || '',
      marketAnalysis: strategy.marketAnalysis || '',
      targets: strategy.targets || '',
      insights: strategy.insights || ''
    });
  };

  // Toggle section expansion
  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const expandAll = () => {
    setExpandedSections({
      notes: true,
      design: true,
      products: true,
      training: true,
      strategy: true
    });
  };

  const collapseAll = () => {
    setExpandedSections({
      notes: false,
      design: false,
      products: false,
      training: false,
      strategy: false
    });
  };

  // Export to Word (using dynamic import to avoid blocking app load)
  const handleExport = async () => {
    setExporting(true);
    try {
      // Dynamic import to lazy-load the export utility
      const { exportAgencyPlaybook } = await import('../../utils/exportAgencyPlaybook');
      await exportAgencyPlaybook(agency, {
        notes,
        communicationHistory,
        designRequirements,
        productFocus,
        trainingNeeds,
        trainingHistory,
        upcomingSessions,
        marketStrategy
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export document: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Helper functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
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

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // ===== NOTES & COMMUNICATION HANDLERS =====
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
      createdBy: 'Current User'
    };

    const updatedNotes = [note, ...notes];
    setNotes(updatedNotes);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { notes: updatedNotes });
      if (!result.success) throw new Error(result.error || 'Failed to save note');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note: ' + error.message);
      setNotes(notes);
      return;
    }

    setNewNote('');
    setShowAddNote(false);
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveNoteEdit = async () => {
    if (!editingNoteContent.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedNotes = notes.map(note =>
      note.id === editingNoteId
        ? { ...note, content: editingNoteContent, updatedAt: new Date().toISOString() }
        : note
    );
    setNotes(updatedNotes);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { notes: updatedNotes });
      if (!result.success) throw new Error(result.error || 'Failed to update note');
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note: ' + error.message);
      loadAllData();
      return;
    }

    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { notes: updatedNotes });
      if (!result.success) throw new Error(result.error || 'Failed to delete note');
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note: ' + error.message);
      loadAllData();
    }
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
      createdBy: 'Current User'
    };

    const updatedHistory = [communication, ...communicationHistory];
    setCommunicationHistory(updatedHistory);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { communicationHistory: updatedHistory });
      if (!result.success) throw new Error(result.error || 'Failed to save communication');
    } catch (error) {
      console.error('Error saving communication:', error);
      alert('Failed to save communication: ' + error.message);
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

  const handleEditCommunication = (comm) => {
    setEditingCommId(comm.id);
    setEditingCommData({
      type: comm.type,
      date: comm.date || new Date().toISOString().split('T')[0],
      summary: comm.summary,
      notes: comm.notes || ''
    });
  };

  const handleSaveCommunicationEdit = async () => {
    if (!editingCommData.summary?.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedHistory = communicationHistory.map(comm =>
      comm.id === editingCommId
        ? { ...comm, ...editingCommData, updatedAt: new Date().toISOString() }
        : comm
    );
    setCommunicationHistory(updatedHistory);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { communicationHistory: updatedHistory });
      if (!result.success) throw new Error(result.error || 'Failed to update communication');
    } catch (error) {
      console.error('Error updating communication:', error);
      alert('Failed to update communication: ' + error.message);
      loadAllData();
      return;
    }

    setEditingCommId(null);
    setEditingCommData({});
  };

  const handleDeleteCommunication = async (commId) => {
    if (!window.confirm('Are you sure you want to delete this communication entry?')) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedHistory = communicationHistory.filter(comm => comm.id !== commId);
    setCommunicationHistory(updatedHistory);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { communicationHistory: updatedHistory });
      if (!result.success) throw new Error(result.error || 'Failed to delete communication');
    } catch (error) {
      console.error('Error deleting communication:', error);
      alert('Failed to delete communication: ' + error.message);
      loadAllData();
    }
  };

  // ===== DESIGN REQUIREMENTS HANDLERS =====
  const handleEditDesignField = (fieldKey) => {
    setEditingDesignField(fieldKey);
    setEditingDesignValue(designRequirements[fieldKey] || '');
  };

  const handleSaveDesignField = async () => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedRequirements = {
      ...designRequirements,
      [editingDesignField]: editingDesignValue
    };
    setDesignRequirements(updatedRequirements);

    setSaving(true);
    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { designRequirements: updatedRequirements });
      if (!result.success) throw new Error(result.error || 'Failed to save design requirements');
    } catch (error) {
      console.error('Error saving design requirements:', error);
      alert('Failed to save: ' + error.message);
      loadAllData();
    } finally {
      setSaving(false);
      setEditingDesignField(null);
      setEditingDesignValue('');
    }
  };

  const handleCancelDesignEdit = () => {
    setEditingDesignField(null);
    setEditingDesignValue('');
  };

  // ===== PRODUCT FOCUS HANDLERS =====
  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const product = {
      id: `product-${Date.now()}`,
      ...newProduct,
      createdAt: new Date().toISOString()
    };

    const updatedProducts = [...productFocus, product];
    setProductFocus(updatedProducts);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { productFocus: updatedProducts });
      if (!result.success) throw new Error(result.error || 'Failed to save product');
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product: ' + error.message);
      setProductFocus(productFocus);
      return;
    }

    setNewProduct({ name: '', category: '', notes: '' });
    setShowAddProduct(false);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to remove this product?')) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedProducts = productFocus.filter(p => p.id !== productId);
    setProductFocus(updatedProducts);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { productFocus: updatedProducts });
      if (!result.success) throw new Error(result.error || 'Failed to delete product');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product: ' + error.message);
      setProductFocus(productFocus);
    }
  };

  // ===== TRAINING HANDLERS =====
  const handleAddTrainingNeed = async () => {
    if (!newTrainingNeed.topic.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const need = {
      id: `need-${Date.now()}`,
      ...newTrainingNeed,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const updatedNeeds = [...trainingNeeds, need];
    setTrainingNeeds(updatedNeeds);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { trainingNeeds: updatedNeeds });
      if (!result.success) throw new Error(result.error || 'Failed to save training need');
    } catch (error) {
      console.error('Error saving training need:', error);
      alert('Failed to save training need: ' + error.message);
      setTrainingNeeds(trainingNeeds);
      return;
    }

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
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const session = {
      id: `session-${Date.now()}`,
      ...newSession,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    const allSessions = [...upcomingSessions, session];
    const updatedSessions = allSessions.filter(s => new Date(s.date) >= new Date());
    setUpcomingSessions(updatedSessions);

    const currentSchedule = agency?.trainingSchedule || [];
    const updatedSchedule = [...currentSchedule, session];

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { trainingSchedule: updatedSchedule });
      if (!result.success) throw new Error(result.error || 'Failed to save training session');
    } catch (error) {
      console.error('Error saving training session:', error);
      alert('Failed to save training session: ' + error.message);
      setUpcomingSessions(upcomingSessions);
      return;
    }

    setNewSession({ topic: '', date: '', time: '', duration: '', location: '', notes: '' });
    setShowAddSession(false);
  };

  const handleEditSession = (session) => {
    setEditingSessionId(session.id);
    setEditingSessionData({
      topic: session.topic,
      date: session.date,
      time: session.time || '',
      duration: session.duration || '',
      location: session.location || '',
      notes: session.notes || ''
    });
  };

  const handleSaveSessionEdit = async () => {
    if (!editingSessionData.topic?.trim() || !editingSessionData.date) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedSessions = upcomingSessions.map(session =>
      session.id === editingSessionId
        ? { ...session, ...editingSessionData, updatedAt: new Date().toISOString() }
        : session
    );
    setUpcomingSessions(updatedSessions);

    // Also update the full schedule
    const currentSchedule = agency?.trainingSchedule || [];
    const updatedSchedule = currentSchedule.map(session =>
      session.id === editingSessionId
        ? { ...session, ...editingSessionData, updatedAt: new Date().toISOString() }
        : session
    );

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { trainingSchedule: updatedSchedule });
      if (!result.success) throw new Error(result.error || 'Failed to update session');
    } catch (error) {
      console.error('Error updating session:', error);
      alert('Failed to update session: ' + error.message);
      loadAllData();
      return;
    }

    setEditingSessionId(null);
    setEditingSessionData({});
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this training session?')) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedSessions = upcomingSessions.filter(s => s.id !== sessionId);
    setUpcomingSessions(updatedSessions);

    // Also update the full schedule
    const currentSchedule = agency?.trainingSchedule || [];
    const updatedSchedule = currentSchedule.filter(s => s.id !== sessionId);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { trainingSchedule: updatedSchedule });
      if (!result.success) throw new Error(result.error || 'Failed to delete session');
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session: ' + error.message);
      loadAllData();
    }
  };

  const handleCompleteTraining = async (trainingId) => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const training = trainingNeeds.find(t => t.id === trainingId);
    if (!training) return;

    const completed = {
      id: `history-${Date.now()}`,
      topic: training.topic,
      completedDate: new Date().toISOString(),
      notes: training.notes
    };

    const updatedHistory = [completed, ...trainingHistory];
    const updatedNeeds = trainingNeeds.filter(t => t.id !== trainingId);

    setTrainingHistory(updatedHistory);
    setTrainingNeeds(updatedNeeds);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        trainingHistory: updatedHistory,
        trainingNeeds: updatedNeeds
      });
      if (!result.success) throw new Error(result.error || 'Failed to update training');
    } catch (error) {
      console.error('Error updating training:', error);
      alert('Failed to update training: ' + error.message);
      setTrainingHistory(trainingHistory);
      setTrainingNeeds(trainingNeeds);
    }
  };

  // ===== MARKET STRATEGY HANDLERS =====
  const handleEditStrategyField = (fieldKey) => {
    setEditingStrategyField(fieldKey);
    setEditingStrategyValue(marketStrategy[fieldKey] || '');
  };

  const handleSaveStrategyField = async () => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedStrategy = {
      ...marketStrategy,
      [editingStrategyField]: editingStrategyValue
    };
    setMarketStrategy(updatedStrategy);

    setSaving(true);
    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, { marketStrategy: updatedStrategy });
      if (!result.success) throw new Error(result.error || 'Failed to save market strategy');
    } catch (error) {
      console.error('Error saving market strategy:', error);
      alert('Failed to save: ' + error.message);
      loadAllData();
    } finally {
      setSaving(false);
      setEditingStrategyField(null);
      setEditingStrategyValue('');
    }
  };

  const handleCancelStrategyEdit = () => {
    setEditingStrategyField(null);
    setEditingStrategyValue('');
  };

  // Design Requirements field definitions
  const designFields = [
    { key: 'specifications', label: 'Design Specifications', placeholder: 'Enter design specifications and requirements for this agency...' },
    { key: 'preferredStandards', label: 'Preferred Design Standards', placeholder: 'List preferred design standards, codes, or guidelines...' },
    { key: 'templates', label: 'Templates & Guidelines', placeholder: 'Specify preferred templates, formats, or design guidelines...' },
    { key: 'customPreferences', label: 'Custom Design Preferences', placeholder: 'Enter any custom design preferences or special requirements...' },
    { key: 'bestPractices', label: 'Best Practices & Guidelines', placeholder: 'Document best practices, lessons learned, or important guidelines...' }
  ];

  // Market Strategy field definitions
  const strategyFields = [
    { key: 'regionalStrategies', label: 'Regional Market Strategies', placeholder: 'Document regional market strategies, approaches, and considerations...' },
    { key: 'competitivePositioning', label: 'Competitive Positioning', placeholder: 'Describe competitive positioning, market share, and competitive advantages...' },
    { key: 'growthOpportunities', label: 'Growth Opportunities', placeholder: 'Identify growth opportunities, expansion plans, and potential areas...' },
    { key: 'targets', label: 'Targets & Goals', placeholder: 'Set specific targets, goals, and metrics...' },
    { key: 'marketAnalysis', label: 'Market Analysis', placeholder: 'Provide market analysis, trends, and market conditions...' },
    { key: 'insights', label: 'Key Insights', placeholder: 'Document key insights, observations, and strategic recommendations...' }
  ];

  return (
    <div className="space-y-4">
      {/* Header with Export and Expand/Collapse Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agency Playbook</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Expand All
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {exporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📄</span>
              <span>Export to Word</span>
            </>
          )}
        </button>
      </div>

      {/* SECTION 1: Notes & Communication */}
      <CollapsibleSection
        title="Notes & Communication"
        icon="📝"
        isExpanded={expandedSections.notes}
        onToggle={() => toggleSection('notes')}
      >
        <div className="space-y-6">
          {/* Internal Notes */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Internal Notes</h3>
              <button
                onClick={() => setShowAddNote(!showAddNote)}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-1"
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
                  rows="3"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleAddNote}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
                  >
                    Save Note
                  </button>
                  <button
                    onClick={() => { setNewNote(''); setShowAddNote(false); }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {notes.length === 0 ? (
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">No notes yet. Click "Add Note" to create one.</p>
            ) : (
              <div className="space-y-3">
                {notes.map(note => (
                  <div key={note.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    {editingNoteId === note.id ? (
                      // Edit mode
                      <div>
                        <textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          rows="3"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={handleSaveNoteEdit}
                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(note.createdAt)}</p>
                          <div className="flex items-center gap-2">
                            {note.createdBy && <span className="text-xs text-gray-500 dark:text-gray-400">by {note.createdBy}</span>}
                            <button
                              onClick={() => handleEditNote(note)}
                              className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{note.content}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Communication History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Communication History</h3>
              <button
                onClick={() => setShowAddCommunication(!showAddCommunication)}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-1"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={newCommunication.date}
                        onChange={(e) => setNewCommunication({ ...newCommunication, date: e.target.value })}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
                    <input
                      type="text"
                      value={newCommunication.summary}
                      onChange={(e) => setNewCommunication({ ...newCommunication, summary: e.target.value })}
                      placeholder="Brief summary of the communication..."
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                      value={newCommunication.notes}
                      onChange={(e) => setNewCommunication({ ...newCommunication, notes: e.target.value })}
                      placeholder="Additional notes or details..."
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows="2"
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
                        setNewCommunication({ type: 'email', date: new Date().toISOString().split('T')[0], summary: '', notes: '' });
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
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">No communication history yet.</p>
            ) : (
              <div className="space-y-3">
                {communicationHistory.map(comm => (
                  <div key={comm.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    {editingCommId === comm.id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                            <select
                              value={editingCommData.type}
                              onChange={(e) => setEditingCommData({ ...editingCommData, type: e.target.value })}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="email">Email</option>
                              <option value="call">Call</option>
                              <option value="meeting">Meeting</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                            <input
                              type="date"
                              value={editingCommData.date}
                              onChange={(e) => setEditingCommData({ ...editingCommData, date: e.target.value })}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
                          <input
                            type="text"
                            value={editingCommData.summary}
                            onChange={(e) => setEditingCommData({ ...editingCommData, summary: e.target.value })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                          <textarea
                            value={editingCommData.notes}
                            onChange={(e) => setEditingCommData({ ...editingCommData, notes: e.target.value })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows="2"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveCommunicationEdit}
                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingCommId(null); setEditingCommData({}); }}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getCommunicationIcon(comm.type)}</span>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">{comm.summary}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comm.date || comm.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium capitalize">{comm.type}</span>
                            <button
                              onClick={() => handleEditCommunication(comm)}
                              className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteCommunication(comm.id)}
                              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        {comm.notes && <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm">{comm.notes}</p>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* SECTION 2: Design Requirements */}
      <CollapsibleSection
        title="Design Requirements"
        icon="🎨"
        isExpanded={expandedSections.design}
        onToggle={() => toggleSection('design')}
      >
        <div className="space-y-4">
          {designFields.map(field => (
            <div key={field.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                {editingDesignField !== field.key && (
                  <button
                    onClick={() => handleEditDesignField(field.key)}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>✏️</span>
                    <span>Edit</span>
                  </button>
                )}
              </div>
              
              {editingDesignField === field.key ? (
                // Edit mode
                <div>
                  <textarea
                    value={editingDesignValue}
                    onChange={(e) => setEditingDesignValue(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows="4"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSaveDesignField}
                      disabled={saving}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancelDesignEdit}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-h-[60px]">
                  {designRequirements[field.key] ? (
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{designRequirements[field.key]}</p>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 italic">{field.placeholder}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* SECTION 3: Product Focus */}
      <CollapsibleSection
        title="Product Focus"
        icon="📦"
        isExpanded={expandedSections.products}
        onToggle={() => toggleSection('products')}
      >
        <div className="space-y-6">
          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Products</h3>
              <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-1"
              >
                <span>+</span>
                <span>Add Product</span>
              </button>
            </div>

            {showAddProduct && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name *</label>
                    <input
                      type="text"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Enter product name..."
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <input
                      type="text"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      placeholder="Product category..."
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                      value={newProduct.notes}
                      onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows="2"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleAddProduct} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all">Add Product</button>
                    <button onClick={() => { setNewProduct({ name: '', category: '', notes: '' }); setShowAddProduct(false); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {productFocus.length === 0 ? (
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">No products tracked yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {productFocus.map(product => (
                  <div key={product.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{product.name}</h4>
                        {product.category && <p className="text-xs text-gray-600 dark:text-gray-400">{product.category}</p>}
                      </div>
                      <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 dark:text-red-400 hover:text-red-700" title="Remove">✕</button>
                    </div>
                    {product.notes && <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{product.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* SECTION 4: Training */}
      <CollapsibleSection
        title="Training"
        icon="🎓"
        isExpanded={expandedSections.training}
        onToggle={() => toggleSection('training')}
      >
        <div className="space-y-6">
          {/* Training Needs */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Training Needs</h3>
              <button
                onClick={() => setShowAddNeed(!showAddNeed)}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-1"
              >
                <span>+</span>
                <span>Add Need</span>
              </button>
            </div>

            {showAddNeed && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Training Topic *</label>
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requested Date</label>
                      <input
                        type="date"
                        value={newTrainingNeed.requestedDate}
                        onChange={(e) => setNewTrainingNeed({ ...newTrainingNeed, requestedDate: e.target.value })}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                      value={newTrainingNeed.notes}
                      onChange={(e) => setNewTrainingNeed({ ...newTrainingNeed, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows="2"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleAddTrainingNeed} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all">Add Training Need</button>
                    <button onClick={() => { setNewTrainingNeed({ topic: '', priority: 'medium', notes: '', requestedDate: new Date().toISOString().split('T')[0] }); setShowAddNeed(false); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {trainingNeeds.length === 0 ? (
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">No training needs identified yet.</p>
            ) : (
              <div className="space-y-2">
                {trainingNeeds.map(need => (
                  <div key={need.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{need.topic}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(need.priority)}`}>{need.priority}</span>
                      </div>
                      {need.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{need.notes}</p>}
                      {need.requestedDate && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requested: {formatDateShort(need.requestedDate)}</p>}
                    </div>
                    <button onClick={() => handleCompleteTraining(need.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg ml-3" title="Mark as completed">Complete</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Sessions */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Sessions</h3>
              <button
                onClick={() => setShowAddSession(!showAddSession)}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-1"
              >
                <span>+</span>
                <span>Schedule Session</span>
              </button>
            </div>

            {showAddSession && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic *</label>
                    <input type="text" value={newSession.topic} onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })} placeholder="Training topic..." className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                      <input type="date" value={newSession.date} onChange={(e) => setNewSession({ ...newSession, date: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                      <input type="time" value={newSession.time} onChange={(e) => setNewSession({ ...newSession, time: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                      <input type="text" value={newSession.duration} onChange={(e) => setNewSession({ ...newSession, duration: e.target.value })} placeholder="e.g., 2 hours" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                      <input type="text" value={newSession.location} onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} placeholder="Location or video link" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleAddSession} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all">Schedule Session</button>
                    <button onClick={() => { setNewSession({ topic: '', date: '', time: '', duration: '', location: '', notes: '' }); setShowAddSession(false); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {upcomingSessions.length === 0 ? (
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">No upcoming training sessions scheduled.</p>
            ) : (
              <div className="space-y-2">
                {upcomingSessions.map(session => (
                  <div key={session.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    {editingSessionId === session.id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic *</label>
                          <input
                            type="text"
                            value={editingSessionData.topic}
                            onChange={(e) => setEditingSessionData({ ...editingSessionData, topic: e.target.value })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                            <input
                              type="date"
                              value={editingSessionData.date}
                              onChange={(e) => setEditingSessionData({ ...editingSessionData, date: e.target.value })}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                            <input
                              type="time"
                              value={editingSessionData.time}
                              onChange={(e) => setEditingSessionData({ ...editingSessionData, time: e.target.value })}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                            <input
                              type="text"
                              value={editingSessionData.duration}
                              onChange={(e) => setEditingSessionData({ ...editingSessionData, duration: e.target.value })}
                              placeholder="e.g., 2 hours"
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                            <input
                              type="text"
                              value={editingSessionData.location}
                              onChange={(e) => setEditingSessionData({ ...editingSessionData, location: e.target.value })}
                              placeholder="Location or video link"
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveSessionEdit}
                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-all"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingSessionId(null); setEditingSessionData({}); }}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{session.topic}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                              <span>📅 {formatDateShort(session.date)}</span>
                              {session.time && <span>🕐 {session.time}</span>}
                              {session.duration && <span>⏱️ {session.duration}</span>}
                              {session.location && <span>📍 {session.location}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditSession(session)}
                              className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Training History */}
          {trainingHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Training History</h3>
              <div className="space-y-2">
                {trainingHistory.slice(0, 5).map(training => (
                  <div key={training.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{training.topic}</p>
                      {training.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{training.notes}</p>}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{formatDateShort(training.completedDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* SECTION 5: Market Strategy */}
      <CollapsibleSection
        title="Market Strategy"
        icon="📈"
        isExpanded={expandedSections.strategy}
        onToggle={() => toggleSection('strategy')}
      >
        <div className="space-y-4">
          {strategyFields.map(field => (
            <div key={field.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                {editingStrategyField !== field.key && (
                  <button
                    onClick={() => handleEditStrategyField(field.key)}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>✏️</span>
                    <span>Edit</span>
                  </button>
                )}
              </div>
              
              {editingStrategyField === field.key ? (
                // Edit mode
                <div>
                  <textarea
                    value={editingStrategyValue}
                    onChange={(e) => setEditingStrategyValue(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows="4"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSaveStrategyField}
                      disabled={saving}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancelStrategyEdit}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-h-[60px]">
                  {marketStrategy[field.key] ? (
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{marketStrategy[field.key]}</p>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 italic">{field.placeholder}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

export default AgencyPlaybookTab;
