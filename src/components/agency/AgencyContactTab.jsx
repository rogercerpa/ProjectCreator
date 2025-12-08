import React from 'react';

function AgencyContactTab({ agency, allAgents = [] }) {
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const handleEmail = async (email) => {
    if (!email) return;
    const subject = `Contact: ${agency?.agencyName || 'Agency'}`;
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    await window.electronAPI.openExternal(mailtoUrl);
  };

  const handlePhone = (phone) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const renderContactCard = (contact, isMain = false) => (
    <div
      key={contact.id}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {contact.contactName || 'Unknown'}
            {isMain && (
              <span className="ml-2 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                Main Contact
              </span>
            )}
          </h3>
          {contact.role && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{contact.role}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {contact.phoneNumber && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">📞</span>
            <a
              href={`tel:${contact.phoneNumber}`}
              onClick={(e) => {
                e.preventDefault();
                handlePhone(contact.phoneNumber);
              }}
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              {formatPhoneNumber(contact.phoneNumber)}
            </a>
          </div>
        )}

        {contact.contactEmail && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">✉️</span>
            <a
              href={`mailto:${contact.contactEmail}`}
              onClick={(e) => {
                e.preventDefault();
                handleEmail(contact.contactEmail);
              }}
              className="text-primary-600 dark:text-primary-400 hover:underline break-all"
            >
              {contact.contactEmail}
            </a>
          </div>
        )}

        {contact.mainContact && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">📋</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Main Contact: {contact.mainContact}
            </span>
          </div>
        )}

        {contact.region && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">📍</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{contact.region}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Separate main contact from other agents
  const mainContact = allAgents.find(a => a.mainContact === 'Yes' || a.id === agency?.id) || agency;
  const otherAgents = allAgents.filter(a => 
    a.id !== mainContact?.id && a.id !== agency?.id
  );

  return (
    <div className="space-y-6">
      {/* Main Contact */}
      {mainContact && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Main Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderContactCard(mainContact, true)}
          </div>
        </div>
      )}

      {/* Other Agents */}
      {otherAgents.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            All Agents ({otherAgents.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherAgents.map(agent => renderContactCard(agent, false))}
          </div>
        </div>
      )}

      {/* No contacts message */}
      {allAgents.length === 0 && !agency && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No contact information available.</p>
        </div>
      )}
    </div>
  );
}

export default AgencyContactTab;

