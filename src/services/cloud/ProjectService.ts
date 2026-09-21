/**
 * ProjectService
 * Local-First Project Management & Metadata Synchronization.
 * Source code remains strictly on user's computer. Only metadata is synced to cloud!
 */

import { CloudProject, TechnologyDetectionResult } from '../../types/index.js';
import { desktopBridge } from '../api/desktopBridge.js';
import { getSupabase, isSupabaseConfigured } from './SupabaseClient.js';
import { AuthService } from '../auth/AuthService.js';

const LOCAL_PROJECTS_CACHE = 'salama_local_cloud_projects_cache_v1';

export class ProjectService {
  /**
   * Detect project technology & frameworks from local files
   */
  static async detectTechnology(workspacePath: string): Promise<TechnologyDetectionResult> {
    let language = 'Unknown';
    let framework = 'Generic Project';
    let totalFiles = 0;
    let totalLines = 0;
    let gitBranch = 'main';

    try {
      // 1. Get git info
      const git = await desktopBridge.gitStatus(workspacePath);
      if (git && git.branch) {
        gitBranch = git.branch;
      }
    } catch {}

    try {
      // 2. Scan file list
      const files = await desktopBridge.listFiles(workspacePath);
      totalFiles = files.length;

      const fileNames = files.map((f) => f.name.toLowerCase());

      // Check package.json
      if (fileNames.includes('package.json')) {
        language = 'JavaScript / TypeScript';
        try {
          const pkgFile = await desktopBridge.readFile(workspacePath, 'package.json');
          const pkg = JSON.parse(pkgFile.content);
          const allDeps = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
          };

          if (allDeps['next']) framework = 'Next.js';
          else if (allDeps['react']) framework = 'React + Vite';
          else if (allDeps['vue']) framework = 'Vue.js';
          else if (allDeps['express']) framework = 'Node.js + Express';
          else framework = 'Node.js App';
        } catch {
          framework = 'Node.js Project';
        }
      } else if (fileNames.includes('composer.json')) {
        language = 'PHP';
        framework = fileNames.includes('artisan') ? 'Laravel' : 'PHP Composer';
      } else if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml')) {
        language = 'Python';
        framework = 'Python App';
      } else if (fileNames.includes('go.mod')) {
        language = 'Go';
        framework = 'Go Module';
      } else if (fileNames.includes('cargo.toml')) {
        language = 'Rust';
        framework = 'Rust Cargo';
      }
    } catch (err) {
      console.warn('Technology detection partial error:', err);
    }

    return {
      language,
      framework,
      totalFiles,
      totalLines,
      gitBranch,
    };
  }

  /**
   * List all cloud-synced projects for the current user
   */
  static async listProjects(): Promise<CloudProject[]> {
    const user = AuthService.getCurrentState().user;

    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('last_opened_at', { ascending: false });

        if (!error && data) {
          const mapped: CloudProject[] = data.map((p) => ({
            id: p.id,
            userId: p.user_id,
            name: p.name,
            description: p.description,
            localProjectId: p.local_project_id,
            language: p.language,
            framework: p.framework,
            gitRepository: p.git_repository,
            gitBranch: p.git_branch,
            isFavorite: p.is_favorite || false,
            archived: p.archived || false,
            totalFiles: p.total_files || 0,
            totalLines: p.total_lines || 0,
            lastOpenedAt: p.last_opened_at || p.created_at,
            createdAt: p.created_at,
            updatedAt: p.updated_at || p.created_at,
          }));

          // Cache locally
          try {
            localStorage.setItem(LOCAL_PROJECTS_CACHE, JSON.stringify(mapped));
          } catch {}

          return mapped;
        }
      } catch (err) {
        console.warn('Supabase projects fetch failed, using local cache:', err);
      }
    }

    // Local-First cache fallback
    try {
      const cached = localStorage.getItem(LOCAL_PROJECTS_CACHE);
      if (cached) return JSON.parse(cached);
    } catch {}

    return [];
  }

  /**
   * Create or Link a local project to Cloud Metadata
   */
  static async linkProject(
    workspacePath: string,
    name: string,
    description: string = ''
  ): Promise<CloudProject> {
    const user = AuthService.getCurrentState().user;
    const tech = await this.detectTechnology(workspacePath);

    const project: CloudProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user?.id || 'local_user',
      name: name.trim() || 'Untitled Project',
      description,
      localPath: workspacePath,
      localProjectId: btoa(workspacePath).substring(0, 32),
      language: tech.language,
      framework: tech.framework,
      gitBranch: tech.gitBranch,
      totalFiles: tech.totalFiles,
      totalLines: tech.totalLines,
      isFavorite: false,
      archived: false,
      lastOpenedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name: project.name,
            description: project.description,
            local_project_id: project.localProjectId,
            language: project.language,
            framework: project.framework,
            git_branch: project.gitBranch,
            total_files: project.totalFiles,
            total_lines: project.totalLines,
            is_favorite: project.isFavorite,
            archived: project.archived,
          })
          .select()
          .single();

        if (!error && data) {
          project.id = data.id;
        }
      } catch (err) {
        console.warn('Could not insert to Supabase, saved locally:', err);
      }
    }

    // Save project link info in local workspace `.salama-project.json`
    try {
      await desktopBridge.writeFile(
        workspacePath,
        '.salama-project.json',
        JSON.stringify(
          {
            cloudProjectId: project.id,
            projectName: project.name,
            linkedAt: project.createdAt,
          },
          null,
          2
        )
      );
    } catch {}

    // Update local cache
    const existing = await this.listProjects();
    const updated = [project, ...existing.filter((p) => p.id !== project.id)];
    localStorage.setItem(LOCAL_PROJECTS_CACHE, JSON.stringify(updated));

    return project;
  }

  /**
   * Delete cloud project metadata.
   * NOTE: Strictly preserves local files!
   */
  static async deleteProject(projectId: string): Promise<{ success: boolean; message: string }> {
    const user = AuthService.getCurrentState().user;
    const supabase = getSupabase();

    if (user && supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('projects').delete().eq('id', projectId).eq('user_id', user.id);
      } catch (err: any) {
        console.warn('Error deleting cloud project from Supabase:', err);
      }
    }

    const existing = await this.listProjects();
    const updated = existing.filter((p) => p.id !== projectId);
    localStorage.setItem(LOCAL_PROJECTS_CACHE, JSON.stringify(updated));

    return {
      success: true,
      message: 'Metadata project cloud berhasil dihapus. Berkas lokal Anda tetap aman.',
    };
  }

  /**
   * Toggle favorite status
   */
  static async toggleFavorite(projectId: string): Promise<void> {
    const existing = await this.listProjects();
    const target = existing.find((p) => p.id === projectId);
    if (!target) return;

    target.isFavorite = !target.isFavorite;
    target.updatedAt = new Date().toISOString();

    const user = AuthService.getCurrentState().user;
    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        await supabase
          .from('projects')
          .update({ is_favorite: target.isFavorite, updated_at: target.updatedAt })
          .eq('id', projectId);
      } catch {}
    }

    localStorage.setItem(LOCAL_PROJECTS_CACHE, JSON.stringify(existing));
  }

  /**
   * Toggle archive status
   */
  static async toggleArchive(projectId: string): Promise<void> {
    const existing = await this.listProjects();
    const target = existing.find((p) => p.id === projectId);
    if (!target) return;

    target.archived = !target.archived;
    target.updatedAt = new Date().toISOString();

    const user = AuthService.getCurrentState().user;
    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        await supabase
          .from('projects')
          .update({ archived: target.archived, updated_at: target.updatedAt })
          .eq('id', projectId);
      } catch {}
    }

    localStorage.setItem(LOCAL_PROJECTS_CACHE, JSON.stringify(existing));
  }
}
