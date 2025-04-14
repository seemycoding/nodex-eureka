import { LogEntry, LogLevel } from "../types/LogEntry";
import fs from "fs";
import path from "path";

const LOG_FILE = path.join(__dirname, "../logs/logs.json");

interface StoredLogEntry extends LogEntry {
  appName: string;
}

export class ServiceLogs {
  private static ensureLogFileExists() {
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, JSON.stringify([]));
    }
  }

  private static readLogs(): StoredLogEntry[] {
    this.ensureLogFileExists();
    const data = fs.readFileSync(LOG_FILE, "utf-8");
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private static writeLogs(logs: StoredLogEntry[]) {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  }

  private static log(appName: string, level: LogLevel, message: string) {
    const logs = this.readLogs();
    const newLog: StoredLogEntry = {
      appName,
      timestamp: Date.now(),
      level,
      message
    };
    logs.push(newLog);
    this.writeLogs(logs);
  }

  static info(appName: string, message: string) {
    this.log(appName, "INFO", message);
  }

  static warn(appName: string, message: string) {
    this.log(appName, "WARN", message);
  }

  static error(appName: string, message: string) {
    this.log(appName, "ERROR", message);
  }

  static getLogs(appName: string): StoredLogEntry[] {
    const logs = this.readLogs();
    return logs.filter((log) => log.appName === appName);
  }

  static getAllLogs(): StoredLogEntry[] {
    return this.readLogs();
  }
}
