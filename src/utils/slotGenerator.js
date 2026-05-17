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

    // Заказ должен целиком влезать в рабочий день
    const fitsInWorkday = newBusyEnd <= end

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

  return slots
}