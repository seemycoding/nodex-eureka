export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export type LogEntry = {
    timestamp: number;
    message: string;
    level: LogLevel;
    appName:string
  };

