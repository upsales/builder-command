import { LinearClient } from "@linear/sdk";

const client = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!,
});

export interface LinearItem {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  state: string;
  stateId: string;
  priority: number;
  assignee: string | null;
  assigneeId: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  project: string | null;
  initiative: string | null;
  branchName: string | null;
  relations: { type: string; relatedIssueId: string; relatedIssueIdentifier: string }[];
  attachments: { title: string; url: string; sourceType?: string }[];
}

export interface LinearState {
  id: string;
  name: string;
  type: string;
  position: number;
}

export interface LinearMember {
  id: string;
  name: string;
  email: string;
}

export async function fetchAssignedIssues(email: string): Promise<LinearItem[]> {
  const org = await client.organization;
  const usersRes = await org.users({ first: 100 });
  const user = usersRes.nodes.find((u) => u.email === email);

  if (!user) {
    throw new Error(`No Linear user found with email: ${email}`);
  }

  const issues = await user.assignedIssues({ first: 50 });

  const items: LinearItem[] = [];
  for (const issue of issues.nodes) {
    const state = await issue.state;
    const assignee = await issue.assignee;
    const labels = await issue.labels();
    const project = await issue.project;
    const relations = await issue.relations();
    const attachments = await issue.attachments();

    // Get initiative from project's parent initiatives
    let initiative: string | null = null;
    if (project) {
      try {
        const projectInitiatives = await project.initiatives();
        if (projectInitiatives.nodes.length > 0) {
          initiative = projectInitiatives.nodes[0].name;
        }
      } catch {
        // initiative fetch may fail, that's ok
      }
    }

    const relationItems = [];
    for (const rel of relations.nodes) {
      const related = await rel.relatedIssue;
      if (!related) continue;
      relationItems.push({
        type: rel.type,
        relatedIssueId: related.id,
        relatedIssueIdentifier: related.identifier,
      });
    }

    // Attachments include linked PRs (GitHub, GitLab)
    const attachmentItems = attachments.nodes.map((a) => ({
      title: a.title,
      url: a.url,
      sourceType: a.sourceType ?? undefined,
    }));

    items.push({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? null,
      url: issue.url,
      state: state?.name ?? "Unknown",
      stateId: state?.id ?? "",
      priority: issue.priority,
      assignee: assignee?.name ?? null,
      assigneeId: assignee?.id ?? null,
      labels: labels.nodes.map((l) => l.name),
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      project: project?.name ?? null,
      initiative,
      branchName: issue.branchName ?? null,
      relations: relationItems,
      attachments: attachmentItems,
    });
  }

  return items;
}

export async function fetchTeamStates(): Promise<LinearState[]> {
  const teamId = process.env.LINEAR_TEAM_ID;
  if (!teamId) {
    // Fallback: get first team
    const teams = await client.teams({ first: 1 });
    const team = teams.nodes[0];
    if (!team) return [];
    const states = await team.states();
    return states.nodes.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      position: s.position,
    })).sort((a, b) => a.position - b.position);
  }

  const team = await client.team(teamId);
  const states = await team.states();
  return states.nodes.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    position: s.position,
  })).sort((a, b) => a.position - b.position);
}

export async function fetchTeamMembers(): Promise<LinearMember[]> {
  const org = await client.organization;
  const usersRes = await org.users({ first: 100 });
  return usersRes.nodes
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.displayName, email: u.email }));
}

export async function fetchIssueByIdentifier(identifier: string): Promise<LinearItem | null> {
  const issue = await client.issueSearch({ query: identifier, first: 1 });
  const node = issue.nodes[0];
  if (!node) return null;
  const state = await node.state;
  const assignee = await node.assignee;
  const labels = await node.labels();
  const project = await node.project;
  const attachments = await node.attachments();

  let initiative: string | null = null;
  if (project) {
    try {
      const projectInitiatives = await project.initiatives();
      if (projectInitiatives.nodes.length > 0) {
        initiative = projectInitiatives.nodes[0].name;
      }
    } catch { /* ok */ }
  }

  return {
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    description: node.description ?? null,
    url: node.url,
    state: state?.name ?? "Unknown",
    stateId: state?.id ?? "",
    priority: node.priority,
    assignee: assignee?.name ?? null,
    assigneeId: assignee?.id ?? null,
    labels: labels.nodes.map((l) => l.name),
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    project: project?.name ?? null,
    initiative,
    branchName: node.branchName ?? null,
    relations: [],
    attachments: attachments.nodes.map((a) => ({ title: a.title, url: a.url, sourceType: a.sourceType ?? undefined })),
  };
}

export async function fetchIssueComments(issueId: string): Promise<{ author: string; body: string; createdAt: string }[]> {
  const issue = await client.issue(issueId);
  const comments = await issue.comments();
  const result = [];
  for (const c of comments.nodes) {
    const user = await c.user;
    result.push({
      author: user?.displayName ?? "Unknown",
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    });
  }
  return result;
}

export async function updateIssueState(issueId: string, stateId: string): Promise<void> {
  await client.updateIssue(issueId, { stateId });
}

export async function updateIssueAssignee(issueId: string, assigneeId: string | null): Promise<void> {
  await client.updateIssue(issueId, { assigneeId });
}
