import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface AppointmentReminders {
  id: string;
  appointment_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
  reminder_type: string;
  reminder_sent_at: Timestamp | null;
  sms_message_log_id: string | null;
  sms_to_number: string | null;
  escalation_status: string | null;
}

export interface Appointments {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
  acuity_id: string;
  elation_id: string;
  acuity_timestamp: Timestamp;
  elation_timestamp: Timestamp;
  spanish_tx_id: string | null;
  spanish_tx_timestamp: Timestamp | null;
  elation_patient_id: Generated<string>;
}

export interface SmsMessageLog {
  id: string;
  message_timestamp: Generated<Timestamp>;
  from_number: string;
  to_number: string;
  message: string;
  is_outgoing: boolean;
  sms_message_id: string | null;
  sms_status: string | null;
  sms_type: string;
  sms_response_type: string | null;
  sms_language: string;
  provider: string;
  providerMessage: string | null;
}

export interface Database {
  appointment_reminders: AppointmentReminders;
  appointments: Appointments;
  sms_message_log: SmsMessageLog;
}
