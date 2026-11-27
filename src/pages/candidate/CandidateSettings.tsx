import { useEffect, useState, type FormEvent } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/PageHeader';
import { SkillsInput } from '../../components/forms/SkillsInput';
import { Button, Card, Field, inputClass } from '../../components/ui/primitives';
import { ErrorState, LoadingState } from '../../components/ui/states';

export default function CandidateSettings() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(api.candidate.profile, []);

  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [expectedSalaryInr, setExpectedSalaryInr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.candidate) return;
    const prefs = data.candidate.preferences ?? {};
    setPreferredLocations(prefs.preferredLocations ?? []);
    setPreferredWorkModes(prefs.preferredWorkModes ?? []);
    setTargetRoles(prefs.targetRoles ?? []);
    setExpectedSalaryInr(data.candidate.expectedSalaryInr ? String(data.candidate.expectedSalaryInr) : '');
  }, [data]);

  const toggleWorkMode = (mode: string) => {
    setPreferredWorkModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.candidate.updateProfile({
        expectedSalaryInr: expectedSalaryInr.trim() ? Number(expectedSalaryInr) : null,
        preferences: {
          preferredLocations,
          preferredWorkModes,
          targetRoles,
        },
      });
      toast.success('Job preferences saved.');
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <LoadingState label="Loading candidate settings…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Candidate Portal"
        title="Preferences & Privacy"
        description="Guide Alternative Job Finder with your preferred Indian cities, work modes, and INR expectations."
      />

      <form onSubmit={save}>
        <Card className="p-6 space-y-5">
          <SkillsInput
            label="Preferred Cities / Locations"
            value={preferredLocations}
            onChange={setPreferredLocations}
            placeholder="e.g. Bengaluru, Pune, Hyderabad, Remote"
          />
          <SkillsInput
            label="Target Roles"
            value={targetRoles}
            onChange={setTargetRoles}
            placeholder="e.g. Full Stack Developer, Data Analyst"
          />

          <div>
            <p className="mb-2 text-xs font-semibold text-plum-900">Preferred Work Modes</p>
            <div className="flex flex-wrap gap-2">
              {['Remote', 'Hybrid', 'On-site'].map((mode) => {
                const active = preferredWorkModes.includes(mode);
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => toggleWorkMode(mode)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active ? 'border-accent bg-accent text-white' : 'border-lavender-200 bg-ivory text-plum-700 hover:bg-lavender-50'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Expected Annual Package (INR ₹)" hint="Used to help align job recommendations.">
            <input
              type="number"
              min="0"
              step="50000"
              className={`${inputClass} sm:max-w-xs`}
              value={expectedSalaryInr}
              onChange={(e) => setExpectedSalaryInr(e.target.value)}
              placeholder="e.g. 900000"
            />
          </Field>

          <div className="flex justify-end border-t border-lavender-100 pt-4">
            <Button type="submit" icon={Save} loading={saving}>Save Preferences</Button>
          </div>
        </Card>
      </form>

      <Card className="bg-mint-100/45 border-[#A8DFCA] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-mint-700" />
          <div className="text-xs leading-5 text-plum-900">
            <p className="font-bold text-plum-950">Your Privacy & Blind Screening Protection</p>
            <p className="mt-1">
              Core candidate features on TalentIQ are free. During initial recruiter blind screening, your name, email, phone, and personal links are redacted on the server, and protected traits are never used in match scoring.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
