import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

class LlamaManager extends EventEmitter {
  private static instance: LlamaManager;
  private process: ChildProcess | null = null;
  private status: 'offline' | 'starting' | 'online' = 'offline';

  private constructor() {
    super();
  }

  public static getInstance(): LlamaManager {
    if (!LlamaManager.instance) {
      LlamaManager.instance = new LlamaManager();
    }
    return LlamaManager.instance;
  }

  public async startServer(exePath: string, modelPath: string, args: string[]): Promise<boolean> {
    if (this.process) {
      this.stopServer();
    }

    this.status = 'starting';
    this.emit('status', this.status);

    const fullArgs = [
      '-m', modelPath,
      ...args
    ];

    try {
      this.process = spawn(exePath, fullArgs);

      this.process.stdout?.on('data', (data) => {
        const output = data.toString();

        if (output.includes('HTTP server listening')) {
          this.status = 'online';
          this.emit('status', this.status);
          this.emit('ready');
        }
      });

      this.process.stderr?.on('data', (data) => {

      });

      this.process.on('close', (code) => {

        this.status = 'offline';
        this.process = null;
        this.emit('status', this.status);
      });

      return true;
    } catch (err) {

      this.status = 'offline';
      this.emit('status', this.status);
      return false;
    }
  }

  public stopServer() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.status = 'offline';
      this.emit('status', this.status);
    }
  }

  public getStatus() {
    return this.status;
  }
}

export const llamaManager = LlamaManager.getInstance();
