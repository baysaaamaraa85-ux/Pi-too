export interface DomainErrorParams {
  /** kebab-case код, RFC 9457 "type" URL-ийн сүүл хэсэг болно, жишээ нь "class-full" */
  code: string;
  status: number;
  title: string;
  detail: string;
  extra?: Record<string, unknown>;
}

// Service давхарга бизнесийн дүрмийн зөрчилд энэ алдааг шиднэ (CLAUDE.md 6.6, design 8.4).
export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly extra?: Record<string, unknown>;

  constructor(params: DomainErrorParams) {
    super(params.detail);
    this.name = "DomainError";
    this.code = params.code;
    this.status = params.status;
    this.title = params.title;
    this.detail = params.detail;
    this.extra = params.extra;
  }
}
