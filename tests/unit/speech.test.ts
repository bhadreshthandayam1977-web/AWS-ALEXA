import { describe, it, expect } from 'vitest';
import {
  cleanSpokenText,
  limitLength,
  speakable,
  formatTaskListSpeech,
} from '../../src/services/speech.js';

describe('speech service helpers', () => {
  it('strips markdown syntax and emojis', () => {
    const raw =
      '🚀 **Important**: Please review [PR #42](https://github.com/foo/bar) and `fix` the bug! 🎉';
    const cleaned = cleanSpokenText(raw);
    expect(cleaned).not.toContain('🚀');
    expect(cleaned).not.toContain('🎉');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('`');
    expect(cleaned).not.toContain('https://github.com/foo/bar');
    expect(cleaned).toContain('PR #42');
    expect(cleaned).toContain('fix the bug');
  });

  it('limits text to under 300 characters cleanly with ellipsis', () => {
    const longText = 'Word '.repeat(100);
    const limited = limitLength(longText, 300);
    expect(limited.length).toBeLessThanOrEqual(300);
    expect(limited.endsWith('...')).toBe(true);
  });

  it('speakable cleans and bounds text', () => {
    const raw = '🔥 Check out #1 priority: `runWorkflow` *now*! '.repeat(20);
    const spoken = speakable(raw, 250);
    expect(spoken.length).toBeLessThanOrEqual(250);
    expect(spoken).not.toContain('🔥');
    expect(spoken).not.toContain('`');
  });

  it('formats empty task list speakably', () => {
    expect(formatTaskListSpeech([], 'open')).toBe('You have no open tasks.');
    expect(formatTaskListSpeech([], 'all')).toBe('You have no tasks.');
  });

  it('formats task list with 1-5 items speakably', () => {
    const tasks = [
      { id: 1, title: 'Review PR 101' },
      { id: 2, title: 'Write tests' },
    ];
    const speech = formatTaskListSpeech(tasks, 'open');
    expect(speech).toBe('You have 2 open tasks: 1, Review PR 101; 2, Write tests.');
    expect(speech.length).toBeLessThan(300);
  });

  it('formats task list with more than 5 items showing 5 and remaining count', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      title: `Task item number ${i + 1}`,
    }));
    const speech = formatTaskListSpeech(tasks, 'open');
    expect(speech).toContain('You have 8 open tasks:');
    expect(speech).toContain('1, Task item number 1');
    expect(speech).toContain('5, Task item number 5');
    expect(speech).toContain(', and 3 more.');
    expect(speech.length).toBeLessThanOrEqual(300);
  });
});
