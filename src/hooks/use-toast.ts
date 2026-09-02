import * as React from "react"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToastVariant = "default" | "destructive"

interface Toast {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
  open?: boolean
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

const listeners: Array<(state: Toast[]) => void> = []
let memoryState: Toast[] = []

function dispatch(toast: Toast) {
  memoryState = [toast, ...memoryState].slice(0, TOAST_LIMIT)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

export function useToast() {
  const [state, setState] = React.useState<Toast[]>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  const toast = React.useCallback(({ title, description, variant }: Omit<Toast, "id">) => {
    const id = genId()
    const newToast: Toast = { id, title, description, variant, open: true }
    dispatch(newToast)
    
    setTimeout(() => {
      memoryState = memoryState.filter((t) => t.id !== id)
      listeners.forEach((listener) => {
        listener(memoryState)
      })
    }, TOAST_REMOVE_DELAY)
    
    return { id, dismiss: () => {} }
  }, [])

  return {
    toasts: state,
    toast,
  }
}
