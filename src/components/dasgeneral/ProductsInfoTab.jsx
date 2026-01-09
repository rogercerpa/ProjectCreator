import React, { useState } from 'react';

const { electronAPI } = window;

function ProductsInfoTab({ 
  productsInfo = [], 
  products = [], 
  onDataChange, 
  onSave, 
  onAddProduct, 
  onRemoveProduct,
  isLoading 
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [expandedProducts, setExpandedProducts] = useState({});

  // Ensure arrays are valid
  const safeProductsInfo = Array.isArray(productsInfo) ? productsInfo : [];
  const safeProducts = Array.isArray(products) ? products : [];

  // Filter products info by selected product
  const filteredInfo = selectedProduct === 'all' 
    ? safeProductsInfo 
    : safeProductsInfo.filter(p => p.product === selectedProduct);

  // Group products info by product for display
  const infoByProduct = {};
  safeProducts.forEach(product => {
    infoByProduct[product] = safeProductsInfo.find(p => p.product === product) || {
      id: `productsinfo-placeholder-${product}`,
      product: product,
      mainPOC: '',
      pocEmail: '',
      productStrategy: '',
      designPracticeType: 'Text',
      designPracticeContent: ''
    };
  });

  // Toggle product expansion
  const toggleExpanded = (product) => {
    setExpandedProducts(prev => ({
      ...prev,
      [product]: !prev[product]
    }));
  };

  // Handle starting edit
  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item });
    setExpandedProducts(prev => ({ ...prev, [item.product]: true }));
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Handle saving edit
  const handleSaveEdit = async () => {
    if (!editForm.product?.trim()) {
      alert('Product is required');
      return;
    }

    setSaveStatus('saving');
    
    // Check if this is an existing entry or a new one
    const existingIndex = safeProductsInfo.findIndex(p => p.id === editingId);
    let updatedInfo;
    
    if (existingIndex >= 0) {
      updatedInfo = safeProductsInfo.map(p =>
        p.id === editingId ? { ...editForm } : p
      );
    } else {
      // This is a new entry (from placeholder)
      const newId = `productsinfo-${Date.now()}`;
      updatedInfo = [...safeProductsInfo, { ...editForm, id: newId }];
    }

    const result = await onSave({ productsInfo: updatedInfo });
    
    if (result.success) {
      onDataChange(updatedInfo);
      setEditingId(null);
      setEditForm({});
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle adding new product
  const handleAddProductSubmit = async () => {
    if (!newProductName.trim()) {
      alert('Product name is required');
      return;
    }

    const result = await onAddProduct(newProductName.trim());
    if (result.success) {
      setNewProductName('');
      setShowAddProduct(false);
    }
  };

  // Handle opening link
  const handleOpenLink = (link, linkType) => {
    if (!link) return;
    
    if (linkType === 'URL') {
      electronAPI.openExternal(link);
    } else {
      electronAPI.openExternal(`file://${link}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Products Information
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Point of contacts, strategies, and design best practices
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
          
          {/* Product filter */}
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Products</option>
            {safeProducts.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>

          {/* Add product button */}
          <button
            onClick={() => setShowAddProduct(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>🏷️</span>
            Add Product
          </button>
        </div>
      </div>

      {/* Add new product dialog */}
      {showAddProduct && (
        <div className="p-6 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Add New Product
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="Product name"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-secondary-500"
            />
            <button
              onClick={handleAddProductSubmit}
              disabled={isLoading || !newProductName.trim()}
              className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddProduct(false);
                setNewProductName('');
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Products list */}
      <div className="space-y-4">
        {safeProducts.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-4xl mb-4">💡</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Products Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Add a product to start adding product information.
            </p>
          </div>
        ) : (selectedProduct === 'all' ? safeProducts : [selectedProduct]).map(product => {
          const info = infoByProduct[product];
          const isExpanded = expandedProducts[product] || selectedProduct !== 'all';
          const isEditing = editingId === info?.id;

          return (
            <div 
              key={product} 
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Product header */}
              <button
                onClick={() => toggleExpanded(product)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{product}</h3>
                    {info?.mainPOC && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        POC: {info.mainPOC}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!isEditing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(info);
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      ✏️ Edit
                    </button>
                  )}
                  <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </button>

              {/* Product content */}
              {isExpanded && (
                <div className="p-6">
                  {isEditing ? (
                    // Edit mode
                    <div className="space-y-6">
                      {/* Contact Information */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                          Contact Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Main Point of Contact
                            </label>
                            <input
                              type="text"
                              value={editForm.mainPOC || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, mainPOC: e.target.value }))}
                              placeholder="Contact name"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              POC Email
                            </label>
                            <input
                              type="email"
                              value={editForm.pocEmail || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, pocEmail: e.target.value }))}
                              placeholder="contact@example.com"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Product Strategy */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                          Product Strategy
                        </h4>
                        <textarea
                          value={editForm.productStrategy || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, productStrategy: e.target.value }))}
                          placeholder="Describe the product strategy..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-y"
                        />
                      </div>

                      {/* Design Best Practices */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                          Design Best Practices
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Content Type
                            </label>
                            <select
                              value={editForm.designPracticeType || 'Text'}
                              onChange={(e) => setEditForm(prev => ({ ...prev, designPracticeType: e.target.value }))}
                              className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="Text">Text Instructions</option>
                              <option value="URL">URL Link</option>
                              <option value="FilePath">File Path</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {editForm.designPracticeType === 'Text' 
                                ? 'Instructions' 
                                : editForm.designPracticeType === 'URL' 
                                  ? 'URL' 
                                  : 'File Path'}
                            </label>
                            {editForm.designPracticeType === 'Text' ? (
                              <textarea
                                value={editForm.designPracticeContent || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, designPracticeContent: e.target.value }))}
                                placeholder="Enter design best practices..."
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-y"
                              />
                            ) : (
                              <input
                                type="text"
                                value={editForm.designPracticeContent || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, designPracticeContent: e.target.value }))}
                                placeholder={editForm.designPracticeType === 'URL' 
                                  ? 'https://example.com/design-guide' 
                                  : 'Z:\\path\\to\\design-guide.pdf'}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={isLoading}
                          className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="space-y-6">
                      {/* Contact Information */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                          Contact Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Main Point of Contact</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {info?.mainPOC || <span className="text-gray-400 italic">Not specified</span>}
                            </p>
                          </div>
                          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">POC Email</p>
                            {info?.pocEmail ? (
                              <a 
                                href={`mailto:${info.pocEmail}`}
                                className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                {info.pocEmail}
                              </a>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Product Strategy */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                          Product Strategy
                        </h4>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                          {info?.productStrategy ? (
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {info.productStrategy}
                            </p>
                          ) : (
                            <p className="text-gray-400 italic">No strategy information available</p>
                          )}
                        </div>
                      </div>

                      {/* Design Best Practices */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                          Design Best Practices
                        </h4>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                          {info?.designPracticeContent ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                  info.designPracticeType === 'FilePath' 
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                    : info.designPracticeType === 'URL'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                }`}>
                                  {info.designPracticeType === 'FilePath' ? '📁 File' : 
                                   info.designPracticeType === 'URL' ? '🔗 URL' : '📝 Text'}
                                </span>
                              </div>
                              {info.designPracticeType === 'Text' ? (
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                  {info.designPracticeContent}
                                </p>
                              ) : (
                                <button
                                  onClick={() => handleOpenLink(info.designPracticeContent, info.designPracticeType)}
                                  className="text-primary-600 dark:text-primary-400 hover:underline break-all text-left"
                                >
                                  {info.designPracticeContent}
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="text-gray-400 italic">No design best practices documented</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductsInfoTab;
