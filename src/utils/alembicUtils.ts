export class AlembicUtils {
  /**
   * Parses a migration hash to extract the short version
   * @param hash Full migration hash
   * @param length Desired length of short hash (default: 8)
   * @returns Shortened hash
   */
  static getShortHash(hash: string, length: number = 8): string {
    return hash?.substring(0, length) || "";
  }

  /**
   * Validates if a string looks like a valid migration hash
   * @param hash String to validate
   * @returns True if valid hash format
   */
  static isValidHash(hash: string): boolean {
    return /^[a-f0-9]+$/i.test(hash) && hash.length >= 8;
  }

  /**
   * Formats a migration message for display
   * @param message Raw migration message
   * @param maxLength Maximum length to display (default: 50)
   * @returns Formatted message
   */
  static formatMessage(message: string, maxLength: number = 50): string {
    if (!message) {
      return "No description";
    }

    if (message.length <= maxLength) {
      return message;
    }

    return message.substring(0, maxLength - 3) + "...";
  }

  /**
   * Parses Alembic command output to extract version information
   * @param output Raw command output
   * @returns Parsed version info
   */
  static parseAlembicVersion(output: string): string | null {
    const versionMatch = output.match(/alembic\s+(\d+\.\d+\.\d+)/i);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * Checks if Alembic is available in the system
   * @param alembicPath Path to Alembic executable
   * @returns Promise resolving to version string or null
   */
  static async checkAlembicAvailability(alembicPath: string): Promise<string | null> {
    try {
      const { spawn } = require("child_process");

      return new Promise((resolve) => {
        const process = spawn(alembicPath, ["--version"], { shell: true });
        let output = "";

        process.stdout.on("data", (data: Buffer) => {
          output += data.toString();
        });

        process.on("close", (code: number) => {
          if (code === 0) {
            const version = this.parseAlembicVersion(output);
            resolve(version);
          } else {
            resolve(null);
          }
        });

        process.on("error", () => {
          resolve(null);
        });
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Formats a date for display in migration info
   * @param date Date to format
   * @returns Formatted date string
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  }

  /**
   * Sanitizes migration message for use in file names
   * @param message Raw migration message
   * @returns Sanitized message
   */
  static sanitizeMessage(message: string): string {
    return message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s/g, "_")
      .substring(0, 50);
  }
}
