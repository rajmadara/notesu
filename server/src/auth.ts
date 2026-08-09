import type { NextFunction, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

export function createAuthMiddleware() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_ANON_KEY are not set. Add them to server/.env (see server/.env.example).',
    )
  }
  const supabase = createClient(url, key)

  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization header' })
      return
    }
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired session' })
      return
    }
    req.userId = data.user.id
    next()
  }
}
