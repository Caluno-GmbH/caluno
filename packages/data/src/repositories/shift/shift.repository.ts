import {
  parseRruleDays,
  parseRruleEndDate,
  type RecurrenceDayValue,
} from '../../constants';
import {
  type CreateShiftInput,
  type DuplicateShiftInput,
  type ShiftFillFilter,
  type ShiftInviteStatus,
  type ShiftSortField,
  type ShiftVisibility,
  SortOrder,
  type UpdateShiftInput,
  type UpdateShiftInstanceInput,
} from '../../generated/base-types';
import type {
  GetActiveShiftInstancesQuery,
  GetAvailableShiftInstanceDayCountsQuery,
  GetAvailableShiftInstancesQuery,
  GetCheckInShiftInstancesQuery,
  GetCheckInShiftsQuery,
  GetMyShiftInstancesQuery,
  GetPublicShiftInstancesQuery,
  GetShiftInstanceCallOutHistoryQuery,
  GetShiftInstanceCallOutSummaryQuery,
  GetShiftInstanceQuery,
  GetShiftInstancesQuery,
  GetShiftLocationsQuery,
  GetShiftQuery,
  GetWeeklyShiftsQuery,
  JoinShiftInstanceMutation,
  RemindShiftInstanceInviteMutation,
  SendShiftInstanceCallOutMutation,
  SetShiftInstanceRequiredFormsMutation,
  SetShiftRequiredFormsMutation,
} from '../../generated/graphql';
import {
  BaseRepository,
  type PaginationOptions,
} from '../base/base.repository';

export interface ShiftListOptions extends PaginationOptions {
  sort?: ShiftSortField;
  order?: SortOrder;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  location?: string | null;
  visibility?: ShiftVisibility | null;
  fill?: ShiftFillFilter | null;
}

export type ActiveShiftInstance =
  GetActiveShiftInstancesQuery['activeShiftInstances'][number];
export type ShiftInstanceItem =
  GetShiftInstancesQuery['shiftInstances'][number];
export type RawShift = GetShiftQuery['shift'];
export type WeeklyShiftInstance = GetWeeklyShiftsQuery['weeklyShifts'][number];
export type MyShiftInstance =
  GetMyShiftInstancesQuery['myShiftInstances']['items'][number];
export type AvailableShiftInstance =
  GetAvailableShiftInstancesQuery['availableShiftInstances']['items'][number];
export type AvailableShiftInstanceDayCount =
  GetAvailableShiftInstanceDayCountsQuery['availableShiftInstanceDayCounts'][number];
export type PublicShiftInstance =
  GetPublicShiftInstancesQuery['publicShiftInstances'][number];
export type RawPublicShiftInstance =
  GetPublicShiftInstancesQuery['publicShiftInstances'];
export type CheckInShiftInstance =
  GetCheckInShiftInstancesQuery['checkInShiftInstances'][number];
export type CheckInShift = GetCheckInShiftsQuery['checkInShifts'][number];
export type ShiftLocations = GetShiftLocationsQuery['shiftLocations'];
export interface ShiftDetail extends RawShift {
  startDate: Date;
  endDate: Date;
  recurrenceDays: RecurrenceDayValue[];
  recurrenceEndsAt: Date | undefined;
}

export type ShiftInstanceDetail = GetShiftInstanceQuery['shiftInstance'];

function enrichShift(shift: RawShift): ShiftDetail {
  const startDate = new Date(shift.originalStartsAt);
  const endDate = new Date(startDate.getTime() + shift.durationMinutes * 60000);

  return {
    ...shift,
    startDate,
    endDate,
    recurrenceDays: parseRruleDays(shift.rrule),
    recurrenceEndsAt: parseRruleEndDate(shift.rrule),
  };
}

export class ShiftRepository extends BaseRepository {
  async findById(id: string): Promise<RawShift> {
    const data = await this.sdk.GetShift({ id });
    return data.shift;
  }

