import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

const DISMISS_THRESHOLD_PX = 120

interface BottomSheetProps {
  onClose: () => void
  children: ReactNode
}

/** Generic drag-to-dismiss bottom sheet. Separate from Modal.tsx, which is
 *  used for simpler tap-to-dismiss dialogs (LogRunForm, confirmations). */
export default function BottomSheet({ onClose, children }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef(0)

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    dragStartY.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    const offset = e.clientY - dragStartY.current
    setDragY(Math.max(0, offset))
  }

  function handlePointerUp() {
    if (dragY > DISMISS_THRESHOLD_PX) {
      onClose()
    } else {
      setDragY(0)
    }
    setDragging(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)]"
        style={{ transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : 'transform 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <span className="h-1.5 w-10 rounded-full bg-border" />
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}
