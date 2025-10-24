import React from 'react';

function AgencyTableView({ agencies, onAgencySelect }) {
  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const handleRowClick = (agency, e) => {
    // Prevent row click when clicking on specific elements
    if (e.target.closest('.row-actions')) return;
    onAgencySelect(agency);
  };

  if (agencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Agencies Found</h3>
        <p className="text-gray-600 dark:text-gray-400">No agencies match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">Agency Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">Contact</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">Region</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">Fast Service</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 z-10">SAE</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map((agency) => (
              <tr
                key={agency.id}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-0"
                onClick={(e) => handleRowClick(agency, e)}
              >
                <td className="px-4 py-3 min-w-[200px] max-w-[250px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-blue-900 dark:text-blue-200 text-sm leading-tight" title={agency.agencyName}>
                      {agency.agencyName}
                    </span>
                    {agency.agencyNumber && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded w-fit" title={`Agency #${agency.agencyNumber}`}>
                        #{agency.agencyNumber}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 min-w-[150px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-gray-900 dark:text-white">{agency.contactName}</span>
                    {agency.mainContact && (
                      <span className="text-xs text-gray-500 dark:text-gray-400" title="Main Contact">
                        {agency.mainContact}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-700 dark:text-gray-300">{agency.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                    {agency.region}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <a href={`tel:${agency.phoneNumber}`} className="text-primary-600 dark:text-primary-400 hover:underline">
                    {formatPhoneNumber(agency.phoneNumber)}
                  </a>
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">
                  <a href={`mailto:${agency.contactEmail}`} className="text-primary-600 dark:text-primary-400 hover:underline" title={agency.contactEmail}>
                    {agency.contactEmail}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    agency.fastService === 'Yes' 
                      ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {agency.fastService === 'Yes' ? '⚡ Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    agency.sae === 'Yes' 
                      ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {agency.sae === 'Yes' ? 'SAE' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AgencyTableView;
