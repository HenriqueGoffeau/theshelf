const DRAG_THRESHOLD = 5
const EDGE = 64

type Commit = (bookId: number, afterBookId: number | null) => Promise<void> | void

export function enableDragReorder(row: HTMLElement, commit: Commit): () => void {
  let dragging: HTMLElement | null = null
  let pointerId: number | null = null
  let startX = 0
  let startScroll = 0
  let offset = 0
  let armed = false
  let scrollTimer: number | null = null

  const spines = () => [...row.querySelectorAll<HTMLElement>('.spine')]

  const stopAutoScroll = () => {
    if (scrollTimer !== null) {
      window.clearInterval(scrollTimer)
      scrollTimer = null
    }
  }

  const autoScroll = (clientX: number) => {
    const box = row.getBoundingClientRect()
    const speed =
      clientX < box.left + EDGE ? -12 : clientX > box.right - EDGE ? 12 : 0

    if (speed === 0) {
      stopAutoScroll()
      return
    }
    if (scrollTimer !== null) return
    scrollTimer = window.setInterval(() => {
      row.scrollLeft += speed
    }, 16)
  }

  const place = (clientX: number) => {
    if (!dragging) return
    let after: HTMLElement | null = null

    for (const node of spines()) {
      if (node === dragging) continue
      const box = node.getBoundingClientRect()
      if (clientX > box.left + box.width / 2) after = node
    }

    if (after) {
      if (after.nextElementSibling !== dragging) after.after(dragging)
    } else if (row.firstElementChild !== dragging) {
      row.prepend(dragging)
    }
  }

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const target = (event.target as HTMLElement).closest<HTMLElement>('.spine')
    if (!target || !row.contains(target)) return

    dragging = target
    pointerId = event.pointerId
    startX = event.clientX
    startScroll = row.scrollLeft
    offset = 0
    armed = false
  }

  const onMove = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return

    const travelled = event.clientX - startX
    if (!armed) {
      if (Math.abs(travelled) < DRAG_THRESHOLD) return
      armed = true
      dragging.classList.add('is-dragging')
      dragging.setPointerCapture(pointerId)
      document.body.style.userSelect = 'none'
    }

    event.preventDefault()
    offset = travelled + (row.scrollLeft - startScroll)
    dragging.style.transform = `translate(${offset}px, -18px) scale(1.03)`
    place(event.clientX)
    autoScroll(event.clientX)
  }

  const finish = async (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return
    const node = dragging
    const wasArmed = armed

    stopAutoScroll()
    dragging = null
    pointerId = null
    armed = false
    document.body.style.userSelect = ''
    node.classList.remove('is-dragging')
    node.style.transform = ''

    if (!wasArmed) return

    const bookId = Number(node.dataset.bookId)
    const previous = node.previousElementSibling as HTMLElement | null
    const afterBookId =
      previous && previous.classList.contains('spine') ? Number(previous.dataset.bookId) : null

    await commit(bookId, afterBookId)
  }

  row.addEventListener('pointerdown', onDown)
  row.addEventListener('pointermove', onMove)
  row.addEventListener('pointerup', (event) => void finish(event))
  row.addEventListener('pointercancel', (event) => void finish(event))

  return () => {
    stopAutoScroll()
    row.removeEventListener('pointerdown', onDown)
    row.removeEventListener('pointermove', onMove)
  }
}
