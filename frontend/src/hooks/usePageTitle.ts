import { useEffect } from 'react'

export function usePageTitle(title: string) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title ? `${title} - 算力小筑` : '算力小筑'
    
    return () => {
      document.title = prevTitle
    }
  }, [title])
}
