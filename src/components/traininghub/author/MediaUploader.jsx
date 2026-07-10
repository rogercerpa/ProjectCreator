import React, { useState } from 'react';

const { electronAPI } = window;

/**
 * Pick a media file and upload it into the course's shared media folder.
 * Calls onUploaded({ assetId, mediaType, fileName }) on success.
 */
const MediaUploader = ({ courseId, kind = 'image', onUploaded, label }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handlePick = async () => {
    setError(null);
    try {
      const pick = await electronAPI.trainingHubSelectMediaFile(kind);
      if (!pick?.success) {
        if (!pick?.canceled) setError(pick?.error || 'Could not select file');
        return;
      }
      setBusy(true);
      const res = await electronAPI.trainingHubUploadMedia(courseId, pick.filePath);
      if (res?.success) {
        onUploaded?.(res);
      } else {
        setError(res?.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
      >
        {busy ? 'Uploading…' : (label || (kind === 'video' ? 'Upload video file' : 'Upload image'))}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
};

export default MediaUploader;
