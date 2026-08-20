'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { findExistingPatient } from '@/lib/patient-lookup';
import { ProgressSteps } from '@/components/booking/progress-steps';
import { StepReason } from '@/components/booking/step-reason';
import { StepDentist } from '@/components/booking/step-dentist';
import { StepDateTime } from '@/components/booking/step-datetime';
import { StepDetails, validateDetails } from '@/components/booking/step-details';
import { StepReview } from '@/components/booking/step-review';
import { StepConfirmation } from '@/components/booking/step-confirmation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const TOTAL_STEPS = 5;

const emptyPatient = { name: '', email: '', phone: '', dob: '', notes: '' };

export function BookingWizard({ initialDentistId }) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [reason, setReason] = useState('');
  const [dentistId, setDentistId] = useState(initialDentistId || '');
  const [dentists, setDentists] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState(null);
  const [patient, setPatient] = useState(emptyPatient);
  const [matchedPatient, setMatchedPatient] = useState(null);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState(null);

  function goTo(n) {
    setDirection(n > step ? 1 : -1);
    setStep(n);
  }

  function next() {
    if (step === 1 && !reason) return toast.error('Choose a reason for your visit');
    if (step === 2 && !dentistId) return toast.error('Choose a dentist, or "No preference"');
    if (step === 3 && !slot) return toast.error('Pick an open time slot');
    if (step === 4) {
      const errs = validateDetails(patient);
      setErrors(errs);
      if (Object.keys(errs).length) return;
    }
    goTo(Math.min(step + 1, TOTAL_STEPS));
  }

  function back() {
    goTo(Math.max(step - 1, 1));
  }

  async function submit() {
    setSubmitting(true);
    try {
      let patientId = matchedPatient?.id;
      if (!patientId) {
        try {
          const created = await api.createPatient({
            name: patient.name,
            email: patient.email,
            phone: patient.phone || undefined,
            dob: patient.dob || undefined,
          });
          patientId = created.id;
        } catch (err) {
          // Someone booked with this email between our lookup and now (or
          // the lookup simply missed it) — patient-service rejects the
          // duplicate; fall back to re-searching instead of failing the
          // whole booking over a name that already exists.
          if (err.status === 409) {
            const rematch = await findExistingPatient({ email: patient.email, phone: patient.phone });
            if (!rematch) throw err;
            patientId = rematch.id;
          } else {
            throw err;
          }
        }
      }

      const resolvedDentistId = dentistId === 'any' ? slot.dentistId : Number(dentistId);

      const appt = await api.book({
        patient_id: patientId,
        dentist_id: resolvedDentistId,
        start: slot.start,
        end: slot.end,
        reason,
        notes: patient.notes || undefined,
        website: honeypot,
      });

      setAppointment(appt);
      goTo(6);
    } catch (err) {
      if (err.status === 409) {
        toast.error('That slot was just taken — please pick another time.');
        setSlot(null);
        setRefreshToken((t) => t + 1);
        goTo(3);
      } else {
        toast.error(err.message || 'Something went wrong — please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const dentistName =
    dentistId === 'any'
      ? dentists.find((d) => d.id === slot?.dentistId)?.name || 'Next available dentist'
      : dentists.find((d) => String(d.id) === dentistId)?.name || '—';

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  if (step === 6 && appointment) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <StepConfirmation appointment={appointment} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <ProgressSteps current={step} />

      <Card className="mt-2 overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {step === 1 && <StepReason value={reason} onChange={setReason} />}
              {step === 2 && (
                <StepDentist value={dentistId} onChange={setDentistId} onDentistsLoaded={setDentists} />
              )}
              {step === 3 && (
                <StepDateTime
                  dentistId={dentistId}
                  dentists={dentists}
                  date={date}
                  onDateChange={setDate}
                  slot={slot}
                  onSlotChange={setSlot}
                  onBackToDentist={() => goTo(2)}
                  refreshToken={refreshToken}
                />
              )}
              {step === 4 && (
                <StepDetails
                  patient={patient}
                  onChange={setPatient}
                  matchedPatient={matchedPatient}
                  onMatchedPatient={setMatchedPatient}
                  errors={errors}
                  honeypot={honeypot}
                  onHoneypotChange={setHoneypot}
                />
              )}
              {step === 5 && <StepReview state={{ reason, slot, patient }} dentistName={dentistName} onEditStep={goTo} />}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <Button variant="ghost" onClick={back} disabled={step === 1 || submitting}>
              <ArrowLeft className="mr-1.5 size-4" /> Back
            </Button>
            {step < TOTAL_STEPS ? (
              <Button onClick={next} className="rounded-full px-6">
                Continue <ArrowRight className="ml-1.5 size-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="rounded-full px-6">
                {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                {submitting ? 'Booking…' : 'Confirm & Book'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
