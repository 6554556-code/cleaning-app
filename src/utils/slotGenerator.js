// Проверяет, пересекается ли новый заказ с существующими заказами и блоками.
// Возвращает true, если есть пересечение.
export function hasOverlap(executor, existingOrders, existingBlocks, newStart, newDurationTotal, newLocationType) {
  const travel = newLocationType === 'outcall' ? (executor.travel_time || 0) : 0
  const buffer = executor.buffer_time || 0

  // Занятый интервал нового заказа: дорога туда → услуга → буфер → дорога обратно
  const newBusyStart = new Date(newStart)
  newBusyStart.setMinutes(newBusyStart.getMinutes() - travel)
  const newBusyEnd = new Date(newStart)
  newBusyEnd.setMinutes(newBusyEnd.getMinutes() + newDurationTotal + buffer + travel)

  // Проверяем заказы
  for (const order of existingOrders) {
    const oStart = new Date(order.scheduled_at)
    const oEnd = new Date(oStart)
    oEnd.setMinutes(oEnd.getMinutes() + (order.total_duration || 60) + buffer)
    let busyStart = new Date(oStart)
    let busyEnd = new Date(oEnd)
    if (order.location_type === 'outcall') {
      busyStart.setMinutes(busyStart.getMinutes() - (executor.travel_time || 0))
      busyEnd.setMinutes(busyEnd.getMinutes() + (executor.travel_time || 0))
    }
    if (newBusyStart < busyEnd && busyStart < newBusyEnd) return true
  }

  // Проверяем блоки (перерывы, дорога)
  for (const block of existingBlocks) {
    const bStart = new Date(block.start_at)
    const bEnd = new Date(bStart)
    bEnd.setMinutes(bEnd.getMinutes() + (block.duration || 0))
    if (newBusyStart < bEnd && bStart < newBusyEnd) return true
  }

  return false
}
// Ищет ближайший свободный слот к желаемому времени (в любую сторону, но не в прошлом)
export function findNearestSlot(executor, existingOrders, existingBlocks, desiredStart, newDuration, newLocationType) {
  const day = new Date(desiredStart)
  const newOrder = { duration: newDuration, locationType: newLocationType }

  // Получаем все свободные слоты этого дня
  let slots = generateSlots(executor, existingOrders, day, newOrder, existingBlocks)

  // Убираем прошедшие
  const now = new Date()
  slots = slots.filter(s => new Date(s.start) > now)

  if (slots.length === 0) return null

  // Находим слот, ближайший по времени к желаемому
  const desiredMs = new Date(desiredStart).getTime()
  let nearest = slots[0]
  let minDiff = Math.abs(new Date(nearest.start).getTime() - desiredMs)

  for (const s of slots) {
    const diff = Math.abs(new Date(s.start).getTime() - desiredMs)
    if (diff < minDiff) {
      minDiff = diff
      nearest = s
    }
  }

  return nearest
}
// Считает занятый интервал одного существующего заказа: { busyStart, busyEnd }
function getOrderBusyRange(order, executor) {
  const orderStart = new Date(order.scheduled_at)
  const orderEnd = new Date(orderStart)
  orderEnd.setMinutes(orderEnd.getMinutes() + (order.total_duration || 60))

  let busyStart = new Date(orderStart)
  let busyEnd = new Date(orderEnd)

  // Буфер после любого заказа
  busyEnd.setMinutes(busyEnd.getMinutes() + (executor.buffer_time || 0))

  // Для выезда — дорога туда (до начала) и обратно (после буфера)
  if (order.location_type === 'outcall') {
    busyStart.setMinutes(busyStart.getMinutes() - (executor.travel_time || 0))
    busyEnd.setMinutes(busyEnd.getMinutes() + (executor.travel_time || 0))
  }

  return { busyStart, busyEnd }
}

// Считает занятый интервал одного блока (перерыв, дорога, буфер)
function getBlockBusyRange(block) {
  const busyStart = new Date(block.start_at)
  const busyEnd = new Date(busyStart)
  busyEnd.setMinutes(busyEnd.getMinutes() + (block.duration || 0))
  return { busyStart, busyEnd }
}

