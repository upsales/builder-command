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
  // Single GraphQL query instead of ~350 lazy-loaded SDK calls
  const res = await client.client.rawRequest(
    `query($email: String!) {
      users(filter: { email: { eq: $email } }, first: 1) {
        nodes {
          assignedIssues(first: 50, orderBy: updatedAt) {
            nodes {
              id identifier title description url priority branchName
              createdAt updatedAt
              state { id name }
              assignee { id name }
              labels { nodes { name } }
              project {
                name
                initiatives { nodes { name } }
              }
              relations {
                nodes {
                  type
                  relatedIssue { id identifier }
                }
              }
              attachments {
                nodes { title url sourceType }
              }
            }
          }
        }
      }
    }`,
    { email }
  );

  const data = res.data as Record<string, unknown>;
  const users = data.users as { nodes: Array<Record<string, unknown>> };
  const user = users?.nodes?.[0];
  if (!user) throw new Error(`No Linear user found with email: ${email}`);

  const issues = (user.assignedIssues as { nodes: Array<Record<string, unknown>> }).nodes;

  return issues.map((issue) => {
    const state = issue.state as { id: string; name: string } | null;
    const assignee = issue.assignee as { id: string; name: string } | null;
    const labels = issue.labels as { nodes: Array<{ name: string }> };
    const project = issue.project as { name: string; initiatives: { nodes: Array<{ name: string }> } } | null;
    const relations = issue.relations as { nodes: Array<{ type: string; relatedIssue: { id: string; identifier: string } | null }> };
    const attachments = issue.attachments as { nodes: Array<{ title: string; url: string; sourceType?: string }> };

    const initiative = project?.initiatives?.nodes?.[0]?.name ?? null;

    return {
      id: issue.id as string,
      identifier: issue.identifier as string,
      title: issue.title as string,
      description: (issue.description as string) ?? null,
      url: issue.url as string,
      state: state?.name ?? "Unknown",
      stateId: state?.id ?? "",
      priority: issue.priority as number,
      assignee: assignee?.name ?? null,
      assigneeId: assignee?.id ?? null,
      labels: labels?.nodes?.map((l) => l.name) ?? [],
      createdAt: issue.createdAt as string,
      updatedAt: issue.updatedAt as string,
      project: project?.name ?? null,
      initiative,
      branchName: (issue.branchName as string) ?? null,
      relations: relations?.nodes
        ?.filter((r) => r.relatedIssue)
        .map((r) => ({
          type: r.type,
          relatedIssueId: r.relatedIssue!.id,
          relatedIssueIdentifier: r.relatedIssue!.identifier,
        })) ?? [],
      attachments: attachments?.nodes?.map((a) => ({
        title: a.title,
        url: a.url,
        sourceType: a.sourceType ?? undefined,
      })) ?? [],
    };
  });
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

export async function createIssue(opts: {
  title: string;
  description?: string;
  teamId?: string;
  stateId?: string;
  priority?: number;
  assigneeId?: string;
  labelIds?: string[];
  parentId?: string;
}): Promise<{ id: string; identifier: string; url: string }> {
  const teamId = opts.teamId || process.env.LINEAR_TEAM_ID;
  if (!teamId) {
    const teams = await client.teams({ first: 1 });
    const team = teams.nodes[0];
    if (!team) throw new Error("No Linear team found");
    opts.teamId = team.id;
  }
  const issue = await client.createIssue({
    teamId: opts.teamId || teamId!,
    title: opts.title,
    description: opts.description,
    stateId: opts.stateId,
    priority: opts.priority,
    assigneeId: opts.assigneeId,
    labelIds: opts.labelIds,
    parentId: opts.parentId,
  });
  const created = await issue.issue;
  if (!created) throw new Error("Failed to create issue");
  return { id: created.id, identifier: created.identifier, url: created.url };
}

export async function addIssueComment(issueId: string, body: string): Promise<{ id: string }> {
  const comment = await client.createComment({ issueId, body });
  const created = await comment.comment;
  if (!created) throw new Error("Failed to create comment");
  return { id: created.id };
}

