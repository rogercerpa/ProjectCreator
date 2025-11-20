import React, { useState, useEffect } from 'react';

const AgencyEditModal = ({ isOpen, onClose, agency, onSave, regionalTeams = [], assignedToOptions = [] }) => {
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fadeIn" onClick={handleOverlayClick}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-slideUp" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 relative rounded-t-xl">
          <h3 className="m-0 mb-2 text-2xl font-semibold text-gray-800 dark:text-gray-100">
            ✏️ Edit Agency
          </h3>
          <p className="m-0 text-sm text-gray-600 dark:text-gray-400">
            Update agency information and contact details
          </p>
          <button 
            className="absolute top-5 right-5 bg-transparent border-none text-2xl font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
            onClick={handleCancel}
            type="button"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Agency Number */}
            <div>
              <label htmlFor="agencyNumber" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Agency Number
              </label>
              <input
                type="text"
                id="agencyNumber"
                name="agencyNumber"
                value={formData.agencyNumber}
                onChange={handleInputChange}
                placeholder="Enter agency number"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            {/* Agency Name */}
            <div>
              <label htmlFor="agencyName" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Agency Name <span className="text-error-600 dark:text-error-400">*</span>
              </label>
              <input
                type="text"
                id="agencyName"
                name="agencyName"
                value={formData.agencyName}
                onChange={handleInputChange}
                placeholder="Enter agency name"
                className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.agencyName ? 'border-error-500 dark:border-error-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                required
              />
              {errors.agencyName && (
                <p className="mt-1 text-xs text-error-600 dark:text-error-400">{errors.agencyName}</p>
              )}
            </div>
            
            {/* Contact Name */}
            <div>
              <label htmlFor="contactName" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Contact Name <span className="text-error-600 dark:text-error-400">*</span>
              </label>
              <input
                type="text"
                id="contactName"
                name="contactName"
                value={formData.contactName}
                onChange={handleInputChange}
                placeholder="Enter contact name"
                className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.contactName ? 'border-error-500 dark:border-error-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                required
              />
              {errors.contactName && (
                <p className="mt-1 text-xs text-error-600 dark:text-error-400">{errors.contactName}</p>
              )}
            </div>
            
            {/* Contact Email */}
            <div>
              <label htmlFor="contactEmail" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Contact Email
              </label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleInputChange}
                placeholder="Enter contact email"
                className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.contactEmail ? 'border-error-500 dark:border-error-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.contactEmail && (
                <p className="mt-1 text-xs text-error-600 dark:text-error-400">{errors.contactEmail}</p>
              )}
            </div>
            
            {/* Contact Number */}
            <div>
              <label htmlFor="phoneNumber" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Contact Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="Enter contact number"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            {/* Role */}
            <div>
              <label htmlFor="role" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Role
              </label>
              <input
                type="text"
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                placeholder="Enter role"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            {/* Region */}
            <div>
              <label htmlFor="region" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Region
              </label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select region</option>
                {regionalTeams && regionalTeams.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            
            {/* Main Contact */}
            <div>
              <label htmlFor="mainContact" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Main Contact
              </label>
              <select
                id="mainContact"
                name="mainContact"
                value={formData.mainContact}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select main contact</option>
                {assignedToOptions && assignedToOptions.map(contact => (
                  <option key={contact} value={contact}>{contact}</option>
                ))}
              </select>
            </div>
            
            {/* SAE */}
            <div>
              <label htmlFor="sae" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                SAE
              </label>
              <select
                id="sae"
                name="sae"
                value={formData.sae}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>
          
          {/* Submit Error */}
          {errors.submit && (
            <div className="mt-4 p-3 rounded-lg bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 border border-error-200 dark:border-error-800 text-sm">
              {errors.submit}
            </div>
          )}
        </form>
        
        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button 
            type="button" 
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                Saving...
              </>
            ) : (
              <>
                💾 Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgencyEditModal;