  async findPublicInstancesByShiftId(
    shiftId: string,
  ): Promise<PublicShiftInstance[]> {
    const data = await this.sdk.GetPublicShiftInstances({ shiftId });
    return data.publicShiftInstances;
  }

  async findPublicInstance(id: string): Promise<PublicShiftInstance> {
    const data = await this.sdk.GetPublicShiftInstance({ id });
    return data.publicShiftInstance;
  }

  async findByIdDetailed(id: string): Promise<ShiftDetail> {
    const shift = await this.findById(id);
    return enrichShift(shift);
  }

  async findAll(options: ShiftListOptions = {}) {
    const data = await this.sdk.GetShifts({
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
      sort: options.sort,
      order: options.order,
      search: options.search ?? null,
      dateFrom: options.dateFrom ?? null,
      dateTo: options.dateTo ?? null,
      location: options.location ?? null,
      visibility: options.visibility ?? null,
      fill: options.fill ?? null,
    });
    return data.shifts;
  }

  async findAllForOrgUnit(organizationUnitId: string, options: ShiftListOptions = {}) {
    const data = await this.sdk.GetShifts(
      {
        limit: options.limit ?? 500,
        offset: 0,
        sort: options.sort,
        order: options.order,
        search: options.search ?? null,
        dateFrom: options.dateFrom ?? null,
        dateTo: options.dateTo ?? null,
        location: options.location ?? null,
        visibility: options.visibility ?? null,
        fill: options.fill ?? null,
      },
      { 'x-organization-unit-id': organizationUnitId },
    );
    return data.shifts;
  }

  async findLocations(): Promise<ShiftLocations> {
    const data = await this.sdk.GetShiftLocations();
    return data.shiftLocations;
  }

  async count(): Promise<number> {
    const data = await this.sdk.GetShiftCount();
    return data.shiftCount;
  }

  async findAllForEvent(eventId: string, options: PaginationOptions = {}) {
    const data = await this.sdk.GetEventShifts({
      eventId,
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
    });
    return data.eventShifts;
  }

  async findInstancesByMasterIds(masterIds: string[]) {
    const data = await this.sdk.GetShiftInstancesByMasterIds({ masterIds });
    return data.shiftInstancesByMasterIds;
  }

  async activeShiftInstances(userId: string) {
    const data = await this.sdk.GetActiveShiftInstances({ userId });
    return data.activeShiftInstances;
  }

  async create(input: CreateShiftInput) {
    const data = await this.sdk.CreateShift({ input });
    return data.createShift;
  }

  async update(id: string, input: UpdateShiftInput) {
    const data = await this.sdk.UpdateShift({ id, input });
    return data.updateShift;
  }

  async duplicate(id: string, input: DuplicateShiftInput) {
    const data = await this.sdk.DuplicateShift({ id, input });
    return data.duplicateShift;
  }

  async delete(id: string): Promise<{ id: string }> {
    const data = await this.sdk.DeleteShift({ id });
    return { id: data.deleteShift.id };
  }

  async setRequiredForms(
    shiftId: string,
    formIds: string[],
  ): Promise<SetShiftRequiredFormsMutation['setShiftRequiredForms']> {
    const data = await this.sdk.SetShiftRequiredForms({ shiftId, formIds });
    return data.setShiftRequiredForms;
  }

  async setInstanceRequiredForms(
    instanceId: string,
    formIds: string[],
  ): Promise<
    SetShiftInstanceRequiredFormsMutation['setShiftInstanceRequiredForms']
  > {
    const data = await this.sdk.SetShiftInstanceRequiredForms({
      instanceId,
      formIds,
    });
    return data.setShiftInstanceRequiredForms;
  }

  async updateMembers(
    instanceId: string,
    memberIds: string[],
    options?: { inviteToAllInstances?: boolean },
  ): Promise<{ id: string }> {
    const data = await this.sdk.UpdateMembersForShiftInstance({
      instanceId,
      memberIds,
      inviteToAllInstances: options?.inviteToAllInstances,
    });
    return { id: data.updateMembersForShiftInstance.id };
  }

