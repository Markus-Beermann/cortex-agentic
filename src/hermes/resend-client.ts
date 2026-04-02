export interface ResendSendEmailInput {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface ResendSendEmailResult {
  id: string;
}

export interface ResendClientOptions {
  apiKey: string;
  fetcher?: typeof fetch;
}

export class ResendClient {
  private readonly fetcher: typeof fetch;

  public constructor(private readonly options: ResendClientOptions) {
    if (options.apiKey.length === 0) {
      throw new Error("RESEND_API_KEY is required for Hermes nightly mail.");
    }
    this.fetcher = options.fetcher ?? fetch;
  }

  public async sendEmail(input: ResendSendEmailInput): Promise<ResendSendEmailResult> {
    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text
      }),
      signal: AbortSignal.timeout(30_000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend request failed with ${response.status}: ${errorText}`);
    }

    return (await response.json()) as ResendSendEmailResult;
  }
}
