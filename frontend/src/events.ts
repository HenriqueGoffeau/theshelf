export const LIBRARY_CHANGED = 'shelf:changed'

export function libraryChanged(): void {
  window.dispatchEvent(new CustomEvent(LIBRARY_CHANGED))
}

export function onLibraryChanged(listener: () => void): () => void {
  window.addEventListener(LIBRARY_CHANGED, listener)
  return () => window.removeEventListener(LIBRARY_CHANGED, listener)
}
