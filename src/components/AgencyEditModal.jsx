import React, { useState, useEffect } from 'react';
import './AgencyEditModal.css';

const AgencyEditModal = ({ isOpen, onClose, agency, onSave }) => {
  const [formData, setFormData] = useState({
    agencyNumber: '',
    agencyName: '',
    contactName: '',
    contactEmail: '',
    phoneNumber: '',
    role: '',
    region: '',
    mainContact: '',
    sae: 'No'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Populate form when agency changes or modal opens
  useEffect(() => {
    if (agency && isOpen) {
      setFormData({
        agencyNumber: agency.agencyNumber || '',
        agencyName: agency.agencyName || '',
        contactName: agency.contactName || '',
        contactEmail: agency.contactEmail || '',
        phoneNumber: agency.phoneNumber || '',
        role: agency.role || '',
        region: agency.region || '',
        mainContact: agency.mainContact || '',
        sae: agency.sae || 'No'
      });
      setErrors({});
    }
  }, [agency, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.agencyName.trim()) {
      newErrors.agencyName = 'Agency name is required';
    }
    
    if (!formData.contactName.trim()) {
      newErrors.contactName = 'Contact name is required';
    }
    
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const updatedAgency = {
        ...agency,
        ...formData
      };
      
      await onSave(updatedAgency);
      onClose();
    } catch (error) {
      console.error('Error saving agency:', error);
      setErrors({ submit: 'Failed to save agency. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      agencyNumber: '',
      agencyName: '',
      contactName: '',
      contactEmail: '',
      phoneNumber: '',
      role: '',
      region: '',
      mainContact: '',
      sae: 'No'
    });
    setErrors({});
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content agency-edit-modal">
        <div className="modal-header">
          <h3>✏️ Edit Agency</h3>
          <button 
            className="modal-close-btn"
            onClick={handleCancel}
            type="button"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="agencyNumber">Agency Number</label>
              <input
                type="text"
                id="agencyNumber"
                name="agencyNumber"
                value={formData.agencyNumber}
                onChange={handleInputChange}
                placeholder="Enter agency number"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="agencyName">Agency Name *</label>
              <input
                type="text"
                id="agencyName"
                name="agencyName"
                value={formData.agencyName}
                onChange={handleInputChange}
                placeholder="Enter agency name"
                className={errors.agencyName ? 'error' : ''}
                required
              />
              {errors.agencyName && <span className="error-message">{errors.agencyName}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="contactName">Contact Name *</label>
              <input
                type="text"
                id="contactName"
                name="contactName"
                value={formData.contactName}
                onChange={handleInputChange}
                placeholder="Enter contact name"
                className={errors.contactName ? 'error' : ''}
                required
              />
              {errors.contactName && <span className="error-message">{errors.contactName}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="contactEmail">Contact Email</label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleInputChange}
                placeholder="Enter contact email"
                className={errors.contactEmail ? 'error' : ''}
              />
              {errors.contactEmail && <span className="error-message">{errors.contactEmail}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="phoneNumber">Contact Number</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="Enter contact number"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <input
                type="text"
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                placeholder="Enter role"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="region">Region</label>
              <input
                type="text"
                id="region"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                placeholder="Enter region"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="mainContact">Main Contact</label>
              <input
                type="text"
                id="mainContact"
                name="mainContact"
                value={formData.mainContact}
                onChange={handleInputChange}
                placeholder="Enter main contact"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="sae">SAE</label>
              <select
                id="sae"
                name="sae"
                value={formData.sae}
                onChange={handleInputChange}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>
          
          {errors.submit && (
            <div className="error-message submit-error">
              {errors.submit}
            </div>
          )}
          
          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  💾 Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgencyEditModal;
