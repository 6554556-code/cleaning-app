export function generateSlots(executor, existingOrders, date) {
    const slots = []
    
    // Рабочее время исполнителя
    const [startHour, startMin] = (executor.work_start || '09:00').split(':').map(Number)
const [endHour, endMin] = (executor.work_end || '21:00').split(':').map(Number)
    
    // Создаём слоты каждые 30 минут
    const current = new Date(date)
    current.setHours(startHour, startMin, 0, 0)
    
    const end = new Date(date)
    end.setHours(endHour, endMin, 0, 0)
    
    while (current < end) {
      const slotStart = new Date(current)
      const slotEnd = new Date(current)
      slotEnd.setMinutes(slotEnd.getMinutes() + 30)
      
      // Проверяем занят ли слот
      const isBlocked = existingOrders.some(order => {
        const orderStart = new Date(order.scheduled_at)
        const orderEnd = new Date(orderStart)
        
        // Длительность заказа
        orderEnd.setMinutes(orderEnd.getMinutes() + (order.total_duration || 60))
        
        // Добавляем время на дорогу и буфер для выезда
        if (executor.outcall && order.location_type !== 'incall') {
          orderEnd.setMinutes(orderEnd.getMinutes() + (executor.travel_time || 0))
          orderEnd.setMinutes(orderEnd.getMinutes() + (executor.buffer_time || 0))
          
          // Блокируем время до заказа (дорога К клиенту)
          const travelBefore = new Date(orderStart)
          travelBefore.setMinutes(travelBefore.getMinutes() - (executor.travel_time || 0))
          
          if (slotStart >= travelBefore && slotStart < orderEnd) return true
        } else {
          // Для инколл только буфер
          orderEnd.setMinutes(orderEnd.getMinutes() + (executor.buffer_time || 0))
          if (slotStart >= orderStart && slotStart < orderEnd) return true
        }
        
        return false
      })
      
      if (!isBlocked) {
        slots.push({
          start: new Date(slotStart),
          end: new Date(slotEnd),
          label: slotStart.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        })
      }
      
      current.setMinutes(current.getMinutes() + 30)
    }
    
    return slots
  }