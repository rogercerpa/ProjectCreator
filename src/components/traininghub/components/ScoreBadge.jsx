import React from 'react';
import { STATUS_META } from '../utils';

const ScoreBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META['not-started'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

export default ScoreBadge;
