/**
 * Utility functions for link management.
 */

export interface LinkTitle {
  title: string
}

/**
 * Calculates the maximum numeric ID from a list of link titles.
 * A title is considered a numeric ID if it consists only of digits.
 * Returns 0 if no numeric IDs are found or if the input is null/empty.
 */
export function calculateMaxId(data: LinkTitle[] | null): number {
  let maxId = 0
  if (data && data.length > 0) {
    for (const link of data) {
      // Check if title is a pure number (no decimals, no spaces)
      if (/^\d+$/.test(link.title)) {
        const num = parseInt(link.title, 10)
        if (!isNaN(num) && num > maxId) {
          maxId = num
        }
      }
    }
  }
  return maxId
}
