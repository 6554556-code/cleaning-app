export function getLocationIcon(locationType) {
    if (locationType === 'outcall') return '🚗'
    if (locationType === 'incall') return '🏠'
    if (locationType === 'both') return '🚗🏠'
    return ''
  }