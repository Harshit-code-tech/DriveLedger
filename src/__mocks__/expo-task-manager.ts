/**
 * Mock for expo-task-manager in Jest unit tests
 */

const definedTasks = new Map<string, (body: any) => Promise<void> | void>();

export const defineTask = jest.fn((taskName: string, executor: (body: any) => Promise<void> | void) => {
  definedTasks.set(taskName, executor);
});

export const isTaskDefined = jest.fn((taskName: string) => {
  return definedTasks.has(taskName);
});

export const isTaskRegisteredAsync = jest.fn(async (taskName: string) => {
  return definedTasks.has(taskName);
});

export const unregisterTaskAsync = jest.fn(async (taskName: string) => {
  definedTasks.delete(taskName);
});

export const unregisterAllTasksAsync = jest.fn(async () => {
  definedTasks.clear();
});

export const getRegisteredTasksAsync = jest.fn(async () => {
  return Array.from(definedTasks.keys()).map((name) => ({ taskName: name }));
});

export const _getDefinedTask = (taskName: string) => {
  return definedTasks.get(taskName);
};

export const _executeTaskForTesting = async (taskName: string, body: any) => {
  const executor = definedTasks.get(taskName);
  if (executor) {
    await executor(body);
  }
};

export const _clearDefinedTasksForTesting = () => {
  definedTasks.clear();
};
