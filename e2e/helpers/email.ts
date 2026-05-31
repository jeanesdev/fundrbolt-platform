export type MailpitMessage = {
  ID: string
  Subject: string
  To?: Array<{ Address: string; Name?: string }>
  Text?: string
  HTML?: string
}

type MailpitListResponse = {
  total: number
  messages: MailpitMessage[]
}

export class MailpitClient {
  constructor(private readonly baseUrl: string) {}

  async listMessages(): Promise<MailpitMessage[]> {
    const response = await fetch(`${this.baseUrl}/api/v2/messages`)
    if (!response.ok) {
      throw new Error(`Mailpit list failed: ${response.status} ${await response.text()}`)
    }
    const body = (await response.json()) as MailpitListResponse
    return body.messages ?? []
  }

  async waitForMessage(opts: { to: string; subjectContains: string; timeout?: number }): Promise<MailpitMessage> {
    const timeout = opts.timeout ?? 10_000
    const started = Date.now()
    while (Date.now() - started < timeout) {
      const messages = await this.listMessages()
      const match = messages.find((message) => {
        const recipients = message.To?.map((recipient) => recipient.Address.toLowerCase()) ?? []
        return recipients.includes(opts.to.toLowerCase()) && message.Subject.includes(opts.subjectContains)
      })
      if (match) {
        return match
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Timed out waiting for email to ${opts.to} containing ${opts.subjectContains}`)
  }

  extractLink(message: MailpitMessage, pattern: RegExp): string {
    const haystack = [message.HTML ?? '', message.Text ?? ''].join('\n')
    const match = haystack.match(pattern)
    if (!match?.[0]) {
      throw new Error(`No link matching ${pattern} found in mailpit message ${message.ID}`)
    }
    return match[0]
  }

  async deleteAll(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/messages`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(`Mailpit delete failed: ${response.status} ${await response.text()}`)
    }
  }
}
