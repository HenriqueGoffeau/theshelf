const DRAG_THRESHOLD = 5
const EDGE = 64
const SCROLL_SPEED = 12

type Commit = (bookId: number, afterBookId: number | null) => Promise<void> | void

export function enableDragReorder(row: HTMLElement, commit: Commit): () => void {
  let dragging: HTMLElement | null = null
  let slot: HTMLElement | null = null
  let pointerId: number | null = null
  let startX = 0
  let grabX = 0
  let grabY = 0
  let lastX = 0
  let lastY = 0
  let armed = false
  let scrollTimer: number | null = null

  const others = () =>
    [...row.querySelectorAll<HTMLElement>('.spine')].filter((node) => node !== dragging)

  const stopAutoScroll = () => {
    if (scrollTimer !== null) {
      window.clearInterval(scrollTimer)
      scrollTimer = null
    }
  }

  const place = () => {
    if (!slot) return
    let after: HTMLElement | null = null

    for (const node of others()) {
      const box = node.getBoundingClientRect()
      if (lastX > box.left + box.width / 2) after = node
    }

    if (after) {
      if (after.nextElementSibling !== slot) after.after(slot)
    } else if (row.firstElementChild !== slot) {
      row.prepend(slot)
    }
  }

  const autoScroll = () => {
    const box = row.getBoundingClientRect()
    const speed =
      lastX < box.left + EDGE ? -SCROLL_SPEED : lastX > box.right - EDGE ? SCROLL_SPEED : 0

    if (speed === 0) {
      stopAutoScroll()
      return
    }
    if (scrollTimer !== null) return

    scrollTimer = window.setInterval(() => {
      const before = row.scrollLeft
      row.scrollLeft += speed
      if (row.scrollLeft !== before) place()
    }, 16)
  }

  const follow = () => {
    if (!dragging) return
    dragging.style.left = `${lastX - grabX}px`
    dragging.style.top = `${lastY - grabY}px`
  }

  const arm = () => {
    if (!dragging || pointerId === null) return
    const box = dragging.getBoundingClientRect()

    grabX = lastX - box.left
    grabY = lastY - box.top

    slot = document.createElement('div')
    slot.className = 'spine-slot'
    slot.style.width = `${box.width}px`
    slot.style.height = `${box.height}px`
    dragging.after(slot)

    dragging.style.position = 'fixed'
    dragging.style.margin = '0'
    dragging.style.width = `${box.width}px`
    dragging.style.height = `${box.height}px`
    dragging.style.transform = 'none'
    dragging.style.cursor = 'grabbing'
    dragging.classList.add('is-dragging')
    dragging.setPointerCapture(pointerId)

    document.body.classList.add('is-dragging-spine')
    armed = true
    follow()
  }

  const reset = (node: HTMLElement) => {
    node.classList.remove('is-dragging')
    node.style.position = ''
    node.style.margin = ''
    node.style.width = ''
    node.style.height = ''
    node.style.left = ''
    node.style.top = ''
    node.style.transform = ''
    node.style.cursor = 'grab'
  }

  const swallowNextClick = (node: HTMLElement) => {
    const swallow = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    node.addEventListener('click', swallow, { capture: true, once: true })
    window.setTimeout(() => node.removeEventListener('click', swallow, { capture: true }), 0)
  }

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const target = (event.target as HTMLElement).closest<HTMLElement>('.spine')
    if (!target || !row.contains(target)) return

    dragging = target
    pointerId = event.pointerId
    startX = event.clientX
    lastX = event.clientX
    lastY = event.clientY
    armed = false
  }

  const onMove = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return

    lastX = event.clientX
    lastY = event.clientY

    if (!armed) {
      if (Math.abs(event.clientX - startX) < DRAG_THRESHOLD) return
      arm()
      return
    }

    event.preventDefault()
    follow()
    place()
    autoScroll()
  }

  const finish = async (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return

    const node = dragging
    const marker = slot
    const wasArmed = armed

    stopAutoScroll()
    dragging = null
    slot = null
    pointerId = null
    armed = false
    document.body.classList.remove('is-dragging-spine')
    reset(node)

    if (!wasArmed || !marker) return

    marker.replaceWith(node)
    swallowNextClick(node)

    const bookId = Number(node.dataset.bookId)
    const previous = node.previousElementSibling as HTMLElement | null
    const afterBookId =
      previous && previous.classList.contains('spine') ? Number(previous.dataset.bookId) : null

    await commit(bookId, afterBookId)
  }

  const onUp = (event: PointerEvent) => void finish(event)

  row.addEventListener('pointerdown', onDown)
  row.addEventListener('pointermove', onMove)
  row.addEventListener('pointerup', onUp)
  row.addEventListener('pointercancel', onUp)

  return () => {
    stopAutoScroll()
    if (dragging) reset(dragging)
    slot?.remove()
    document.body.classList.remove('is-dragging-spine')
    row.removeEventListener('pointerdown', onDown)
    row.removeEventListener('pointermove', onMove)
    row.removeEventListener('pointerup', onUp)
    row.removeEventListener('pointercancel', onUp)
  }
}
