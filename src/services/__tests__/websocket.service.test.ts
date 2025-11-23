import { WebSocketManager } from '../websocket.service';
import { OrderStatus } from '../../types/order.types';
import { WebSocket } from 'ws';

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // OPEN
  sentMessages: string[] = [];
  eventHandlers: Map<string, Function> = new Map();

  send(data: string) {
    this.sentMessages.push(data);
  }

  on(event: string, handler: Function) {
    this.eventHandlers.set(event, handler);
  }

  close() {
    this.readyState = 3; // CLOSED
    const closeHandler = this.eventHandlers.get('close');
    if (closeHandler) closeHandler();
  }

  triggerError(error: Error) {
    const errorHandler = this.eventHandlers.get('error');
    if (errorHandler) errorHandler(error);
  }
}

describe('WebSocketManager', () => {
  let manager: WebSocketManager;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    manager = new WebSocketManager();
    mockWs = new MockWebSocket();
  });

  describe('register', () => {
    it('should register a WebSocket connection', () => {
      manager.register('order-123', mockWs as any);
      expect(manager.getConnectionCount()).toBe(1);
    });

    it('should remove connection on close', () => {
      manager.register('order-123', mockWs as any);
      expect(manager.getConnectionCount()).toBe(1);

      mockWs.close();
      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should remove connection on error', () => {
      manager.register('order-123', mockWs as any);
      expect(manager.getConnectionCount()).toBe(1);

      mockWs.triggerError(new Error('Test error'));
      expect(manager.getConnectionCount()).toBe(0);
    });
  });

  describe('sendUpdate', () => {
    it('should send status update to connected client', () => {
      manager.register('order-123', mockWs as any);

      const update = {
        orderId: 'order-123',
        status: OrderStatus.CONFIRMED,
        timestamp: new Date(),
        data: { txHash: 'abc123' },
      };

      manager.sendUpdate(update);

      expect(mockWs.sentMessages).toHaveLength(1);
      const sentData = JSON.parse(mockWs.sentMessages[0]);
      expect(sentData.orderId).toBe('order-123');
      expect(sentData.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should not send update if WebSocket is not open', () => {
      mockWs.readyState = 3; // CLOSED
      manager.register('order-123', mockWs as any);

      const update = {
        orderId: 'order-123',
        status: OrderStatus.CONFIRMED,
        timestamp: new Date(),
      };

      manager.sendUpdate(update);

      expect(mockWs.sentMessages).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('should close a specific connection', () => {
      manager.register('order-123', mockWs as any);
      expect(manager.getConnectionCount()).toBe(1);

      manager.close('order-123');
      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should handle closing non-existent connection', () => {
      expect(() => manager.close('non-existent')).not.toThrow();
    });
  });

  describe('closeAll', () => {
    it('should close all connections', () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();

      manager.register('order-1', mockWs1 as any);
      manager.register('order-2', mockWs2 as any);

      expect(manager.getConnectionCount()).toBe(2);

      manager.closeAll();
      expect(manager.getConnectionCount()).toBe(0);
    });
  });

  describe('getConnectionCount', () => {
    it('should return correct connection count', () => {
      expect(manager.getConnectionCount()).toBe(0);

      manager.register('order-1', new MockWebSocket() as any);
      expect(manager.getConnectionCount()).toBe(1);

      manager.register('order-2', new MockWebSocket() as any);
      expect(manager.getConnectionCount()).toBe(2);
    });
  });
});
