// ─────────────────────────────────────────────────────────────────
//  НАСТРОЙКИ ВЕБ-ВЕРСИИ
//  Логотип, реквизиты подвала, палитра и формат цен. Правится здесь —
//  меняется на всех веб-экранах (витрина, бронь и все следующие).
// ─────────────────────────────────────────────────────────────────

import { OPERATOR } from './legalDocs'

// ─── ЛОГОТИП ────────────────────────────────────────────────────
// Файл лежит в public/. Если не найден или строка пустая — нарисуется
// встроенная иконка, сайт не сломается.
export const LOGO_SRC = '/logo.png'

// ─── ПОДВАЛ: контакты и ссылки ──────────────────────────────────
// Реквизиты (название, ИНН, ОГРН, адрес, почта) берутся из src/legalDocs.js —
// там же они подставляются в тексты документов. Правь их только там.
// Любую строку ниже можно оставить пустой ('') — она просто не отобразится.
export const FOOTER = {
  company: OPERATOR.name,
  inn: OPERATOR.inn,
  ogrn: OPERATOR.ogrn,
  address: OPERATOR.address,
  phone: '',
  email: OPERATOR.email,
  legal: [
    { label: 'Пользовательское соглашение', href: '/terms' },
    { label: 'Политика конфиденциальности', href: '/privacy' },
    { label: 'Публичная оферта', href: '/offer' },
  ],
  socials: [
    { label: 'Telegram', href: OPERATOR.telegram },
  ],
}

// ─── ПАЛИТРА ВЕБА ───────────────────────────────────────────────
export const Y = '#FDB813'        // основной жёлтый
export const YP = '#EBA800'       // жёлтый при наведении/нажатии
export const Y_SOFT = '#FBF0D2'   // мягкая жёлтая плашка
export const Y_TINT = '#FFFDF6'   // почти белый с жёлтым подтоном
export const Y_DARK = '#7A5A0A'   // тёмно-жёлтый текст на мягкой плашке
export const INK = '#1A1A1A'
export const MUTED = '#8C8C8C'
export const LINE = '#ECECEC'
export const LINE_2 = '#F0EDE6'
export const BG = '#FBFAF7'

export const ROLE_BTN = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', height: 50,
  borderRadius: 13, fontSize: 15, fontWeight: 600,
  background: '#F4F2ED', color: '#4A4A4A', textDecoration: 'none', whiteSpace: 'nowrap',
}

// Цена в едином виде: 2 500 ₽ (как на витрине)
export function rub(n) {
  return `${Number(n || 0).toLocaleString('ru-RU')} ₽`
}
