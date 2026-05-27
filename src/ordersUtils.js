import { supabase } from './supabase'

/**
 * Загружает счётчики выполненных заказов для списка исполнителей.
 * Возвращает объект вида { [executor_id]: { fromApp: N, total: M } }
 * fromApp — done + source='booking' (показываем на главной, защищено от накрутки)
 * total — все done (показываем в кабинете исполнителя)
 */
export async function loadOrdersCountByExecutors(executorIds) {
  if (!executorIds || executorIds.length === 0) return {}

  const { data, error } = await supabase
    .from('orders')
    .select('executor_id, source')
    .in('executor_id', executorIds)
    .eq('status', 'done')
    .or('is_deleted.is.null,is_deleted.eq.false')

  if (error) {
    console.error('Ошибка загрузки счётчиков заказов:', error)
    return {}
  }

  const result = {}
  executorIds.forEach(id => {
    result[id] = { fromApp: 0, total: 0 }
  })

  data.forEach(o => {
    if (!result[o.executor_id]) return
    result[o.executor_id].total += 1
    if (o.source === 'booking') {
      result[o.executor_id].fromApp += 1
    }
  })

  return result
}