import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import { AgentInstruction } from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

export class InstructionQueueManager extends EventEmitter {
  constructor(private db: EngineDatabase) {
    super();
  }

  enqueue(sessionId: string, prompt: string, attachments: string[] = []): AgentInstruction {
    const instruction: AgentInstruction = {
      id: nanoid(),
      sessionId,
      prompt,
      attachments,
      queuedAt: Date.now(),
      status: 'queued'
    };

    const currentQueue = this.db.getQueue(sessionId);
    this.db.saveInstruction(instruction, currentQueue.length);
    const updated = this.db.getQueue(sessionId);
    this.emit('queue_updated', { sessionId, queue: updated });
    return instruction;
  }

  getQueue(sessionId: string): AgentInstruction[] {
    return this.db.getQueue(sessionId);
  }

  getNext(sessionId: string): AgentInstruction | null {
    const queue = this.db.getQueue(sessionId);
    return queue.length > 0 ? queue[0] : null;
  }

  markDelivered(instructionId: string, sessionId: string): void {
    this.db.updateInstructionStatus(instructionId, 'delivered');
    const updated = this.db.getQueue(sessionId);
    this.emit('queue_updated', { sessionId, queue: updated });
  }

  cancel(instructionId: string, sessionId: string): boolean {
    const success = this.db.deleteInstruction(instructionId);
    if (success) {
      const updated = this.db.getQueue(sessionId);
      this.emit('queue_updated', { sessionId, queue: updated });
    }
    return success;
  }

  cancelById(instructionId: string): boolean {
    const instruction = this.db.getInstructionById(instructionId);
    if (!instruction || instruction.status !== 'queued') return false;
    return this.cancel(instructionId, instruction.sessionId);
  }

  edit(instructionId: string, newPrompt: string): AgentInstruction | null {
    const instruction = this.db.getInstructionById(instructionId);
    if (!instruction || instruction.status !== 'queued') return null;

    const trimmed = newPrompt.trim();
    if (!trimmed) return null;

    const success = this.db.updateInstructionPrompt(instructionId, trimmed);
    if (!success) return null;

    const updated = this.db.getInstructionById(instructionId);
    if (!updated) return null;

    const queue = this.db.getQueue(instruction.sessionId);
    this.emit('queue_updated', { sessionId: instruction.sessionId, queue });
    return updated;
  }
}
