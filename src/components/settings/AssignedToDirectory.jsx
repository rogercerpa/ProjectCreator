import React, { useEffect, useState } from 'react';
import { orderedTeamMembers, namesMissingFromDirectory, roleLabel } from '../../services/TeamRosterService';

const { electronAPI } = window;

export default function AssignedToDirectory({ assignedNames = [] }) {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const settingsResult = await electronAPI.dasGeneralGetSettings();
        const loaded = await electronAPI.dasGeneralLoadAll(settingsResult?.settings?.filePath);
        if (!active) return;
        if (!loaded?.success) {
          setError(loaded?.message || 'The team directory could not be opened. Assignment dropdowns keep the last saved list.');
          setMembers([]);
          return;
        }
        setMembers(Array.isArray(loaded.data?.teamMembers) ? loaded.data.teamMembers : []);
        setError('');
      } catch (err) {
        if (active) setError(err.message || 'The team directory could not be opened.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const grouped = orderedTeamMembers(members);
  const missing = namesMissingFromDirectory(assignedNames, members);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assigned To</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          This list comes from DAS General → Team Members. Add or edit people there. Categories are AE, SAE, Lead, Manager, and L&T AE.
        </p>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading the team directory…</p>}
      {error && <p className="text-sm text-warning-700 dark:text-warning-300">{error}</p>}
      {!loading && grouped.length === 0 && !error && (
        <p className="text-sm text-gray-500">No team members yet. Add them on DAS General → Team Members.</p>
      )}
      <div className="space-y-2">
        {grouped.map((member) => (
          <div key={member.id || member.name} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <span className="font-medium text-gray-900 dark:text-white">{member.name}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{roleLabel(member.role)}</span>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="p-3 rounded-lg border border-warning-300 bg-warning-50 dark:border-warning-700 dark:bg-warning-900/20">
          <p className="text-sm font-semibold text-warning-800 dark:text-warning-200">In Assigned To, not in the team directory</p>
          <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">
            These names stay on old projects. Add them under Team Members if they should appear on new assignments.
          </p>
          <ul className="mt-2 text-sm text-warning-900 dark:text-warning-100">
            {missing.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
