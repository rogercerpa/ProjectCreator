import React from 'react';
import './AgencyTableView.css';

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
      <div className="table-empty-state">
        <div className="empty-icon">📋</div>
        <h3>No Agencies Found</h3>
        <p>No agencies match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="agency-table-container">
      <div className="table-wrapper">
        <table className="agency-table">
          <thead>
            <tr>
              <th className="table-header">Agency Name</th>
              <th className="table-header">Contact</th>
              <th className="table-header">Role</th>
              <th className="table-header">Region</th>
              <th className="table-header">Phone</th>
              <th className="table-header">Email</th>
              <th className="table-header">Fast Service</th>
              <th className="table-header">SAE</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map((agency) => (
              <tr
                key={agency.id}
                className="agency-row"
                onClick={(e) => handleRowClick(agency, e)}
              >
                <td className="agency-name-cell">
                  <div className="name-container">
                    <span className="agency-name" title={agency.agencyName}>
                      {agency.agencyName}
                    </span>
                    {agency.agencyNumber && (
                      <span className="agency-number" title={`Agency #${agency.agencyNumber}`}>
                        #{agency.agencyNumber}
                      </span>
                    )}
                  </div>
                </td>
                <td className="contact-cell">
                  <div className="contact-info">
                    <span className="contact-name">{agency.contactName}</span>
                    {agency.mainContact && (
                      <span className="main-contact" title="Main Contact">
                        {agency.mainContact}
                      </span>
                    )}
                  </div>
                </td>
                <td className="role-cell">
                  <span className="role-value">{agency.role}</span>
                </td>
                <td className="region-cell">
                  <span className={`region-badge region-${agency.region?.toLowerCase().replace(/\s+/g, '-')}`}>
                    {agency.region}
                  </span>
                </td>
                <td className="phone-cell">
                  <a href={`tel:${agency.phoneNumber}`} className="phone-link">
                    {formatPhoneNumber(agency.phoneNumber)}
                  </a>
                </td>
                <td className="email-cell">
                  <a href={`mailto:${agency.contactEmail}`} className="email-link">
                    {agency.contactEmail}
                  </a>
                </td>
                <td className="fast-service-cell">
                  <span className={`service-badge ${agency.fastService === 'Yes' ? 'service-yes' : 'service-no'}`}>
                    {agency.fastService === 'Yes' ? '⚡ Yes' : 'No'}
                  </span>
                </td>
                <td className="sae-cell">
                  <span className={`service-badge ${agency.sae === 'Yes' ? 'service-yes' : 'service-no'}`}>
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
