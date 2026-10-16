import { registerEnumType } from '@nestjs/graphql';
import { VolunteerAllowanceState } from '../services/volunteer-allowance';
import {
  ContractStatus,
  DocumentKind,
  DocumentStatusChange,
  InvoiceStatus,
  RateProvenanceKind,
  ReimbursementTypeKey,
  RenewalCadence,
  SigneeType,
} from './index';

registerEnumType(ReimbursementTypeKey, {
  name: 'ReimbursementTypeKey',
});

registerEnumType(DocumentKind, {
  name: 'DocumentKind',
});

registerEnumType(RenewalCadence, {
  name: 'RenewalCadence',
});

registerEnumType(SigneeType, {
  name: 'SigneeType',
});

registerEnumType(ContractStatus, {
  name: 'ContractStatus',
});

registerEnumType(InvoiceStatus, {
  name: 'InvoiceStatus',
});

registerEnumType(DocumentStatusChange, {
  name: 'DocumentStatusChange',
});

registerEnumType(RateProvenanceKind, {
  name: 'RateProvenanceKind',
});

registerEnumType(VolunteerAllowanceState, {
  name: 'VolunteerAllowanceState',
});
