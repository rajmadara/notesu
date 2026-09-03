/**
 * An error the routes layer can turn straight into an HTTP status. Thrown by
 * the store when a request is well-formed but the caller isn't allowed to do
 * it (403) or the row doesn't exist for them (404).
 */
export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'StoreError'
  }
}

export const notFound = (what: string) => new StoreError(404, `${what} not found`)
export const forbidden = (what = 'You can only view this') => new StoreError(403, what)
