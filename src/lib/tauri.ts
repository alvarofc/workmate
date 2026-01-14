import { invoke } from "@tauri-apps/api/core";

export interface ServerInfo {
  port: number;
  url: string;
  project_path: string;
  running: boolean;
}

export interface OpenCodeConfig {
  provider: string;
  model: string;
  api_key?: string;
}

/**
 * Start the OpenCode server for a given project path
 */
export async function startOpenCodeServer(
  projectPath: string,
  config?: OpenCodeConfig
): Promise<ServerInfo> {
  return invoke<ServerInfo>("start_opencode_server", {
    projectPath,
    config,
  });
}

/**
 * Stop the running OpenCode server
 */
export async function stopOpenCodeServer(): Promise<void> {
  return invoke("stop_opencode_server");
}

/**
 * Get the current OpenCode server status
 */
export async function getOpenCodeStatus(): Promise<ServerInfo | null> {
  return invoke<ServerInfo | null>("get_opencode_status");
}

/**
 * Check if opencode is installed on the system
 */
export async function checkOpenCodeInstalled(): Promise<boolean> {
  return invoke<boolean>("check_opencode_installed");
}

/**
 * Get the installed opencode version
 */
export async function getOpenCodeVersion(): Promise<string> {
  return invoke<string>("get_opencode_version");
}
