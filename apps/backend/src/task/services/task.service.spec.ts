import { describe, expect, it } from 'bun:test';
import { TaskService } from './task.service';

describe('TaskService.myTasks', () => {
  const service = new TaskService();
  const organizationUnitId = 'org-unit-stub-1';

  it('returns tasks', () => {
    const tasks = service.myTasks('user-ignored', organizationUnitId);

    expect(tasks).toBeDefined();
  });
});
