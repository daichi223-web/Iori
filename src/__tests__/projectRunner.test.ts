/**
 * Project Runner Tests
 * @qa TDD for autonomous task execution system
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs/promises";
import {
  addTask,
  cancelTask,
  getNextPendingTask,
  getTaskStatus,
  clearCompletedTasks
} from "../core/projectRunner.js";

const TEST_ROOT = path.join(process.cwd(), ".test-runner");

describe("ProjectRunner", () => {
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(path.join(TEST_ROOT, ".iori"), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_ROOT, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("addTask", () => {
    it("should create a new task with default AI", async () => {
      const task = await addTask(TEST_ROOT, "Test prompt");

      expect(task.id).toMatch(/^task-\d+-\w+$/);
      expect(task.prompt).toBe("Test prompt");
      expect(task.ai).toBe("claude");
      expect(task.status).toBe("pending");
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(2);
    });

    it("should create a task with specified AI provider", async () => {
      const task = await addTask(TEST_ROOT, "Gemini task", "gemini");

      expect(task.ai).toBe("gemini");
    });

    it("should persist tasks to queue file", async () => {
      await addTask(TEST_ROOT, "Task 1");
      await addTask(TEST_ROOT, "Task 2");

      const queuePath = path.join(TEST_ROOT, ".iori", "tasks.json");
      const content = await fs.readFile(queuePath, "utf-8");
      const queue = JSON.parse(content);

      expect(queue.tasks).toHaveLength(2);
      expect(queue.tasks[0].prompt).toBe("Task 1");
      expect(queue.tasks[1].prompt).toBe("Task 2");
    });
  });

  describe("getNextPendingTask", () => {
    it("should return null when queue is empty", async () => {
      const task = await getNextPendingTask(TEST_ROOT);
      expect(task).toBeNull();
    });

    it("should return the first pending task", async () => {
      await addTask(TEST_ROOT, "First task");
      await addTask(TEST_ROOT, "Second task");

      const task = await getNextPendingTask(TEST_ROOT);

      expect(task).not.toBeNull();
      expect(task?.prompt).toBe("First task");
    });
  });

  describe("cancelTask", () => {
    it("should cancel a pending task", async () => {
      const task = await addTask(TEST_ROOT, "Task to cancel");
      const cancelled = await cancelTask(TEST_ROOT, task.id);

      expect(cancelled).toBe(true);

      const status = await getTaskStatus(TEST_ROOT);
      const cancelledTask = status.tasks.find(t => t.id === task.id);

      expect(cancelledTask?.status).toBe("cancelled");
    });

    it("should return false for non-existent task", async () => {
      const cancelled = await cancelTask(TEST_ROOT, "non-existent-id");
      expect(cancelled).toBe(false);
    });
  });

  describe("getTaskStatus", () => {
    it("should return correct counts", async () => {
      await addTask(TEST_ROOT, "Task 1");
      await addTask(TEST_ROOT, "Task 2");
      const task3 = await addTask(TEST_ROOT, "Task 3");
      await cancelTask(TEST_ROOT, task3.id);

      const status = await getTaskStatus(TEST_ROOT);

      expect(status.pending).toBe(2);
      expect(status.cancelled).toBe(1);
      expect(status.total).toBe(3);
    });
  });

  describe("clearCompletedTasks", () => {
    it("should remove cancelled tasks", async () => {
      await addTask(TEST_ROOT, "Task 1");
      const task2 = await addTask(TEST_ROOT, "Task 2");
      await cancelTask(TEST_ROOT, task2.id);

      const clearedCount = await clearCompletedTasks(TEST_ROOT);

      expect(clearedCount).toBe(1);

      const status = await getTaskStatus(TEST_ROOT);
      expect(status.total).toBe(1);
      expect(status.tasks[0].prompt).toBe("Task 1");
    });
  });
});
