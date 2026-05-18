export enum PartyType {
  Individual = 'individual',
  Organization = 'organization',
}

export enum PartySource {
  Manual = 'manual',
  WhatsApp = 'whatsapp',
  JustDial = 'justdial',
  Facebook = 'facebook',
  WebForm = 'web_form',
  Api = 'api',
}

export enum MergeStatus {
  Canonical = 'canonical',
  Merged = 'merged',
  PendingReview = 'pending_review',
}
