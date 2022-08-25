import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'

export function loader({ request }: LoaderArgs) {
  return json(
    {
      USD: '1.0',
      EUR: '1.1602',
      ZAR: '17.3792'
    },
    { status: 200 }
  )
}