import { fetchApi } from '@/api/fetchApi'

export interface InviteByEmailParams {
  roomId: string
  emails: string[]
  message?: string
}

export interface InviteByEmailResult {
  sent: number
  failed: number
}

export const inviteByEmail = async ({ roomId, emails, message }: InviteByEmailParams) => {
  return fetchApi<InviteByEmailResult>(`/rooms/${roomId}/invite/`, {
    method: 'POST',
    body: JSON.stringify({ emails, message }),
  })
}
