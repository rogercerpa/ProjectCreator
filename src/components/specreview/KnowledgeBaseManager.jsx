import React, { useState, useEffect, useCallback } from 'react';

const { electronAPI } = window;

const VIEWS = [
  { id: 'products', label: 'Products' },
  { id: 'rules', label: 'Spec Rules' },
  { id: 'alternatives', label: 'Alternatives' }
];

const KnowledgeBaseManager = ({ onRefresh }) => {
  const [activeView, setActiveView] = useState('products');
  const [products, setProducts] = useState([]);
  const [specRules, setSpecRules] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [kbFilePath, setKbFilePath] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const [prodRes, rulesRes, altRes, pathRes] = await Promise.all([
        electronAPI.kbGetProducts(),
        electronAPI.kbGetSpecRules(),
        electronAPI.kbGetAlternatives(),
        electronAPI.kbGetFilePath()
      ]);

      if (prodRes.success) setProducts(prodRes.products || []);
      if (rulesRes.success) setSpecRules(rulesRes.specRules || []);
      if (altRes.success) setAlternatives(altRes.alternatives || []);
      if (pathRes.success) setKbFilePath(pathRes.filePath || '');

      if (forceRefresh) {
        await electronAPI.kbLoad(true);
        onRefresh?.();
      }
    } catch (err) {
      console.error('Failed to load KB data:', err);
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  useEffect(() => { loadData(); }, [loadData]);

  const notify = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ===== Products CRUD =====
  const handleSaveProduct = async (product) => {
    try {
      const result = editingItem
        ? await electronAPI.kbUpdateProduct(editingItem.catalogNumber, product)
        : await electronAPI.kbAddProduct(product);

      if (result.success) {
        notify(editingItem ? 'Product updated' : 'Product added', 'success');
        setEditingItem(null);
        setShowAddForm(false);
        loadData(true);
      } else {
        notify(result.error || 'Failed', 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (catalogNumber) => {
    try {
      const result = await electronAPI.kbDeleteProduct(catalogNumber);
      if (result.success) {
        notify('Product deprecated', 'success');
        loadData(true);
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // ===== Spec Rules CRUD =====
  const handleSaveRule = async (rule) => {
    try {
      const result = editingItem
        ? await electronAPI.kbUpdateSpecRule(editingItem.ruleId, rule)
        : await electronAPI.kbAddSpecRule(rule);

      if (result.success) {
        notify(editingItem ? 'Rule updated' : 'Rule added', 'success');
        setEditingItem(null);
        setShowAddForm(false);
        loadData(true);
      } else {
        notify(result.error || 'Failed', 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      const result = await electronAPI.kbDeleteSpecRule(ruleId);
      if (result.success) {
        notify('Rule deleted', 'success');
        loadData(true);
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // ===== BOM Enrichment =====
  const handleEnrichFromBOMs = async (forceRescan = false) => {
    setEnriching(true);
    setEnrichProgress(null);

    let cleanupListener = null;
    if (electronAPI.onKBEnrichmentProgress) {
      cleanupListener = electronAPI.onKBEnrichmentProgress((data) => {
        setEnrichProgress(data);
      });
    }

    try {
      const result = await electronAPI.kbEnrichFromBOMs({ forceRescan });
      if (result.success) {
        const msg = result.added.length > 0
          ? `Added ${result.added.length} new products from BOM data (${result.totalScanned} scanned, ${result.alreadyReviewed} already reviewed, ${result.skipped.length} skipped)`
          : `No new products found (${result.totalScanned} scanned, ${result.alreadyReviewed} already reviewed)`;
        notify(msg, result.added.length > 0 ? 'success' : 'info');
        if (result.added.length > 0) {
          loadData(true);
        }
      } else {
        notify(result.error || 'Enrichment failed', 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      if (cleanupListener) cleanupListener();
      setEnriching(false);
      setEnrichProgress(null);
    }
  };

  // ===== Filtering =====
  const filteredProducts = products.filter(p =>
    (p.catalogNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.productFamily || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.capabilities || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRules = specRules.filter(r =>
    (r.ruleId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.requirementName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.keywords || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAlternatives = alternatives.filter(a =>
    (a.specRequirement || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.acuityAlternative || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => { setActiveView(v.id); setSearchTerm(''); setShowAddForm(false); setEditingItem(null); }}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeView === v.id
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {v.label} ({v.id === 'products' ? products.length : v.id === 'rules' ? specRules.length : alternatives.length})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEnrichFromBOMs(false)}
            disabled={enriching}
            className="px-3 py-1.5 text-xs border border-amber-400 dark:border-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-400 disabled:opacity-50"
            title="Scan BOM catalog and add new products to the Knowledge Base"
          >
            {enriching ? 'Enriching...' : 'Enrich from BOMs'}
          </button>
          <button
            onClick={() => loadData(true)}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            Refresh
          </button>
          <button
            onClick={() => { setShowAddForm(true); setEditingItem(null); }}
            className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            + Add
          </button>
        </div>
      </div>

      {/* KB file path */}
      {kbFilePath && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Source: {kbFilePath}</p>
      )}

      {/* Notification */}
      {notification && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          notification.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
          notification.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
          'bg-blue-50 text-blue-700'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Enrichment Progress Panel */}
      {enriching && enrichProgress && (
        <div className="mb-4 p-4 border border-amber-200 dark:border-amber-700 rounded-lg bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {enrichProgress.phase === 'scanning' && 'Scanning BOM catalog...'}
              {enrichProgress.phase === 'writing' && 'Writing to Knowledge Base...'}
              {enrichProgress.phase === 'saving' && 'Saving enrichment log...'}
              {enrichProgress.phase === 'complete' && 'Enrichment complete'}
            </span>
            {enrichProgress.total > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {enrichProgress.current} / {enrichProgress.total}
              </span>
            )}
          </div>
          <div className="w-full bg-amber-200/50 dark:bg-amber-800/30 rounded-full h-2 mb-2">
            <div
              className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full transition-all duration-300"
              style={{ width: enrichProgress.total > 0 ? `${Math.min(100, Math.round((enrichProgress.current / enrichProgress.total) * 100))}%` : '0%' }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-400">
            <span className="truncate mr-2">
              {enrichProgress.currentItem && enrichProgress.phase === 'scanning' && `Checking: ${enrichProgress.currentItem}`}
              {enrichProgress.phase === 'writing' && 'Batch writing products to Excel...'}
              {enrichProgress.phase === 'saving' && 'Finalizing...'}
              {enrichProgress.phase === 'complete' && 'Done'}
            </span>
            <span className="flex-shrink-0">
              {enrichProgress.added > 0 && <span className="text-green-600 dark:text-green-400 mr-2">{enrichProgress.added} new</span>}
              {enrichProgress.skipped > 0 && <span className="text-gray-500 mr-2">{enrichProgress.skipped} skipped</span>}
              {enrichProgress.alreadyReviewed > 0 && <span className="text-gray-400">{enrichProgress.alreadyReviewed} already reviewed</span>}
            </span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder={`Search ${activeView}...`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
        />
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingItem) && (
        <div className="mb-6 p-4 border border-primary-200 dark:border-primary-700 rounded-lg bg-primary-50/30 dark:bg-primary-900/10">
          <h3 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">
            {editingItem ? 'Edit' : 'Add'} {activeView === 'products' ? 'Product' : activeView === 'rules' ? 'Spec Rule' : 'Alternative'}
          </h3>
          {activeView === 'products' && (
            <ProductForm item={editingItem} onSave={handleSaveProduct} onCancel={() => { setEditingItem(null); setShowAddForm(false); }} />
          )}
          {activeView === 'rules' && (
            <RuleForm item={editingItem} onSave={handleSaveRule} onCancel={() => { setEditingItem(null); setShowAddForm(false); }} />
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Products Table */}
          {activeView === 'products' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Catalog #</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Family</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Category</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Description</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Capabilities</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Active</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, i) => (
                    <tr key={i} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${p.active === 'No' ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 font-mono font-medium text-gray-800 dark:text-gray-200 text-xs">{p.catalogNumber}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{p.productFamily}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{p.category}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">{p.description}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(p.capabilities || '').split(',').slice(0, 3).map((c, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px]">
                              {c.trim()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">{p.active === 'No' ? '❌' : '✅'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingItem(p); setShowAddForm(false); }} className="text-xs text-primary-600 hover:underline">Edit</button>
                          <button onClick={() => handleDeleteProduct(p.catalogNumber)} className="text-xs text-red-500 hover:underline">Deprecate</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Spec Rules Table */}
          {activeView === 'rules' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Rule ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Requirement</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Category</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Keywords</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Primary Device(s)</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Can Meet</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">{r.ruleId}</td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200">{r.requirementName}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{r.category}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{r.keywords}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{r.primaryDevices}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded ${
                          r.acuityCanMeet === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          r.acuityCanMeet === 'Partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {r.acuityCanMeet}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingItem(r); setShowAddForm(false); }} className="text-xs text-primary-600 hover:underline">Edit</button>
                          <button onClick={() => handleDeleteRule(r.ruleId)} className="text-xs text-red-500 hover:underline">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Alternatives Table */}
          {activeView === 'alternatives' && (
            <div className="space-y-3">
              {filteredAlternatives.map((alt, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{alt.specRequirement}</h4>
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Alternative: {alt.acuityAlternative}</p>
                      {alt.alternativeCatalogNumber && (
                        <p className="text-xs font-mono text-gray-500 mt-1">Devices: {alt.alternativeCatalogNumber}</p>
                      )}
                      {alt.whyItsBetter && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{alt.whyItsBetter}</p>
                      )}
                      {alt.limitations && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Limitations: {alt.limitations}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ===== Product Form =====
const ProductForm = ({ item, onSave, onCancel }) => {
  const [form, setForm] = useState({
    catalogNumber: item?.catalogNumber || '',
    productFamily: item?.productFamily || '',
    category: item?.category || '',
    description: item?.description || '',
    capabilities: item?.capabilities || '',
    mountingType: item?.mountingType || '',
    voltage: item?.voltage || '',
    platform: item?.platform || '',
    notes: item?.notes || '',
    active: item?.active || 'Yes'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.catalogNumber.trim()) return;
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <input type="text" placeholder="Catalog Number *" value={form.catalogNumber} onChange={e => setForm(f => ({ ...f, catalogNumber: e.target.value }))} disabled={!!item}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50" />
      <input type="text" placeholder="Product Family" value={form.productFamily} onChange={e => setForm(f => ({ ...f, productFamily: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Mounting Type" value={form.mountingType} onChange={e => setForm(f => ({ ...f, mountingType: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Capabilities (comma-separated)" value={form.capabilities} onChange={e => setForm(f => ({ ...f, capabilities: e.target.value }))}
        className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
      </div>
    </form>
  );
};

// ===== Spec Rule Form =====
const RuleForm = ({ item, onSave, onCancel }) => {
  const [form, setForm] = useState({
    ruleId: item?.ruleId || '',
    requirementName: item?.requirementName || '',
    category: item?.category || '',
    keywords: item?.keywords || '',
    primaryDevices: item?.primaryDevices || '',
    alternativeDevices: item?.alternativeDevices || '',
    quantityGuidance: item?.quantityGuidance || '',
    whenToUse: item?.whenToUse || '',
    alternativeNotes: item?.alternativeNotes || '',
    acuityCanMeet: item?.acuityCanMeet || 'Yes',
    gapNotes: item?.gapNotes || '',
    notes: item?.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.ruleId.trim() || !form.requirementName.trim()) return;
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <input type="text" placeholder="Rule ID *" value={form.ruleId} onChange={e => setForm(f => ({ ...f, ruleId: e.target.value }))} disabled={!!item}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50" />
      <input type="text" placeholder="Requirement Name *" value={form.requirementName} onChange={e => setForm(f => ({ ...f, requirementName: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
        <option value="">Category</option>
        <option value="Energy">Energy</option>
        <option value="Life Safety">Life Safety</option>
        <option value="Integration">Integration</option>
        <option value="Controls">Controls</option>
        <option value="Power">Power</option>
        <option value="Commissioning">Commissioning</option>
      </select>
      <select value={form.acuityCanMeet} onChange={e => setForm(f => ({ ...f, acuityCanMeet: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
        <option value="Yes">Yes - Can Meet</option>
        <option value="Partial">Partial - Alternative</option>
        <option value="No">No - Gap</option>
      </select>
      <input type="text" placeholder="Keywords (comma-separated)" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
        className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Primary Device(s) - catalog numbers" value={form.primaryDevices} onChange={e => setForm(f => ({ ...f, primaryDevices: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Alternative Device(s)" value={form.alternativeDevices} onChange={e => setForm(f => ({ ...f, alternativeDevices: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Quantity Guidance" value={form.quantityGuidance} onChange={e => setForm(f => ({ ...f, quantityGuidance: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="When To Use" value={form.whenToUse} onChange={e => setForm(f => ({ ...f, whenToUse: e.target.value }))}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <input type="text" placeholder="Gap Notes (if partial/no)" value={form.gapNotes} onChange={e => setForm(f => ({ ...f, gapNotes: e.target.value }))}
        className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
      </div>
    </form>
  );
};

export default KnowledgeBaseManager;
