// Jest setup file
import { jest } from '@jest/globals';

// Make jest available globally
globalThis.jest = jest;

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      getBytesInUse: jest.fn()
    }
  },
  tabs: {
    executeScript: jest.fn(),
    sendMessage: jest.fn(),
    query: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn(),
    lastError: null,
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Mock DOM APIs
global.document = {
  createElement: jest.fn(),
  createDocumentFragment: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn()
};

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 15000000,
    jsHeapSizeLimit: 100000000
  }
};