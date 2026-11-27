import { Link } from 'react-router-dom';
import type { Candidate, Job, StoredMatch } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/primitives';
import { MatchBreakdown } from './MatchBreakdown';

export function MatchDetailModal({
  open,
  onClose,
  match,
  candidate,
  job,
  blindLabel,
}: {
  open: boolean;
  onClose: () => void;
  match: StoredMatch | null;
  candidate?: Candidate;
  job?: Job;
  blindLabel?: string;
}) {
  const displayCandidate = candidate ?? match?.candidate;
  const displayJob = job ?? match?.job;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Explainable AI Match & Evidence Ledger"
      description={
        match
          ? `Transparent match breakdown for ${blindLabel ?? displayCandidate?.name ?? 'candidate'} on ${displayJob?.title ?? 'job'}.`
          : undefined
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-[11px] text-plum-600 sm:block">Deterministic decision support — never an automated rejection.</p>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {displayCandidate && !blindLabel && (
              <Link to={`/candidates/${displayCandidate.id}`} onClick={onClose}>
                <Button>Open full profile</Button>
              </Link>
            )}
          </div>
        </div>
      }
    >
      {match ? <MatchBreakdown match={match} candidate={displayCandidate} job={displayJob} blindLabel={blindLabel} /> : null}
    </Modal>
  );
}
