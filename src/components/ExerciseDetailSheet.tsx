import { getCatalogEntry } from '../lib/strengthCatalog'
import type { SessionExercise } from '../types'
import BottomSheet from './BottomSheet'
import { ExerciseIllustration } from './exerciseIllustrations'

interface ExerciseDetailSheetProps {
  exercise: SessionExercise
  onClose: () => void
}

export default function ExerciseDetailSheet({ exercise, onClose }: ExerciseDetailSheetProps) {
  const entry = getCatalogEntry(exercise.exerciseId)

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <ExerciseIllustration exerciseId={exercise.exerciseId} className="h-32 w-32 text-ink" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-ink">{exercise.name}</h2>
          {entry && <p className="mt-1 text-sm text-ink-faint">{entry.targetArea}</p>}
        </div>

        <div className="rounded-xl border border-border bg-surface-inset p-3 text-center">
          <p className="text-xs text-ink-faint">Prescription</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {exercise.sets} x {exercise.reps ?? `${exercise.holdSeconds}s hold`}
          </p>
        </div>

        {entry && entry.cues.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Cues</h3>
            <ul className="flex flex-col gap-2">
              {entry.cues.map((cue) => (
                <li key={cue} className="rounded-xl border border-border bg-surface-inset p-3 text-sm text-ink-muted">
                  {cue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry && (
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Common mistake</h3>
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {entry.commonMistake}
            </p>
          </div>
        )}

        {entry && (entry.easierVariation || entry.harderVariation) && (
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Variations</h3>
            <div className="flex flex-col gap-2">
              {entry.easierVariation && (
                <div className="rounded-xl border border-border bg-surface-inset p-3 text-sm">
                  <p className="text-xs text-ink-faint">Easier</p>
                  <p className="mt-1 text-ink-muted">{entry.easierVariation}</p>
                </div>
              )}
              {entry.harderVariation && (
                <div className="rounded-xl border border-border bg-surface-inset p-3 text-sm">
                  <p className="text-xs text-ink-faint">Harder</p>
                  <p className="mt-1 text-ink-muted">{entry.harderVariation}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
