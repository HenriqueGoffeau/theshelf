const FADE = 28

export function scrollFade(node: HTMLElement): () => void {
  node.classList.add('scroll-fade')

  let frame = 0

  const apply = () => {
    frame = 0
    const room = node.scrollHeight - node.clientHeight
    const top = room <= 1 ? 0 : Math.min(FADE, node.scrollTop)
    const bottom = room <= 1 ? 0 : Math.min(FADE, room - node.scrollTop)
    node.style.setProperty('--fade-top', `${Math.max(0, top)}px`)
    node.style.setProperty('--fade-bottom', `${Math.max(0, bottom)}px`)
  }

  const update = () => {
    if (frame) return
    frame = requestAnimationFrame(apply)
  }

  node.addEventListener('scroll', update, { passive: true })

  const resize = new ResizeObserver(update)
  resize.observe(node)

  const mutations = new MutationObserver(update)
  mutations.observe(node, { childList: true, subtree: true })

  apply()

  return () => {
    if (frame) cancelAnimationFrame(frame)
    node.removeEventListener('scroll', update)
    resize.disconnect()
    mutations.disconnect()
    node.classList.remove('scroll-fade')
    node.style.removeProperty('--fade-top')
    node.style.removeProperty('--fade-bottom')
  }
}