  async updateInstance(
    instanceId: string,
    input: UpdateShiftInstanceInput,
    applyToAllFuture?: boolean,
  ): Promise<{ id: string }> {
    const data = await this.sdk.UpdateShiftInstance({
      instanceId,
      input,
      applyToAllFuture,
    });
    return { id: data.updateShiftInstance.id };
  }

  async deleteInstance(
    instanceId: string,
    applyToAllFuture?: boolean,
  ): Promise<{ id: string }> {
    const data = await this.sdk.DeleteShiftInstance({
      id: instanceId,
      applyToAllFuture,
    });
    return { id: data.deleteShiftInstance.id };
  }

  async updateInstanceApproval(
    instanceId: string,
    joinRequiresApproval: boolean,
    applyToAllFuture?: boolean,
  ): Promise<{ id: string }> {
    const data = await this.sdk.UpdateShiftInstanceApproval({
      id: instanceId,
      joinRequiresApproval,
      applyToAllFuture,
    });
    return { id: data.updateShiftInstanceApproval.id };
  }

  async joinInstance(
    instanceId: string,
  ): Promise<JoinShiftInstanceMutation['joinShiftInstance']> {
    const data = await this.sdk.JoinShiftInstance({ instanceId });
    return data.joinShiftInstance;
  }

  async findVolunteersByInstanceId(
    instanceId: string,
    statuses?: ShiftInviteStatus[],
  ) {
    const data = await this.sdk.GetShiftVolunteers({ instanceId, statuses });
    return data.shiftVolunteers;
  }

  async findInstance(id: string) {
    const data = await this.sdk.GetShiftInstance({ id });
    return data.shiftInstance;
  }

  async findLastCallOutSummary(
    id: string,
  ): Promise<
    NonNullable<
      GetShiftInstanceCallOutSummaryQuery['shiftInstance']
    >['lastCallOut']
  > {
    const data = await this.sdk.GetShiftInstanceCallOutSummary({ id });
    return data.shiftInstance.lastCallOut ?? null;
  }

  async findCallOutHistory(
    id: string,
  ): Promise<
    NonNullable<
      GetShiftInstanceCallOutHistoryQuery['shiftInstance']
    >['callOuts']
  > {
    const data = await this.sdk.GetShiftInstanceCallOutHistory({ id });
    return data.shiftInstance.callOuts ?? [];
  }

  async sendCallOut(
    instanceId: string,
  ): Promise<SendShiftInstanceCallOutMutation['sendShiftInstanceCallOut']> {
    const data = await this.sdk.SendShiftInstanceCallOut({ instanceId });
    return data.sendShiftInstanceCallOut;
  }

  async remindVolunteerAboutInvite(
    instanceId: string,
    userId: string,
  ): Promise<RemindShiftInstanceInviteMutation['remindShiftInstanceInvite']> {
    const data = await this.sdk.RemindShiftInstanceInvite({
      instanceId,
      userId,
    });
    return data.remindShiftInstanceInvite;
  }

  async updateShiftInstanceInviteStatus(
    instanceId: string,
    status: ShiftInviteStatus,
    userId?: string,
  ) {
    const data = await this.sdk.UpdateShiftInstanceInviteStatus({
      instanceId,
      status,
      userId,
    });
    return data.updateShiftInstanceInviteStatus;
  }

  async findInstances(shiftId: string) {
    const data = await this.sdk.GetShiftInstances({ shiftId });
    return data.shiftInstances;
  }

  async findForWeek(
    startsAfter: Date,
    endsBefore: Date,
    eventId?: string | null,
  ): Promise<WeeklyShiftInstance[]> {
    const data = await this.sdk.GetWeeklyShifts({
      startsAfter: startsAfter.toISOString(),
      endsBefore: endsBefore.toISOString(),
      eventId: eventId ?? undefined,
    });
    return data.weeklyShifts;
  }

