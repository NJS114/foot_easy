export type TwilioTestRecord = {
  id: string;
  sid: string;
  to: string;
  status: string;
  errorCode: number | null;
  detail: string;
  createdAt: string;
  updatedAt: string;
};
export type TwilioTestConfig = {
  local: boolean;
  enabled: boolean;
  ready: boolean;
  missing: string[];
  sender: string;
  to: string;
  authMode: string;
  lastTest: TwilioTestRecord | null;
};
