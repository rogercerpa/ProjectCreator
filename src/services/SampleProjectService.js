function formatLocalDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function pairTaken(projects, rfaNumber, projectContainer) {
  return (projects || []).some((project) => (
    String(project?.rfaNumber || '') === rfaNumber
    && String(project?.projectContainer || '') === projectContainer
  ));
}

/**
 * Next in-app sample project. Names continue from existing samples.
 * RFA is digits-revision (900001-0). Container is year-five digits (26-00001).
 * Requested date and ECD fall 2 to 5 days out, with ECD on or after the requested date.
 */
export function nextSampleIdentity(projects, today = new Date()) {
  let number = 1;
  (projects || []).forEach((project) => {
    if (!project?.sampleProject) return;
    const match = String(project.projectName || '').match(/^Sample Project (\d+)$/i);
    if (match) number = Math.max(number, Number(match[1]) + 1);
  });

  const year = String(today.getFullYear()).slice(-2);
  let rfaNumber = `${900000 + number}-0`;
  let projectContainer = `${year}-${String(number).padStart(5, '0')}`;
  while (pairTaken(projects, rfaNumber, projectContainer) && number < 99999) {
    number += 1;
    rfaNumber = `${900000 + number}-0`;
    projectContainer = `${year}-${String(number).padStart(5, '0')}`;
  }

  const requestedOffset = 2 + ((number - 1) % 4);
  const ecdOffset = Math.min(5, requestedOffset + (number % 2 === 0 ? 1 : 0));

  return {
    number,
    projectName: `Sample Project ${number}`,
    rfaNumber,
    projectContainer,
    requestedDate: formatLocalDate(addDays(today, requestedOffset)),
    ecd: formatLocalDate(addDays(today, ecdOffset))
  };
}