  async findInstanceStartsForEvent(eventId: string): Promise<string[]> {
    const data = await this.sdk.GetEventShiftInstanceStarts({ eventId });
    return data.eventShiftInstanceStarts;
  }

  /**
   * Check-in shift picker. The org unit travels as a per-request header
   * because the backend derives permissions from it — never from an argument.
   */
  async findCheckInInstances(
    organizationUnitId: string,
    startsAfter: Date,
    endsBefore: Date,
  ): Promise<CheckInShiftInstance[]> {
    const data = await this.sdk.GetCheckInShiftInstances(
      {
        startsAfter: startsAfter.toISOString(),
        endsBefore: endsBefore.toISOString(),
      },
      { 'x-organization-unit-id': organizationUnitId },
    );
    return data.checkInShiftInstances;
  }

  async findCheckInShifts(
    organizationUnitId: string,
    search?: string,
  ): Promise<CheckInShift[]> {
    const data = await this.sdk.GetCheckInShifts(
      { search: search ?? null },
      { 'x-organization-unit-id': organizationUnitId },
    );
    return data.checkInShifts;
  }

  async checkInInviteToShiftInstance(
    organizationUnitId: string,
    shiftInstanceId: string,
    volunteerId: string,
  ): Promise<{ id: string }> {
    const data = await this.sdk.CheckInInviteToShiftInstance(
      { shiftInstanceId, volunteerId },
      { 'x-organization-unit-id': organizationUnitId },
    );
    return { id: data.checkInInviteToShiftInstance.id };
  }

  async findMyShiftInstances(
    options: {
      includePast?: boolean;
      startsAfter?: Date;
      endsBefore?: Date;
      limit?: number;
      offset?: number;
      order?: SortOrder;
      statuses?: ShiftInviteStatus[];
      includeIntended?: boolean;
    } = {},
  ): Promise<{
    items: MyShiftInstance[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const data = await this.sdk.GetMyShiftInstances({
      includePast: options.includePast ?? false,
      startsAfter: options.startsAfter?.toISOString(),
      endsBefore: options.endsBefore?.toISOString(),
      limit: options.limit ?? 15,
      offset: options.offset ?? 0,
      order: options.order ?? SortOrder.Asc,
      statuses: options.statuses,
      includeIntended: options.includeIntended,
    });
    return data.myShiftInstances;
  }

  async findAvailableShiftInstances(
    options: {
      startsAfter?: Date;
      endsBefore?: Date;
      organizationUnitIds?: string[];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    items: AvailableShiftInstance[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const data = await this.sdk.GetAvailableShiftInstances({
      startsAfter: options.startsAfter?.toISOString(),
      endsBefore: options.endsBefore?.toISOString(),
      organizationUnitIds: options.organizationUnitIds,
      limit: options.limit ?? 15,
      offset: options.offset ?? 0,
    });
    return data.availableShiftInstances;
  }

  async findAvailableShiftInstanceDayCounts(
    options: {
      startsAfter?: Date;
      endsBefore?: Date;
      organizationUnitIds?: string[];
      excludeIntended?: boolean;
    } = {},
  ): Promise<AvailableShiftInstanceDayCount[]> {
    const data = await this.sdk.GetAvailableShiftInstanceDayCounts({
      startsAfter: options.startsAfter?.toISOString(),
      endsBefore: options.endsBefore?.toISOString(),
      organizationUnitIds: options.organizationUnitIds,
      excludeIntended: options.excludeIntended ?? false,
    });
    return data.availableShiftInstanceDayCounts;
  }

  async checkIn(shiftInstanceId: string): Promise<string> {
    const data = await this.sdk.CheckIn({ shiftInstanceId });
    return data.checkIn.id;
  }

  async checkOut(shiftInstanceId: string): Promise<string> {
    const data = await this.sdk.CheckOut({ shiftInstanceId });
    return data.checkOut.id;
  }
}
