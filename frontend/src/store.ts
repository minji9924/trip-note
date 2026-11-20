import { useApiData } from './store.api'
import { useLocalData } from './store.local'

// local: 서버 없이 기기에만 저장 (기본)  /  api: Django 서버 연동 (빌드 시 --mode api)
export const MODE: 'local' | 'api' = import.meta.env.VITE_MODE === 'api' ? 'api' : 'local'
export const useAppData = MODE === 'api' ? useApiData : useLocalData
