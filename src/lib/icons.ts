/** Spaces and items both carry an icon: an emoji, or a small uploaded image. */

export const DEFAULT_SPACE_ICON = '📁'
export const DEFAULT_ITEM_ICON = '📄'

/** An uploaded icon is stored inline as a small data URL; anything else is an emoji. */
export const isImageIcon = (icon: string) => icon.startsWith('data:image/')

export const ICON_EMOJI = [
  '📁', '📄', '🎉', '💼', '✈️', '🎓', '🏠', '💰', '❤️', '📚', '🎯', '🏋️',
  '🍳', '🎨', '🎵', '🌱', '🚗', '🐶', '👶', '🛠️', '💡', '🧭', '🏖️', '⭐',
]
