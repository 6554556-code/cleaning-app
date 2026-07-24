import { useCallback, useSyncExternalStore } from 'react'

// Узкий экран? Нужен, чтобы веб-версия отдавала мобильную раскладку.
// Через useSyncExternalStore, а не useState+useEffect: так значение верное
// уже на первом кадре (без мигания десктопом) и нет setState внутри эффекта,
// на который ругается React Compiler.
export default function useIsMobile(breakpoint = 900) {
  const query = `(max-width:${breakpoint}px)`

  const subscribe = useCallback(onChange => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  // На сервере/без window считаем, что экран широкий
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
