export type Child = Node | string | number | null | undefined | false | Child[]

export type Props = Record<string, unknown>

const ATTRIBUTE_ONLY = new Set(['list', 'form'])

function appendChild(parent: Node, child: Child): void {
  if (child === null || child === undefined || child === false) return
  if (Array.isArray(child)) {
    for (const entry of child) appendChild(parent, entry)
    return
  }
  parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)))
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue

    if (key === 'class') node.className = String(value)
    else if (key === 'text') node.textContent = String(value)
    else if (key === 'for') node.setAttribute('for', String(value))
    else if (key === 'dataset') Object.assign(node.dataset, value as Record<string, string>)
    else if (key === 'style' && typeof value === 'object') {
      for (const [prop, raw] of Object.entries(value as Record<string, string>)) {
        if (raw === undefined || raw === null) continue
        if (prop.startsWith('--')) node.style.setProperty(prop, String(raw))
        else Reflect.set(node.style, prop, raw)
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    } else if (key in node && !ATTRIBUTE_ONLY.has(key)) {
      Reflect.set(node, key, value)
    } else {
      node.setAttribute(key, String(value))
    }
  }

  appendChild(node, children)
  return node
}

export function frag(...children: Child[]): DocumentFragment {
  const fragment = document.createDocumentFragment()
  appendChild(fragment, children)
  return fragment
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export function mount(parent: Node, ...children: Child[]): void {
  clear(parent)
  appendChild(parent, children)
}

export function on<K extends keyof HTMLElementEventMap>(
  node: HTMLElement,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
): void {
  node.addEventListener(type, handler as EventListener)
}