export async function searchIssues(query: string, limit = 50): Promise<LinearItem[]> {
  const res = await client.client.rawRequest(
    `query($q: String!, $first: Int!) {
      issueSearch(query: $q, first: $first) {
        nodes {
          id identifier title description url priority branchName
          createdAt updatedAt
          state { id name }
          assignee { id name }
          labels { nodes { name } }
          project { name }
        }
      }
    }`,
    { q: query, first: limit }
  );
  const data = res.data as { issueSearch: { nodes: Array<Record<string, unknown>> } };
  return data.issueSearch.nodes.map((issue) => {
    const state = issue.state as { id: string; name: string } | null;
    const assignee = issue.assignee as { id: string; name: string } | null;
    const labels = issue.labels as { nodes: Array<{ name: string }> };
    const project = issue.project as { name: string } | null;
    return {
      id: issue.id as string,
      identifier: issue.identifier as string,
      title: issue.title as string,
      description: (issue.description as string) ?? null,
      url: issue.url as string,
      state: state?.name ?? "Unknown",
      stateId: state?.id ?? "",
      priority: issue.priority as number,
      assignee: assignee?.name ?? null,
      assigneeId: assignee?.id ?? null,
      labels: labels?.nodes?.map((l) => l.name) ?? [],
      createdAt: issue.createdAt as string,
      updatedAt: issue.updatedAt as string,
      project: project?.name ?? null,
      initiative: null,
      branchName: (issue.branchName as string) ?? null,
      relations: [],
      attachments: [],
    };
  });
}

/** Re-fetch a single issue by its UUID and return it in the same shape as fetchAssignedIssues */
export async function fetchSingleIssue(issueId: string): Promise<LinearItem | null> {
  try {
    const res = await client.client.rawRequest(
      `query($id: String!) {
        issue(id: $id) {
          id identifier title description url priority branchName
          createdAt updatedAt
          state { id name }
          assignee { id name }
          labels { nodes { name } }
          project {
            name
            initiatives { nodes { name } }
          }
          relations {
            nodes {
              type
              relatedIssue { id identifier }
            }
          }
          attachments {
            nodes { title url sourceType }
          }
        }
      }`,
      { id: issueId }
    );

    const data = res.data as Record<string, unknown>;
    const issue = data.issue as Record<string, unknown> | null;
    if (!issue) return null;

    const state = issue.state as { id: string; name: string } | null;
    const assignee = issue.assignee as { id: string; name: string } | null;
    const labels = issue.labels as { nodes: Array<{ name: string }> };
    const project = issue.project as { name: string; initiatives: { nodes: Array<{ name: string }> } } | null;
    const relations = issue.relations as { nodes: Array<{ type: string; relatedIssue: { id: string; identifier: string } | null }> };
    const attachments = issue.attachments as { nodes: Array<{ title: string; url: string; sourceType?: string }> };
    const initiative = project?.initiatives?.nodes?.[0]?.name ?? null;

    return {
      id: issue.id as string,
      identifier: issue.identifier as string,
      title: issue.title as string,
      description: (issue.description as string) ?? null,
      url: issue.url as string,
      state: state?.name ?? "Unknown",
      stateId: state?.id ?? "",
      priority: issue.priority as number,
      assignee: assignee?.name ?? null,
      assigneeId: assignee?.id ?? null,
      labels: labels?.nodes?.map((l) => l.name) ?? [],
      createdAt: issue.createdAt as string,
      updatedAt: issue.updatedAt as string,
      project: project?.name ?? null,
      initiative,
      branchName: (issue.branchName as string) ?? null,
      relations: relations?.nodes
        ?.filter((r) => r.relatedIssue)
        .map((r) => ({
          type: r.type,
          relatedIssueId: r.relatedIssue!.id,
          relatedIssueIdentifier: r.relatedIssue!.identifier,
        })) ?? [],
      attachments: attachments?.nodes?.map((a) => ({
        title: a.title,
        url: a.url,
        sourceType: a.sourceType ?? undefined,
      })) ?? [],
    };
  } catch {
    return null;
  }
}
