import React, { useState } from 'react';

function TeamMembersTab({ teamMembers = [], onDataChange, onSave, isLoading }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: '',
    phoneNumber: ''
  });
  const [saveStatus, setSaveStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Ensure teamMembers is an array
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : [];

  // Filter members by search term
  const filteredMembers = safeTeamMembers.filter(member => {
    const search = searchTerm.toLowerCase();
    return (
      member.name?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search) ||
      member.role?.toLowerCase().includes(search)
    );
  });

  // Handle starting edit
  const handleEdit = (member) => {
    setEditingId(member.id);
    setEditForm({ ...member });
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Handle saving edit
  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) {
      alert('Name is required');
      return;
    }

    setSaveStatus('saving');
    const updatedMembers = safeTeamMembers.map(m =>
      m.id === editingId ? { ...editForm } : m
    );

    const result = await onSave({ teamMembers: updatedMembers });
    
    if (result.success) {
      onDataChange(updatedMembers);
      setEditingId(null);
      setEditForm({});
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle adding new member
  const handleAdd = async () => {
    if (!newMember.name?.trim()) {
      alert('Name is required');
      return;
    }

    setSaveStatus('saving');
    const newId = `teammembers-${Date.now()}`;
    const memberToAdd = {
      ...newMember,
      id: newId
    };

    const updatedMembers = [...safeTeamMembers, memberToAdd];
    const result = await onSave({ teamMembers: updatedMembers });

    if (result.success) {
      onDataChange(updatedMembers);
      setIsAdding(false);
      setNewMember({ name: '', email: '', role: '', phoneNumber: '' });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle deleting member
  const handleDelete = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this team member?')) {
      return;
    }

    setSaveStatus('saving');
    const updatedMembers = safeTeamMembers.filter(m => m.id !== memberId);
    const result = await onSave({ teamMembers: updatedMembers });

    if (result.success) {
      onDataChange(updatedMembers);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Team Members
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {safeTeamMembers.length} member{safeTeamMembers.length !== 1 ? 's' : ''} in directory
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Save status indicator */}
          {saveStatus && (
            <span className={`text-sm font-medium ${
              saveStatus === 'saving' ? 'text-gray-500' :
              saveStatus === 'saved' ? 'text-success-600 dark:text-success-400' :
              'text-danger-600 dark:text-danger-400'
            }`}>
              {saveStatus === 'saving' ? '💾 Saving...' :
               saveStatus === 'saved' ? '✅ Saved!' :
               '❌ Save failed'}
            </span>
          )}
          
          {/* Search */}
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          {/* Add button */}
          <button
            onClick={() => setIsAdding(true)}
            disabled={isAdding || isLoading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>➕</span>
            Add Member
          </button>
        </div>
      </div>

      {/* Add new member form */}
      {isAdding && (
        <div className="p-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Add New Team Member
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={newMember.name}
                onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <input
                type="text"
                value={newMember.role}
                onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Job title or role"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={newMember.phoneNumber}
                onChange={(e) => setNewMember(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="555-123-4567"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setIsAdding(false);
                setNewMember({ name: '', email: '', role: '', phoneNumber: '' });
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isLoading || !newMember.name?.trim()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Add Member
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No matching members' : 'No team members yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm ? 'Try a different search term' : 'Click "Add Member" to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    {editingId === member.id ? (
                      // Edit mode
                      <>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="email"
                            value={editForm.email || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editForm.role || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="tel"
                            value={editForm.phoneNumber || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={isLoading}
                              className="px-3 py-1 bg-success-600 hover:bg-success-700 text-white text-sm rounded transition-colors disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View mode
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm">
                              {member.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {member.name || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {member.email ? (
                            <a 
                              href={`mailto:${member.email}`}
                              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                            >
                              {member.email}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {member.role || '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {member.phoneNumber || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(member)}
                              disabled={isLoading}
                              className="px-3 py-1 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(member.id)}
                              disabled={isLoading}
                              className="px-3 py-1 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamMembersTab;