export function generateSlots(executor, existingOrders, date, newOrder = {}, existingBlocks = []) {
  const slots = []

  // Проверяем, рабочий ли это день недели
  if (executor.work_days) {
    // work_days хранит дни по-человечески: 1=Пн ... 7=Вс
    // JS getDay(): 0=Вс, 1=Пн ... 6=Сб — переводим воскресенье из 0 в 7
    const jsDay = new Date(date).getDay()
    const humanDay = jsDay === 0 ? 7 : jsDay
    const workDays = executor.work_days.split(',').map(d => Number(d.trim()))
    if (!workDays.includes(humanDay)) {
      return [] // выходной — слотов нет
    }
  }

  // Рабочее время исполнителя
  const [startHour, startMin] = (executor.work_start || '09:00').split(':').map(Number)
  const [endHour, endMin] = (executor.work_end || '21:00').split(':').map(Number)

  // Длительность нового заказа целиком (услуга + допы + буфер + дорога)
  const serviceDuration = newOrder.duration || 60
  const buffer = executor.buffer_time || 0
  const travel = newOrder.locationType === 'outcall' ? (executor.travel_time || 0) : 0
  // Сколько времени займёт новый заказ от приезда до полного освобождения
  const newTotalAfter = serviceDuration + buffer + travel
  // Сколько времени нужно ДО приезда (дорога туда)
  const newTravelBefore = travel

  const current = new Date(date)
  current.setHours(startHour, startMin, 0, 0)

  const end = new Date(date)
  end.setHours(endHour, endMin, 0, 0)

  // Фиксируем начало рабочего дня — current дальше мутирует в цикле
  const dayStart = new Date(current)

  // Заранее считаем занятые интервалы заказов и блоков
  const orderRanges = existingOrders.map(o => getOrderBusyRange(o, executor))
  const blockRanges = existingBlocks.map(b => getBlockBusyRange(b))
  const allBusyRanges = [...orderRanges, ...blockRanges]

  while (current < end) {
    const slotStart = new Date(current)

    // Интервал, который займёт новый заказ, если начать в этом слоте
    const newBusyStart = new Date(slotStart)
    newBusyStart.setMinutes(newBusyStart.getMinutes() - newTravelBefore)
    const newBusyEnd = new Date(slotStart)
    newBusyEnd.setMinutes(newBusyEnd.getMinutes() + newTotalAfter)

    // Заказ должен целиком влезать в рабочий день:
    // — newBusyEnd <= end: услуга + буфер + дорога обратно не вылезают за конец смены
    // — newBusyStart >= dayStart: для outcall дорога ТУДА не уходит за начало смены
    //   (для in-call travel=0, поэтому newBusyStart === slotStart, и условие выполняется автоматически)
    const fitsInWorkday = newBusyEnd <= end && newBusyStart >= dayStart
    

    // Проверяем пересечение с заказами И блоками
    const overlaps = allBusyRanges.some(({ busyStart, busyEnd }) => {
      // Два отрезка пересекаются, если начало одного раньше конца другого и наоборот
      return newBusyStart < busyEnd && busyStart < newBusyEnd
    })

    if (fitsInWorkday && !overlaps) {
      const slotEnd = new Date(slotStart)
      slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration)
      slots.push({
        start: new Date(slotStart),
        end: slotEnd,
        label: slotStart.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      })
    }

    current.setMinutes(current.getMinutes() + 30)
  }

  // === Доводчики краёв: старт точно после освободившегося отрезка ===
  // Берём точки освобождения: начало рабочего дня + конец каждой занятости.
  // Из каждой делаем кандидата на старт: freePoint + travel (дорога ТУДА).
  // Если такой старт ещё не в slots — проверяем стандартные условия и добавляем.
  const existingStartTimes = new Set(slots.map(s => s.start.getTime()))
  const freePoints = [dayStart, ...allBusyRanges.map(r => r.busyEnd)]

  for (const freePoint of freePoints) {
    const slotStart = new Date(freePoint)
    slotStart.setMinutes(slotStart.getMinutes() + newTravelBefore)

    if (existingStartTimes.has(slotStart.getTime())) continue

    const newBusyStart = new Date(slotStart)
    newBusyStart.setMinutes(newBusyStart.getMinutes() - newTravelBefore)
    const newBusyEnd = new Date(slotStart)
    newBusyEnd.setMinutes(newBusyEnd.getMinutes() + newTotalAfter)

    const fitsInWorkday = newBusyEnd <= end && newBusyStart >= dayStart
    if (!fitsInWorkday) continue

    const overlaps = allBusyRanges.some(({ busyStart, busyEnd }) => {
      return newBusyStart < busyEnd && busyStart < newBusyEnd
    })
    if (overlaps) continue

    const slotEnd = new Date(slotStart)
    slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration)
    slots.push({
      start: new Date(slotStart),
      end: slotEnd,
      label: slotStart.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    })
    existingStartTimes.add(slotStart.getTime())
  }

  // Сортируем — хвостовые слоты должны встать между круглыми
  slots.sort((a, b) => a.start.getTime() - b.start.getTime())

  return slots
}