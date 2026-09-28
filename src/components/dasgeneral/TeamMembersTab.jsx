import React, { useState } from 'react';
import { ROLE_CATEGORIES, canonicalRole, parseExpertise, roleLabel } from '../../services/TeamRosterService';
import { otherMachinesForMember } from '../../services/MachineClaimService';

function RoleSelect({ value, onChange, className }) {
  const known = canonicalRole(value);
  return (
    <select value={known} onChange={(event) => onChange(event.target.value)} className={className}>
      <option value="">{value && !known ? `Uncategorized (${value})` : 'Select category'}</option>
      {ROLE_CATEGORIES.map((category) => (
        <option key={category} value={category}>{category}</option>
      ))}
    </select>
  );
}

function TeamMembersTab({ teamMembers = [], machineUsers = [], hostname = '', onClaim, onDataChange, onSave, isLoading }) {
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
  const thisMachineClaim = (machineUsers || []).find((row) => (
    String(row?.machineName || '').trim().toLowerCase() === String(hostname || '').trim().toLowerCase()
  ));
  const isThisPc = (member) => (
    thisMachineClaim
    && String(thisMachineClaim.memberName || '').trim().toLowerCase() === String(member?.name || '').trim().toLowerCase()
  );

  const handleClaim = async (member) => {
    if (!onClaim) return;
    setSaveStatus('saving');
    try {
      const result = await onClaim(member);
      setSaveStatus(result?.success ? 'saved' : 'error');
      if (!result?.success && result?.error) {
        window.alert(result.error);
      }
    } catch (error) {
      setSaveStatus('error');
      window.alert(error.message || 'Could not claim this PC.');
    }
    setTimeout(() => setSaveStatus(null), 2000);
  };

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
    if (!canonicalRole(newMember.role)) {
      alert('Select a category: AE, SAE, Lead, Manager, or L&T AE.');
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
      {!thisMachineClaim && safeTeamMembers.length > 0 && (
        <div className="p-3 rounded-lg border border-primary-200 bg-primary-50 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
          Choose your name so this PC is recognized when DAS General is saved.
        </div>
      )}

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
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
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
          
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-48 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          <button
            onClick={() => setIsAdding(true)}
            disabled={isAdding || isLoading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
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
                Category <span className="text-danger-500">*</span>
              </label>
              <RoleSelect
                value={newMember.role}
                onChange={(role) => setNewMember((prev) => ({ ...prev, role }))}
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
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredMembers.map((member) => (
              <li key={member.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                {editingId === member.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        aria-label="Name"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        aria-label="Email"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <RoleSelect
                        value={editForm.role || ''}
                        onChange={(role) => setEditForm((prev) => ({ ...prev, role }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <input
                        type="tel"
                        value={editForm.phoneNumber || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        aria-label="Phone"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 text-sm rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-success-600 hover:bg-success-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 shrink-0 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm">
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            {member.name || '-'}
                          </span>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 whitespace-nowrap">
                            {roleLabel(member.role)}
                          </span>
                          {isThisPc(member) && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200 whitespace-nowrap">
                              You on this PC
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                          {member.email ? (
                            <a
                              href={`mailto:${member.email}`}
                              className="truncate max-w-full hover:text-primary-600 dark:hover:text-primary-400"
                            >
                              {member.email}
                            </a>
                          ) : (
                            <span>No email</span>
                          )}
                          <span className="whitespace-nowrap">{member.phoneNumber || 'No phone'}</span>
                        </div>
                        {parseExpertise(member.expertise).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {parseExpertise(member.expertise).map((item) => (
                              <span
                                key={`${item.product}-${item.level}`}
                                className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200"
                              >
                                {item.product} {item.level}
                              </span>
                            ))}
                          </div>
                        )}
                        {otherMachinesForMember(machineUsers, member.name, hostname).map((row) => (
                          <div key={row.machineName} className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Also on {row.machineName}{row.lastSeen ? `, last seen ${new Date(row.lastSeen).toLocaleDateString()}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 sm:pl-3">
                      {!isThisPc(member) && (
                        <button
                          onClick={() => handleClaim(member)}
                          disabled={isLoading}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          This is me
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(member)}
                        disabled={isLoading}
                        className="w-8 h-8 inline-flex items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        disabled={isLoading}
                        className="w-8 h-8 inline-flex items-center justify-center text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TeamMembersTab;
